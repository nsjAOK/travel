// Turns every source's offers into ranked hotel + flight + car bundles.
import { carLabel } from "@/lib/cars";
import type { Booking, Bundle, CarOffer, Check, Criteria, FlightOffer, HotelOffer, Membership, PackageOffer, SourceResult } from "@/lib/types";
import { pointsValue } from "@/lib/memberships";
import { carChecks, confirmed, flightChecks, hotelChecks, hotelMiles, passes } from "./filter";

const SOURCE_LABELS: Record<string, string> = {
  duffel_flights: "direct",
  duffel_stays: "direct",
  cars: "direct",
  costco: "Costco Travel",
  chase: "Chase Travel",
  amex: "Amex Travel",
  marriott: "Marriott points",
  delta: "Delta miles",
};

export type RankOptions = { limit: number; sortBy: "effective" | "cash" | "points" };

type Priced = { cash: number; points: { program: string; points: number; value: number }[]; effective: number };

function priceOf(o: FlightOffer | HotelOffer, memberships: Membership[]): Priced {
  if (o.payment.kind === "points") {
    const value = pointsValue(memberships, o.payment.program, o.payment.points);
    return { cash: 0, points: [{ program: o.payment.program, points: o.payment.points, value }], effective: value };
  }
  return { cash: o.cash, points: [], effective: o.cash };
}

function withinBalances(points: Priced["points"], memberships: Membership[]): boolean {
  const used = new Map<string, number>();
  for (const p of points) used.set(p.program, (used.get(p.program) ?? 0) + p.points);
  return [...used].every(([program, n]) => {
    const m = memberships.find((x) => x.id === program);
    return m?.balance == null || n <= m.balance;
  });
}

function stepsFor(f: FlightOffer, h: HotelOffer, car: CarOffer | null): { title: string; booking: Booking }[] {
  const steps = [
    { title: `Flight · ${f.airline}`, booking: f.booking },
    { title: `Hotel · ${h.name}`, booking: h.booking },
  ];
  if (car) steps.push({ title: `Car · ${carLabel(car.vehicleClass)}`, booking: car.booking });
  return steps;
}

export function rankBundles(c: Criteria, results: SourceResult[], memberships: Membership[], opts: RankOptions = { limit: 5, sortBy: "effective" }): Bundle[] {
  const flights = results.flatMap((r) => r.flights).filter((f) => passes(flightChecks(c, f)));
  const hotels = results.flatMap((r) => r.hotels).filter((h) => passes(hotelChecks(c, h)));
  const cars = results.flatMap((r) => r.cars).filter((x) => passes(carChecks(c, x)));
  const packages = results.flatMap((r) => r.packages);

  const preferred = (f: FlightOffer) => c.flight.preferredAirlines.some((a) => f.airline.toLowerCase().includes(a.toLowerCase()));
  const byFlight = flights
    .map((f) => ({ f, p: priceOf(f, memberships) }))
    .sort((a, b) => a.p.effective - b.p.effective || Number(preferred(b.f)) - Number(preferred(a.f)));
  const car = c.car.needed ? [...cars].sort((a, b) => a.cash - b.cash)[0] ?? null : null;
  // A car was asked for but no source priced one: say so, and rank these after fully confirmed bundles.
  const noCar: Check[] = c.car.needed && !car ? [{ label: "No car priced: book one separately", ok: null }] : [];

  const bundles: Omit<Bundle, "rank">[] = [];

  // One bundle per hotel: the hotel with the best flight that keeps point balances valid.
  for (const h of hotels) {
    const hp = priceOf(h, memberships);
    const pick = byFlight.find(({ p }) => withinBalances([...p.points, ...hp.points], memberships));
    if (!pick) continue;
    const { f, p: fp } = pick;
    const cash = fp.cash + hp.cash + (car?.cash ?? 0);
    const pointsUsed = [...fp.points, ...hp.points];
    const rewards = h.credit;
    const effective = cash + pointsUsed.reduce((s, x) => s + x.value, 0) - rewards;
    const sources = [...new Set([f.source, h.source, car?.source].filter(Boolean).map((s) => SOURCE_LABELS[s!] ?? s!))];
    bundles.push({
      title: h.name,
      via: sources.filter((s) => s !== "direct").concat(sources.includes("direct") ? ["direct"] : []).join(" + "),
      flight: f,
      hotel: h,
      car,
      packageId: null,
      cash,
      pointsUsed,
      rewards,
      effective,
      milesFromAirport: hotelMiles(c, h),
      checks: [...hotelChecks(c, h), ...flightChecks(c, f), ...(car ? carChecks(c, car) : noCar)],
      steps: stepsFor(f, h, car),
      sample: f.sample || h.sample || Boolean(car?.sample),
    });
  }

  for (const pk of packages as PackageOffer[]) {
    const checks = [...hotelChecks(c, pk.hotel), ...flightChecks(c, pk.flight), ...(pk.car ? carChecks(c, pk.car) : [])];
    if (!passes(checks)) continue;
    if (c.car.needed && !pk.car) continue;
    const rewards = Math.round(pk.cash * pk.rewardRate);
    bundles.push({
      title: pk.hotel.name,
      via: `${SOURCE_LABELS[pk.source] ?? pk.source} package`,
      flight: pk.flight,
      hotel: pk.hotel,
      car: pk.car,
      packageId: pk.id,
      cash: pk.cash,
      pointsUsed: [],
      rewards,
      effective: pk.cash - rewards,
      milesFromAirport: hotelMiles(c, pk.hotel),
      checks,
      steps: [{ title: `Package · ${SOURCE_LABELS[pk.source] ?? pk.source}`, booking: pk.booking }],
      sample: pk.sample,
    });
  }

  const key = (b: Omit<Bundle, "rank">) =>
    opts.sortBy === "cash" ? b.cash : opts.sortBy === "points" ? b.pointsUsed.reduce((s, x) => s + x.points, 0) * 1e6 + b.effective : b.effective;

  const inBudget = bundles.filter((b) => c.maxBudget === null || b.effective <= c.maxBudget);
  // Bundles whose every limit is confirmed come first; unconfirmed ones only fill gaps.
  const sorted = [...inBudget.filter((b) => confirmed(b.checks)).sort((a, b) => key(a) - key(b)), ...inBudget.filter((b) => !confirmed(b.checks)).sort((a, b) => key(a) - key(b))];

  // At most one bundle per hotel.
  const seen = new Set<string>();
  const out: Bundle[] = [];
  for (const b of sorted) {
    const k = b.hotel.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...b, rank: out.length + 1 });
    if (out.length >= opts.limit) break;
  }
  return out;
}

export type PriceRule =
  | { kind: "headroom"; amount: number; than: Bundle } // still the best deal unless the price rises by `amount`
  | { kind: "cheaper-exists"; than: Bundle } // another match already costs less overall (it ranked lower for another reason)
  | { kind: "only" };

/**
 * How much a bundle's price may rise before another match becomes the better
 * deal, by effective cost. Compares against the cheapest OTHER match, not the
 * next rank, because ranks can follow cash, points or confirmed limits.
 */
export function priceChangeRule(bundles: Bundle[], b: Bundle): PriceRule {
  const others = bundles.filter((x) => x !== b && x.rank !== b.rank);
  if (others.length === 0) return { kind: "only" };
  const than = others.reduce((m, x) => (x.effective < m.effective ? x : m));
  return than.effective > b.effective ? { kind: "headroom", amount: than.effective - b.effective, than } : { kind: "cheaper-exists", than };
}
