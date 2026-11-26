// One test per bug found in the adversarial review. Each failed before its fix.
import { describe, it, expect } from "vitest";
import { parseHeuristic } from "@/lib/parse/heuristic";
import { searchBlocker } from "@/lib/parse/defaults";
import { flightChecks, hotelChecks, passes } from "@/lib/engine/filter";
import { amenitiesIn, listingAmenities } from "@/lib/amenities";
import { priceChangeRule, rankBundles } from "@/lib/engine/rank";
import { listSources, runSource } from "@/lib/adapters";
import { DEFAULT_MEMBERSHIPS } from "@/lib/memberships";
import { tripKey, type Trip } from "@/lib/client/store";
import type { Bundle, FlightOffer, HotelOffer } from "@/lib/types";

const T = new Date("2026-11-26");
const read = (s: string) => parseHeuristic(s, T);

describe("1. cities with several airports", () => {
  it("keeps the destination and asks which airport", () => {
    const dc = read("Washington to Orlando, Mar 14-21 2027");
    expect([dc.origin, dc.destination]).toEqual(["IAD", "MCO"]);
    expect(dc.questions.some((q) => q.includes("Washington has more than one airport") && q.includes("DCA"))).toBe(true);
    const ny = read("New York to Miami, Mar 14-21 2027");
    expect([ny.origin, ny.destination]).toEqual(["JFK", "MIA"]);
  });
  it("still reads a single-airport route without questions about airports", () => {
    const c = read("Seattle to Orlando, Mar 14-21 2027");
    expect([c.origin, c.destination]).toEqual(["SEA", "MCO"]);
    expect(c.questions.some((q) => q.includes("airport;"))).toBe(false);
  });
});

describe("2. 'into X from Y'", () => {
  it("uses from/into instead of order", () => {
    const c = read("Flying into Orlando from Seattle, Mar 14-21 2027");
    expect([c.origin, c.destination]).toEqual(["SEA", "MCO"]);
    const d = read("Going to Denver from Boston Jan 5 to Jan 9");
    expect([d.origin, d.destination]).toEqual(["BOS", "DEN"]);
  });
});

describe("3. overnight flights", () => {
  const c = read("Seattle to Orlando Mar 14-21 2027. Land in Orlando by 6 pm.");
  const flight = (outArrive: string, outDepart = "2027-03-14T23:30"): FlightOffer =>
    ({
      stops: 0,
      outbound: { depart: outDepart, arrive: outArrive, flightNumbers: [] },
      inbound: { depart: "2027-03-21T12:00", arrive: "2027-03-21T15:00", flightNumbers: [] },
    }) as unknown as FlightOffer;

  it("rejects landing the next morning when the traveler said 'land by 6 pm'", () => {
    expect(passes(flightChecks(c, flight("2027-03-15T07:40")))).toBe(false);
  });
  it("accepts a same-day arrival", () => {
    expect(passes(flightChecks(c, flight("2027-03-14T15:00", "2027-03-14T07:00")))).toBe(true);
  });
  it("allows a red-eye when no arrival time was set, and labels it", () => {
    const any = read("Seattle to Orlando Mar 14-21 2027");
    const checks = flightChecks(any, flight("2027-03-15T07:40"));
    expect(passes(checks)).toBe(true);
    expect(checks.some((k) => k.label.includes("lands next day"))).toBe(true);
  });
  it("rejects a flight that leaves on another day", () => {
    expect(passes(flightChecks(c, flight("2027-03-15T15:00", "2027-03-15T07:00")))).toBe(false);
  });
});

describe("4. amenities in hotel listings", () => {
  it("doesn't treat paid or vague services as free", () => {
    expect(listingAmenities("parking | breakfast available for a fee | shuttle to theme parks")).toEqual([]);
    expect(listingAmenities("Free parking | Breakfast included | Airport shuttle").sort()).toEqual(["airport_shuttle", "free_breakfast", "free_parking"]);
  });
  it("still reads a traveler's own words loosely", () => {
    expect(amenitiesIn("we need parking and breakfast").sort()).toEqual(["free_breakfast", "free_parking"]);
  });
  it("marks a live hotel without 'free parking' as unconfirmed, not met", () => {
    const c = read("Seattle to Orlando Mar 14-21 2027. Must have free parking.");
    const h = { sample: false, lat: 28.43, lng: -81.31, stars: 4, rating: 9, bedrooms: 2, sqft: 800, amenities: listingAmenities("parking"), cash: 1 } as unknown as HotelOffer;
    expect(hotelChecks(c, h).at(-1)!.ok).toBeNull();
  });
});

