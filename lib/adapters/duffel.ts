// Live flight and hotel search through Duffel (https://duffel.com/docs).
// Used only when DUFFEL_ACCESS_TOKEN is set. Field names follow Duffel's v2
// API; they haven't been run against a live account from this project yet,
// so check the first live search carefully.
import type { Criteria, FlightOffer, HotelOffer } from "@/lib/types";
import { findAirport } from "@/lib/airports";
import { listingAmenities } from "@/lib/amenities";
import { flightBooking, hotelBooking } from "./links";

const BASE = "https://api.duffel.com";

async function duffel<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data: body }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    throw new Error(`Couldn't reach Duffel (${(err as Error).message}). Check your internet connection or firewall.`);
  }
  if (res.status === 401) throw new Error("Duffel rejected the access token. Check DUFFEL_ACCESS_TOKEN in .env.local.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duffel ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function passengers(c: Criteria) {
  return [...Array.from({ length: c.adults }, () => ({ type: "adult" })), ...c.childAges.map((age) => ({ age }))];
}

type DuffelSegment = {
  departing_at: string;
  arriving_at: string;
  marketing_carrier?: { iata_code?: string; name?: string };
  marketing_carrier_flight_number?: string;
};
type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner?: { name?: string };
  slices: { segments: DuffelSegment[] }[];
};

export async function duffelFlights(c: Criteria): Promise<FlightOffer[]> {
  const json = await duffel<{ data: { offers: DuffelOffer[] } }>("/air/offer_requests?return_offers=true&supplier_timeout=20000", {
    slices: [
      { origin: c.origin, destination: c.destination, departure_date: c.departDate },
      { origin: c.destination, destination: c.origin, departure_date: c.returnDate },
    ],
    passengers: passengers(c),
    cabin_class: c.flight.cabin,
    max_connections: c.flight.maxStops,
  });
  const bags = c.flight.checkedBags ?? c.adults;
  return (json.data.offers ?? [])
    .filter((o) => o.slices.length === 2 && o.total_currency === "USD")
    .map((o) => {
      const leg = (s: { segments: DuffelSegment[] }) => ({
        depart: s.segments[0].departing_at,
        arrive: s.segments[s.segments.length - 1].arriving_at,
        flightNumbers: s.segments.map((g) => `${g.marketing_carrier?.iata_code ?? ""} ${g.marketing_carrier_flight_number ?? ""}`.trim()),
      });
      const f: FlightOffer = {
        id: `duffel-${o.id}`,
        source: "duffel_flights",
        sample: false,
        airline: (o.owner?.name ?? "").replace(/ Air Lines| Airlines/, ""),
        stops: Math.max(...o.slices.map((s) => s.segments.length - 1)),
        cabin: c.flight.cabin,
        outbound: leg(o.slices[0]),
        inbound: leg(o.slices[1]),
        // Estimated $35 per checked bag each way; Duffel's fare doesn't include bags.
        cash: Math.round(parseFloat(o.total_amount) + bags * 35 * 2),
        payment: { kind: "cash" },
        booking: { kind: "link", url: "", label: "" },
      };
      f.booking = flightBooking(c, f);
      return f;
    });
}

type DuffelStay = {
  id: string;
  cheapest_rate_total_amount: string;
  cheapest_rate_currency: string;
  accommodation: {
    id: string;
    name: string;
    rating?: number | null;
    review_score?: number | null;
    location?: { geographic_coordinates?: { latitude: number; longitude: number } };
    amenities?: { type?: string; description?: string }[] | null;
    rooms?: { name?: string }[] | null;
  };
};

export async function duffelStays(c: Criteria): Promise<HotelOffer[]> {
  const a = findAirport(c.destination);
  if (!a) throw new Error(`No coordinates for ${c.destination}. Add it to lib/airports.ts.`);
  const json = await duffel<{ data: { results: DuffelStay[] } }>("/stays/search", {
    rooms: 1,
    location: {
      radius: Math.ceil(c.hotel.maxMilesFromAirport * 1.609), // Duffel takes kilometres
      geographic_coordinates: { latitude: a.lat, longitude: a.lng },
    },
    check_in_date: c.departDate,
    check_out_date: c.returnDate,
    guests: passengers(c).map((p) => ("age" in p ? { type: "child", age: p.age } : { type: "adult" })),
  });
  return (json.data.results ?? [])
    .filter((r) => r.cheapest_rate_currency === "USD" && r.accommodation.location?.geographic_coordinates)
    .map((r) => {
      const acc = r.accommodation;
      const roomName = acc.rooms?.[0]?.name ?? "Room";
      const bedMatch = (acc.rooms ?? []).map((x) => x.name ?? "").join(" ").match(/(\d)[- ]bedroom/i);
      const sqftMatch = (acc.rooms ?? []).map((x) => x.name ?? "").join(" ").match(/(\d{3,4})\s*(?:sq\.?\s*ft|square feet)/i);
      const h: HotelOffer = {
        id: `duffel-${r.id}`,
        source: "duffel_stays",
        sample: false,
        name: acc.name,
        lat: acc.location!.geographic_coordinates!.latitude,
        lng: acc.location!.geographic_coordinates!.longitude,
        stars: acc.rating ?? null,
        rating: acc.review_score ?? null,
        bedrooms: bedMatch ? parseInt(bedMatch[1], 10) : null,
        sqft: sqftMatch ? parseInt(sqftMatch[1], 10) : null,
        roomName,
        amenities: listingAmenities((acc.amenities ?? []).map((x) => `${x.type ?? ""} ${x.description ?? ""}`.replace(/_/g, " ")).join(" | ")),
        cash: Math.round(parseFloat(r.cheapest_rate_total_amount)),
        payment: { kind: "cash" },
        credit: 0,
        booking: { kind: "link", url: "", label: "" },
      };
      h.booking = hotelBooking(c, h);
      return h;
    });
}
