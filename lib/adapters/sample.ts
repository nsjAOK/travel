// Deterministic sample offers, used whenever a live source isn't configured.
// Every offer is marked `sample: true` and the UI labels it as such.
import type { CarClass, CarOffer, Criteria, FlightOffer, HotelOffer } from "@/lib/types";
import { findAirport, milesBetween } from "@/lib/airports";
import { AMENITY_KEYS } from "@/lib/amenities";

export function rng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nights(c: Criteria): number {
  const ms = new Date(c.returnDate).getTime() - new Date(c.departDate).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export const travelers = (c: Criteria) => c.adults + c.childAges.length;

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(Math.round(mins % 60))}`;
/** Rough UTC offset from longitude; good enough for sample schedules. */
const tz = (lng: number) => Math.round(lng / 15);

const AIRLINES = ["Delta", "Alaska", "United", "American", "Southwest", "JetBlue"];
const CODES: Record<string, string> = { Delta: "DL", Alaska: "AS", United: "UA", American: "AA", Southwest: "WN", JetBlue: "B6" };

export function sampleFlights(c: Criteria, count = 60): FlightOffer[] {
  const o = findAirport(c.origin);
  const d = findAirport(c.destination);
  if (!o || !d) return [];
  const r = rng(`flights:${c.origin}:${c.destination}:${c.departDate}`);
  const dist = milesBetween(o.lat, o.lng, d.lat, d.lng);
  const shift = (tz(d.lng) - tz(o.lng)) * 60;
  const pax = travelers(c);
  const bags = c.flight.checkedBags ?? c.adults;
  const out: FlightOffer[] = [];

  for (let i = 0; i < count; i++) {
    const airline = AIRLINES[Math.floor(r() * AIRLINES.length)];
    const stops = r() < 0.45 ? 0 : r() < 0.8 ? 1 : 2;
    const block = (dist / 510 + 0.5 + stops * 1.2) * 60;
    const leg = (date: string, startMin: number, offset: number) => {
      const arriveMin = startMin + block + offset;
      const nextDay = arriveMin >= 1440;
      const arriveDate = new Date(date);
      if (nextDay) arriveDate.setUTCDate(arriveDate.getUTCDate() + 1);
      return {
        depart: `${date}T${clock(startMin)}`,
        arrive: `${arriveDate.toISOString().slice(0, 10)}T${clock(((arriveMin % 1440) + 1440) % 1440)}`,
        flightNumbers: Array.from({ length: stops + 1 }, () => `${CODES[airline]} ${100 + Math.floor(r() * 2800)}`),
      };
    };
    // Airlines schedule more departures in the morning; mirror that.
    const OUT_HOURS = [6, 6, 7, 7, 7, 8, 8, 9, 9, 10, 11, 12, 13, 15, 17, 19, 21];
    const BACK_HOURS = [7, 9, 10, 11, 11, 12, 12, 13, 13, 14, 15, 16, 17, 18, 20];
    const outStart = OUT_HOURS[Math.floor(r() * OUT_HOURS.length)] * 60 + (r() < 0.5 ? 0 : 30);
    const backStart = BACK_HOURS[Math.floor(r() * BACK_HOURS.length)] * 60 + (r() < 0.5 ? 15 : 45);
    const perSeat = 90 + dist * (0.07 + r() * 0.06) - stops * 35 + (c.flight.cabin === "economy" ? 0 : 450);
    const bagFees = airline === "Southwest" ? 0 : bags * 35 * 2;
    const cash = Math.round(perSeat * pax + bagFees);
    out.push({
      id: `sample-fl-${i}`,
      source: "duffel_flights",
      sample: true,
      airline,
      stops,
      cabin: c.flight.cabin,
      outbound: leg(c.departDate, outStart, shift),
      inbound: leg(c.returnDate, backStart, -shift),
      cash,
      payment: { kind: "cash" },
      booking: { kind: "link", url: "", label: "" }, // filled in by the flight adapter
    });
  }
  return out;
}

const NAME_A = ["Lakeside", "Cypress Point", "Harbor Palms", "Orchid Grove", "Terminal View", "Magnolia", "Pinecrest", "Bayview", "Sandpiper", "Willow Creek", "Heron Bay", "Sunridge", "Coral Gate", "Briarwood", "Juniper"];
const NAME_B = ["Suites", "Residences", "Inn & Suites", "Airport Hotel", "Resort", "Extended Stay", "Hotel"];

export function sampleHotels(c: Criteria, count = 60): HotelOffer[] {
  const a = findAirport(c.destination);
  if (!a) return [];
  const r = rng(`hotels:${c.destination}:${c.departDate}`);
  const n = nights(c);
  const out: HotelOffer[] = [];
  for (let i = 0; i < count; i++) {
    const miles = 0.4 + r() * 16;
    const angle = r() * Math.PI * 2;
    const lat = a.lat + (miles / 69) * Math.sin(angle);
    const lng = a.lng + (miles / (69 * Math.cos((a.lat * Math.PI) / 180))) * Math.cos(angle);
    const stars = [3, 3.5, 4, 4, 4.5, 4.5, 5][Math.floor(r() * 7)];
    const bedrooms = r() < 0.45 ? 2 : r() < 0.7 ? 1 : 0;
    const sqft = bedrooms === 2 ? 720 + Math.round(r() * 300) : bedrooms === 1 ? 520 + Math.round(r() * 220) : 300 + Math.round(r() * 160);
    const amenities = AMENITY_KEYS.filter(() => r() < 0.86);
    const nightly = 90 + stars * 28 + bedrooms * 45 + r() * 60;
    out.push({
      id: `sample-ht-${i}`,
      source: "duffel_stays",
      sample: true,
      name: `${NAME_A[i % NAME_A.length]} ${NAME_B[Math.floor(r() * NAME_B.length)]} ${c.destination}`,
      lat,
      lng,
      stars,
      rating: Math.round((7.6 + r() * 2.3) * 10) / 10,
      bedrooms,
      sqft,
      roomName: bedrooms === 0 ? "Studio suite" : `${bedrooms}-bedroom suite`,
      amenities,
      cash: Math.round(nightly * n * 1.13),
      payment: { kind: "cash" },
      credit: 0,
      booking: { kind: "link", url: "", label: "" },
    });
  }
  return out;
}

const CAR_CLASSES: CarClass[] = ["compact", "midsize", "fullsize", "midsize_suv", "fullsize_suv", "minivan"];
const CAR_RANK: Record<CarClass, number> = { economy: 0, compact: 1, midsize: 2, fullsize: 3, midsize_suv: 4, fullsize_suv: 5, minivan: 5, luxury: 6 };
export const carRank = (c: CarClass) => CAR_RANK[c];

export function sampleCars(c: Criteria): CarOffer[] {
  const r = rng(`cars:${c.destination}:${c.departDate}`);
  const n = nights(c);
  const companies = ["Rental company A", "Rental company B", "Rental company C", "Rental company D"];
  const out: CarOffer[] = [];
  CAR_CLASSES.forEach((cls, i) => {
    companies.forEach((company, j) => {
      const daily = 32 + CAR_RANK[cls] * 9 + r() * 18;
      out.push({ id: `sample-car-${i}-${j}`, source: "cars", sample: true, company, vehicleClass: cls, cash: Math.round(daily * n), booking: { kind: "link", url: "", label: "" } });
    });
  });
  return out;
}
