import type { Criteria } from "@/lib/types";

export const ANY_TIME = { from: "00:00", to: "23:59" };

export function emptyCriteria(): Criteria {
  return {
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    dateFlexDays: 0,
    adults: 1,
    childAges: [],
    hotel: {
      maxMilesFromAirport: 10,
      minStars: null,
      minRating: null,
      minBedrooms: null,
      minSqft: null,
      amenities: [],
      includeFees: true,
    },
    flight: {
      cabin: "economy",
      maxStops: 1,
      preferredAirlines: [],
      checkedBags: null,
      outbound: { depart: { ...ANY_TIME }, arrive: { ...ANY_TIME } },
      inbound: { depart: { ...ANY_TIME }, arrive: { ...ANY_TIME } },
    },
    car: { needed: true, vehicleClass: null },
    maxBudget: null,
    notes: [],
    questions: [],
  };
}

/** Why a search can't run yet, in words for the traveler; null when it can. */
export function searchBlocker(c: Criteria, today = new Date()): string | null {
  if (!c.origin || !c.destination) return "Both airports are needed before searching.";
  if (!c.departDate || !c.returnDate) return "Travel dates are needed before searching.";
  if (c.returnDate <= c.departDate) return "The return date must be after the departure date.";
  const todayYmd = today.toISOString().slice(0, 10);
  if (c.departDate < todayYmd) return "The departure date is in the past.";
  return null;
}

/** Questions to ask when the description left something important out. */
export function missingQuestions(c: Criteria): string[] {
  const q: string[] = [];
  if (!c.origin) q.push("Which airport are you flying from?");
  if (!c.destination) q.push("Which airport are you flying into?");
  if (!c.departDate || !c.returnDate) q.push("What are your travel dates?");
  if (c.departDate && c.returnDate && c.returnDate <= c.departDate) q.push("Your return date is on or before your departure date. Fix the dates before searching.");
  if (c.flight.checkedBags === null) q.push("Checked bags weren't mentioned. We'll price in 1 checked bag per adult unless you change this.");
  if (c.car.needed && !c.car.vehicleClass) q.push("No car size was mentioned. We'll look for a midsize car or larger.");
  return q;
}
