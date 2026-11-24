import { describe, it, expect } from "vitest";
import { parseHeuristic } from "@/lib/parse/heuristic";
import { runSource, listSources } from "@/lib/adapters";
import { rankBundles } from "@/lib/engine/rank";
import { inWindow, hotelChecks, passes } from "@/lib/engine/filter";
import { DEFAULT_MEMBERSHIPS } from "@/lib/memberships";
import type { HotelOffer } from "@/lib/types";

const TRIP =
  "Family of four (2 adults, kids 8 and 11) flying Seattle to Orlando, Mar 14–21 2027. Hotel within 8 miles of MCO, at least 4 stars and rated 8.5 or better, " +
  "with 2 bedrooms or at least 600 sq ft. Must have free breakfast, a pool and free parking. Economy, 1 stop max. Leave Seattle between 6 and 11 am and land in Orlando by 6 pm. " +
  "Coming home, leave after 11 am and land in Seattle by 9 pm. Prefer Delta or Alaska. Midsize SUV. 2 checked bags.";

describe("time windows", () => {
  it("handles normal and overnight windows", () => {
    expect(inWindow("2027-03-14T07:05", { from: "06:00", to: "11:00" })).toBe(true);
    expect(inWindow("2027-03-14T11:30", { from: "06:00", to: "11:00" })).toBe(false);
    expect(inWindow("2027-03-14T23:30", { from: "22:00", to: "02:00" })).toBe(true);
  });
});

describe("hotel limits", () => {
  const c = parseHeuristic(TRIP, new Date("2026-11-24"));
  const base: HotelOffer = {
    id: "h", source: "t", sample: true, name: "H", lat: 28.44, lng: -81.31, stars: 4, rating: 9, bedrooms: 1, sqft: 650,
    roomName: "", amenities: ["free_breakfast", "pool", "free_parking"], cash: 1000, payment: { kind: "cash" }, credit: 0,
    booking: { kind: "steps", site: "", steps: [] },
  };
  it("accepts 1 bedroom when square feet meet the limit", () => expect(passes(hotelChecks(c, base))).toBe(true));
  it("rejects too far, too few stars, small rooms, missing amenities", () => {
    expect(passes(hotelChecks(c, { ...base, lat: 28.7 }))).toBe(false);
    expect(passes(hotelChecks(c, { ...base, stars: 3.5 }))).toBe(false);
    expect(passes(hotelChecks(c, { ...base, sqft: 400 }))).toBe(false);
    expect(passes(hotelChecks(c, { ...base, amenities: ["pool"] }))).toBe(false);
  });
  it("treats missing data on live listings as unconfirmed, not failed", () => {
    const checks = hotelChecks(c, { ...base, sample: false, stars: null, amenities: [] });
    expect(passes(checks)).toBe(true);
    expect(checks.some((k) => k.ok === null)).toBe(true);
  });
});

describe("end to end on sample data", async () => {
  const c = parseHeuristic(TRIP, new Date("2026-11-24"));
  const results = await Promise.all(listSources().map((s) => runSource(s.id, c, DEFAULT_MEMBERSHIPS)));
  const bundles = rankBundles(c, results, DEFAULT_MEMBERSHIPS, { limit: 5, sortBy: "effective" });

  it("returns 3-5 ranked bundles that meet every limit", () => {
    expect(bundles.length).toBeGreaterThanOrEqual(3);
    expect(bundles.length).toBeLessThanOrEqual(5);
    for (const b of bundles) expect(b.checks.every((k) => k.ok !== false)).toBe(true);
    for (let i = 1; i < bundles.length; i++) expect(bundles[i].effective).toBeGreaterThanOrEqual(bundles[i - 1].effective);
  });

  it("gives every bundle a way to book", () => {
    for (const b of bundles) {
      expect(b.steps.length).toBeGreaterThan(0);
      for (const s of b.steps) expect(s.booking.kind === "link" ? s.booking.url : s.booking.steps.length).toBeTruthy();
    }
  });

  it("never spends more points than a balance holds", () => {
    for (const b of bundles)
      for (const p of b.pointsUsed) {
        const m = DEFAULT_MEMBERSHIPS.find((x) => x.id === p.program)!;
        expect(p.points).toBeLessThanOrEqual(m.balance!);
      }
  });

  it("prints the matches", () => {
    for (const r of results) console.log(`${r.label}: ${r.status} ${r.message}`);
    for (const b of bundles) console.log(`#${b.rank} $${b.effective} ${b.title} via ${b.via} | ${b.flight.airline} ${b.flight.outbound.depart.slice(11)}`);
  });
});
