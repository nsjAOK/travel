// Shared shapes for the whole app: what the traveler asked for, what each
// source returned, and the ranked bundles we show.

export type TimeWindow = { from: string; to: string }; // "HH:MM", local airport time

export interface Criteria {
  origin: string; // IATA code, e.g. "SEA"
  destination: string; // arrival airport, e.g. "MCO"
  departDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  dateFlexDays: number;
  adults: number;
  childAges: number[];
  hotel: {
    maxMilesFromAirport: number;
    minStars: number | null;
    minRating: number | null; // out of 10
    minBedrooms: number | null;
    minSqft: number | null;
    amenities: string[]; // canonical amenity keys, see lib/amenities.ts
    includeFees: boolean;
  };
  flight: {
    cabin: "economy" | "premium_economy" | "business" | "first";
    maxStops: number;
    preferredAirlines: string[];
    checkedBags: number | null; // null = not mentioned
    outbound: { depart: TimeWindow; arrive: TimeWindow };
    inbound: { depart: TimeWindow; arrive: TimeWindow };
  };
  car: {
    needed: boolean;
    vehicleClass: CarClass | null;
  };
  maxBudget: number | null;
  notes: string[]; // things we read but can't filter on
  questions: string[]; // details the description left out
}

export type CarClass = "economy" | "compact" | "midsize" | "fullsize" | "midsize_suv" | "fullsize_suv" | "minivan" | "luxury";

export type Payment =
  | { kind: "cash" }
  | { kind: "points"; program: string; points: number };

export type Booking =
  | { kind: "link"; url: string; label: string; steps?: string[] }
  | { kind: "steps"; site: string; url?: string; steps: string[] };

export interface FlightOffer {
  id: string;
  source: string;
  sample: boolean;
  airline: string;
  stops: number;
  cabin: Criteria["flight"]["cabin"];
  outbound: { depart: string; arrive: string; flightNumbers: string[] }; // ISO local times
  inbound: { depart: string; arrive: string; flightNumbers: string[] };
  cash: number; // USD, all travelers, incl. bags we priced in
  payment: Payment;
  booking: Booking;
}

export interface HotelOffer {
  id: string;
  source: string;
  sample: boolean;
  name: string;
  lat: number;
  lng: number;
  stars: number | null;
  rating: number | null;
  bedrooms: number | null;
  sqft: number | null;
  roomName: string;
  amenities: string[];
  cash: number; // USD, whole stay incl. taxes and fees when known
  payment: Payment;
  credit: number; // perks worth cash, e.g. a $100 property credit
  booking: Booking;
}

export interface CarOffer {
  id: string;
  source: string;
  sample: boolean;
  company: string;
  vehicleClass: CarClass;
  cash: number;
  booking: Booking;
}

export interface PackageOffer {
  id: string;
  source: string;
  sample: boolean;
  flight: FlightOffer;
  hotel: HotelOffer;
  car: CarOffer | null;
  cash: number;
  rewardRate: number; // e.g. 0.02 for a 2% member reward
  booking: Booking;
}

export interface SourceResult {
  source: string;
  label: string;
  status: "done" | "manual" | "error" | "skipped";
  message: string;
  sample: boolean;
  flights: FlightOffer[];
  hotels: HotelOffer[];
  cars: CarOffer[];
  packages: PackageOffer[];
  manualSteps?: Booking;
}

export interface Membership {
  id: string; // program key, e.g. "chase_ur"
  name: string;
  detail: string;
  balance: number | null; // points or miles; null for clubs like Costco
  centsPerPoint: number | null;
  enabled: boolean;
}

export interface Check {
  label: string;
  ok: boolean | null; // null = couldn't confirm from the source's data
}

export interface Bundle {
  rank: number;
  title: string;
  via: string;
  flight: FlightOffer;
  hotel: HotelOffer;
  car: CarOffer | null;
  packageId: string | null;
  cash: number;
  pointsUsed: { program: string; points: number; value: number }[];
  rewards: number; // cash back or credits subtracted
  effective: number;
  milesFromAirport: number;
  checks: Check[];
  steps: { title: string; booking: Booking }[];
  sample: boolean;
}
