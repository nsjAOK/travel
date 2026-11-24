import { describe, it, expect } from "vitest";
import { parseHeuristic, toClock } from "@/lib/parse/heuristic";

export const SAMPLE_TRIP =
  "Family of four (2 adults, kids 8 and 11) flying Seattle to Orlando, Mar 14–21 2027, give or take a day. " +
  "Hotel within 8 miles of MCO, at least 4 stars and rated 8.5 or better, with 2 bedrooms or at least 600 sq ft. " +
  "Must have free breakfast, a pool, a kitchenette, free parking, an airport shuttle and Wi-Fi. Economy, 1 stop max. " +
  "Leave Seattle between 6 and 11 am and land in Orlando by 6 pm. Coming home, leave after 11 am and land in Seattle by 9 pm. " +
  "Prefer Delta or Alaska. Midsize SUV.";

describe("built-in trip reader", () => {
  const c = parseHeuristic(SAMPLE_TRIP, new Date("2026-11-24"));

  it("reads route, dates and travelers", () => {
    expect([c.origin, c.destination]).toEqual(["SEA", "MCO"]);
    expect([c.departDate, c.returnDate]).toEqual(["2027-03-14", "2027-03-21"]);
    expect(c.dateFlexDays).toBe(1);
    expect(c.adults).toBe(2);
    expect(c.childAges).toEqual([8, 11]);
  });

  it("reads hotel limits", () => {
    expect(c.hotel).toMatchObject({ maxMilesFromAirport: 8, minStars: 4, minRating: 8.5, minBedrooms: 2, minSqft: 600 });
    expect(c.hotel.amenities.sort()).toEqual(["airport_shuttle", "free_breakfast", "free_parking", "kitchen", "pool", "wifi"]);
  });

  it("reads flight rules and time windows", () => {
    expect(c.flight.maxStops).toBe(1);
    expect(c.flight.cabin).toBe("economy");
    expect(c.flight.preferredAirlines).toEqual(["Delta", "Alaska"]);
    expect(c.flight.outbound.depart).toEqual({ from: "06:00", to: "11:00" });
    expect(c.flight.outbound.arrive).toEqual({ from: "00:00", to: "18:00" });
    expect(c.flight.inbound.depart).toEqual({ from: "11:00", to: "23:59" });
    expect(c.flight.inbound.arrive).toEqual({ from: "00:00", to: "21:00" });
  });

  it("reads the car and flags missing details", () => {
    expect(c.car).toEqual({ needed: true, vehicleClass: "midsize_suv" });
    expect(c.flight.checkedBags).toBeNull();
    expect(c.questions.some((q) => q.includes("bags"))).toBe(true);
  });

  it("handles nonstop, budgets, no car and a year rollover", () => {
    const d = parseHeuristic("Nonstop from Boston to Denver, Jan 5 to Jan 9, no car, budget of $2,500, 1 bag", new Date("2026-11-24"));
    expect(d.flight.maxStops).toBe(0);
    expect(d.car.needed).toBe(false);
    expect(d.maxBudget).toBe(2500);
    expect(d.departDate).toBe("2027-01-05");
    expect(d.flight.checkedBags).toBe(1);
  });
});

describe("toClock", () => {
  it("converts common forms", () => {
    expect(toClock("6 pm")).toBe("18:00");
    expect(toClock("11:30am")).toBe("11:30");
    expect(toClock("12 am")).toBe("00:00");
    expect(toClock("noon")).toBe("12:00");
    expect(toClock("6", "am")).toBe("06:00");
  });
});