describe("5. booking guide price rule", () => {
  const b = (rank: number, effective: number) => ({ rank, effective }) as Bundle;
  it("never gives a negative amount", () => {
    const list = [b(1, 2204), b(2, 2444), b(3, 2406)];
    const r = priceChangeRule(list, list[1]);
    expect(r.kind).toBe("cheaper-exists");
    const top = priceChangeRule(list, list[0]);
    expect(top).toMatchObject({ kind: "headroom", amount: 202 });
    expect(top.kind === "headroom" && top.than.rank).toBe(3);
  });
  it("handles a single match", () => {
    expect(priceChangeRule([b(1, 100)], b(1, 100)).kind).toBe("only");
  });
});

describe("6 and 7. ordering and a missing car", () => {
  it("flags bundles with no car when one was asked for, after confirmed ones", async () => {
    const c = read("Seattle to Orlando Mar 14-21 2027. Hotel within 8 miles. Midsize SUV.");
    const results = await Promise.all(["duffel_flights", "duffel_stays", "costco"].map((s) => runSource(s, c, DEFAULT_MEMBERSHIPS)));
    const bundles = rankBundles(c, results, DEFAULT_MEMBERSHIPS);
    const withoutCar = bundles.filter((x) => !x.car);
    expect(withoutCar.length).toBeGreaterThan(0);
    for (const x of withoutCar) expect(x.checks.some((k) => k.ok === null && k.label.includes("No car"))).toBe(true);
    // Packages with a car (all limits confirmed) come before the car-less bundles.
    const firstCarless = bundles.findIndex((x) => !x.car);
    expect(bundles.slice(0, firstCarless).every((x) => x.car)).toBe(true);
  });
});

describe("8. invalid dates", () => {
  it("asks about and blocks a return before departure", () => {
    const c = read("Seattle to Orlando Mar 21 to Mar 14 2027");
    expect(c.questions.some((q) => q.includes("return date"))).toBe(true);
    expect(searchBlocker({ ...c, departDate: "2027-03-21", returnDate: "2027-03-14" }, T)).toMatch(/after the departure/);
  });
  it("blocks past dates and passes good ones", () => {
    const c = read("Seattle to Orlando Mar 14-21 2027");
    expect(searchBlocker({ ...c, departDate: "2026-01-01", returnDate: "2026-01-05" }, T)).toMatch(/past/);
    expect(searchBlocker(c, T)).toBeNull();
  });
});

describe("9. results belong to the trip they were searched for", () => {
  it("changes the key when the trip or memberships change", () => {
    const trip: Trip = { text: "", criteria: read("Seattle to Orlando Mar 14-21 2027"), options: { limit: 5, sortBy: "effective" }, sources: ["b", "a"] };
    const k = tripKey(trip, DEFAULT_MEMBERSHIPS);
    expect(tripKey({ ...trip, sources: ["a", "b"] }, DEFAULT_MEMBERSHIPS)).toBe(k);
    expect(tripKey({ ...trip, criteria: { ...trip.criteria!, destination: "DEN" } }, DEFAULT_MEMBERSHIPS)).not.toBe(k);
    expect(tripKey(trip, DEFAULT_MEMBERSHIPS.map((m) => ({ ...m, centsPerPoint: 2 })))).not.toBe(k);
  });
  it("full sample search still returns sorted, fully confirmed matches", async () => {
    const c = read("Seattle to Orlando Mar 14-21 2027. Hotel within 8 miles, 4 stars. Midsize SUV.");
    const results = await Promise.all(listSources().map((s) => runSource(s.id, c, DEFAULT_MEMBERSHIPS)));
    const bundles = rankBundles(c, results, DEFAULT_MEMBERSHIPS);
    expect(bundles.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < bundles.length; i++) expect(bundles[i].effective).toBeGreaterThanOrEqual(bundles[i - 1].effective);
  });
});
