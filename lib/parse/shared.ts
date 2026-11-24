// What Claude is asked for and how its answer becomes Criteria. Shared by the
// server reader (lib/parse/claude.ts) and the in-Claude artifact.
import type { CarClass, Criteria } from "@/lib/types";
import { AIRPORTS } from "@/lib/airports";
import { AMENITIES } from "@/lib/amenities";
import { emptyCriteria, missingQuestions, ANY_TIME } from "./defaults";

type Window = { from: string; to: string };

/** The flat shape Claude returns. */
export interface ParsedTrip {
  origin: string | null;
  destination: string | null;
  departDate: string | null;
  returnDate: string | null;
  dateFlexDays: number;
  adults: number;
  childAges: number[];
  hotel: {
    maxMilesFromAirport: number | null;
    minStars: number | null;
    minRating: number | null;
    minBedrooms: number | null;
    minSqft: number | null;
    amenities: string[];
  };
  flight: {
    cabin: Criteria["flight"]["cabin"];
    maxStops: number;
    preferredAirlines: string[];
    checkedBags: number | null;
    outboundDepart: Window;
    outboundArrive: Window;
    returnDepart: Window;
    returnArrive: Window;
  };
  car: { needed: boolean; vehicleClass: CarClass | null };
  maxBudget: number | null;
  notes: string[];
  questions: string[];
}

export function readerInstructions(today: string): string {
  const airports = AIRPORTS.map((a) => `${a.code} (${a.city})`).join(", ");
  return [
    "You turn a traveler's description of a vacation into search criteria for hotel + flight + rental car bundles.",
    "Every value you set becomes a hard filter, so only set limits the traveler actually stated or clearly implied; use null or the widest window otherwise.",
    `Today is ${today}. Dates without a year are the next time those dates come around.`,
    "Use IATA airport codes. When the traveler names a city with several airports, choose the main one, and add a question if the choice matters.",
    `Airports the app knows coordinates for: ${airports}.`,
    "maxStops: 0 for nonstop only; 1 if they allow one stop; default 1 when not stated.",
    "Time windows are local times at the airport where the leave or land happens. 'Land by 6 pm' means arrive window 00:00-18:00. 'Leave after 11 am' means 11:00-23:59.",
    "If no car is mentioned, set car.needed true and vehicleClass null.",
    `Amenity keys: ${AMENITIES.map((a) => a.key).join(", ")}. Use only these keys.`,
    "Car classes: economy, compact, midsize, fullsize, midsize_suv, fullsize_suv, minivan, luxury.",
  ].join("\n");
}

/** The JSON shape, as an example for prompts that can't send a schema. */
export const PARSED_EXAMPLE: ParsedTrip = {
  origin: "SEA",
  destination: "MCO",
  departDate: "2027-03-14",
  returnDate: "2027-03-21",
  dateFlexDays: 0,
  adults: 2,
  childAges: [8],
  hotel: { maxMilesFromAirport: 8, minStars: 4, minRating: 8.5, minBedrooms: null, minSqft: null, amenities: ["pool"] },
  flight: {
    cabin: "economy",
    maxStops: 1,
    preferredAirlines: ["Delta"],
    checkedBags: null,
    outboundDepart: { from: "06:00", to: "11:00" },
    outboundArrive: { from: "00:00", to: "18:00" },
    returnDepart: { from: "00:00", to: "23:59" },
    returnArrive: { from: "00:00", to: "23:59" },
  },
  car: { needed: true, vehicleClass: "midsize_suv" },
  maxBudget: null,
  notes: [],
  questions: [],
};

const CABINS = ["economy", "premium_economy", "business", "first"];
const CARS = ["economy", "compact", "midsize", "fullsize", "midsize_suv", "fullsize_suv", "minivan", "luxury"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Turn Claude's answer into Criteria, checking every field (the answer isn't trusted). */
export function toCriteria(raw: unknown): Criteria {
  const p = (raw ?? {}) as Partial<ParsedTrip>;
  const h = (p.hotel ?? {}) as Partial<ParsedTrip["hotel"]>;
  const f = (p.flight ?? {}) as Partial<ParsedTrip["flight"]>;
  const car = (p.car ?? {}) as Partial<ParsedTrip["car"]>;
  const w = (x: unknown) => {
    const o = (x ?? {}) as Partial<Window>;
    return { from: HHMM.test(str(o.from)) ? str(o.from) : ANY_TIME.from, to: HHMM.test(str(o.to)) ? str(o.to) : ANY_TIME.to };
  };
  const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);

  const c = emptyCriteria();
  c.origin = str(p.origin).toUpperCase().slice(0, 3);
  c.destination = str(p.destination).toUpperCase().slice(0, 3);
  c.departDate = date(p.departDate);
  c.returnDate = date(p.returnDate);
  c.dateFlexDays = Math.max(0, num(p.dateFlexDays) ?? 0);
  c.adults = Math.max(1, Math.round(num(p.adults) ?? 1));
  c.childAges = (Array.isArray(p.childAges) ? p.childAges : []).map(num).filter((x): x is number => x !== null).slice(0, 10);
  c.hotel = {
    ...c.hotel,
    maxMilesFromAirport: num(h.maxMilesFromAirport) ?? c.hotel.maxMilesFromAirport,
    minStars: num(h.minStars),
    minRating: num(h.minRating),
    minBedrooms: num(h.minBedrooms),
    minSqft: num(h.minSqft),
    amenities: strings(h.amenities).filter((a) => AMENITIES.some((x) => x.key === a)),
  };
  c.flight = {
    cabin: CABINS.includes(str(f.cabin)) ? (f.cabin as Criteria["flight"]["cabin"]) : "economy",
    maxStops: Math.max(0, Math.round(num(f.maxStops) ?? 1)),
    preferredAirlines: strings(f.preferredAirlines),
    checkedBags: num(f.checkedBags),
    outbound: { depart: w(f.outboundDepart), arrive: w(f.outboundArrive) },
    inbound: { depart: w(f.returnDepart), arrive: w(f.returnArrive) },
  };
  c.car = {
    needed: car.needed !== false,
    vehicleClass: CARS.includes(str(car.vehicleClass)) ? (car.vehicleClass as CarClass) : null,
  };
  c.maxBudget = num(p.maxBudget);
  c.notes = strings(p.notes);
  c.questions = [...new Set([...strings(p.questions), ...missingQuestions(c)])];
  return c;
}
