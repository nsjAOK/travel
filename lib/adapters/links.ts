import type { Booking, CarOffer, Criteria, FlightOffer, HotelOffer } from "@/lib/types";
import { carLabel } from "@/lib/cars";
import { findAirport } from "@/lib/airports";

const AIRLINE_SITES: Record<string, string> = {
  Delta: "https://www.delta.com",
  Alaska: "https://www.alaskaair.com",
  United: "https://www.united.com",
  American: "https://www.aa.com",
  Southwest: "https://www.southwest.com",
  JetBlue: "https://www.jetblue.com",
};

export const fmtTime = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const mer = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${mer}`;
};

export const fmtDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function travelersText(c: Criteria): string {
  const kids = c.childAges.length;
  return `${c.adults} adult${c.adults === 1 ? "" : "s"}${kids ? `, ${kids} child${kids === 1 ? "" : "ren"} (ages ${c.childAges.join(", ")})` : ""}`;
}

export function flightBooking(c: Criteria, f: FlightOffer): Booking {
  const q = `Flights from ${c.origin} to ${c.destination} on ${c.departDate} through ${c.returnDate} on ${f.airline}`;
  const site = AIRLINE_SITES[f.airline];
  return {
    kind: "link",
    url: site ?? `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`,
    label: site ? `Book on ${new URL(site).hostname.replace("www.", "")}` : "Find these flights",
    steps: [
      `Search round trip ${c.origin} → ${c.destination}, ${fmtDate(c.departDate)} – ${fmtDate(c.returnDate)}, ${travelersText(c)}.`,
      `Outbound: ${f.outbound.flightNumbers.join(" + ")}, leaving ${fmtTime(f.outbound.depart)}, landing ${fmtTime(f.outbound.arrive)}.`,
      `Return: ${f.inbound.flightNumbers.join(" + ")}, leaving ${fmtTime(f.inbound.depart)}, landing ${fmtTime(f.inbound.arrive)}.`,
      `Add ${c.flight.checkedBags ?? c.adults} checked bag(s). The total should be about $${f.cash.toLocaleString("en-US")}.`,
    ],
  };
}

export function hotelBooking(c: Criteria, h: HotelOffer): Booking {
  const city = findAirport(c.destination)?.city ?? c.destination;
  return {
    kind: "link",
    url: `https://www.google.com/travel/search?q=${encodeURIComponent(`${h.name} ${city}`)}`,
    label: "Find this hotel",
    steps: [
      `Open the hotel's own website (or the link) for ${fmtDate(c.departDate)} – ${fmtDate(c.returnDate)}, ${travelersText(c)}.`,
      `Choose the ${h.roomName}.`,
      `Pick a rate with free cancellation if one is offered. The total with taxes should be about $${h.cash.toLocaleString("en-US")}.`,
    ],
  };
}

export function carBooking(c: Criteria, car: CarOffer): Booking {
  return {
    kind: "steps",
    site: car.company,
    steps: [
      `Search ${car.company} for pick-up and drop-off at ${c.destination}, ${fmtDate(c.departDate)} – ${fmtDate(c.returnDate)}.`,
      `Choose a ${carLabel(car.vehicleClass).toLowerCase().replace("suv", "SUV")}. The total should be about $${car.cash.toLocaleString("en-US")}.`,
      "Pick pay at the counter so you can cancel for free.",
    ],
  };
}
