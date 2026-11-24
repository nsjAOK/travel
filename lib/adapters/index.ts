import type { Criteria, Membership, SourceResult } from "@/lib/types";
import { findAirport } from "@/lib/airports";
import { duffelFlights, duffelStays } from "./duffel";
import { MEMBERSHIP_SITES, openInBrowser } from "./membership";
import { sampleCars, sampleFlights, sampleHotels } from "./sample";
import { carBooking, flightBooking, hotelBooking } from "./links";

export type SourceInfo = { id: string; label: string; via: string; kind: "api" | "browser"; program?: string };

export function liveApis(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN);
}

export function listSources(): SourceInfo[] {
  return [
    { id: "duffel_flights", label: "Flights", via: "Duffel API", kind: "api" },
    { id: "duffel_stays", label: "Hotels", via: "Duffel API", kind: "api" },
    { id: "cars", label: "Rental cars", via: "Sample prices", kind: "api" },
    ...MEMBERSHIP_SITES.map((s) => ({ id: s.id, label: s.label, via: "Your browser", kind: "browser" as const, program: s.program })),
  ];
}

const empty = (source: string, label: string): SourceResult => ({
  source,
  label,
  status: "done",
  message: "",
  sample: false,
  flights: [],
  hotels: [],
  cars: [],
  packages: [],
});

export async function runSource(id: string, c: Criteria, memberships: Membership[]): Promise<SourceResult> {
  const info = listSources().find((s) => s.id === id);
  if (!info) throw new Error(`Unknown source ${id}`);
  const r = empty(id, info.label);
  const live = liveApis();

  if (!findAirport(c.destination) || !findAirport(c.origin)) {
    return { ...r, status: "error", message: `Unknown airport ${!findAirport(c.origin) ? c.origin || "(origin)" : c.destination || "(arrival)"}. Add it to lib/airports.ts.` };
  }

  try {
    if (id === "duffel_flights") {
      if (live) {
        r.flights = await duffelFlights(c);
        r.message = `${r.flights.length} live offers`;
      } else {
        r.sample = true;
        r.flights = sampleFlights(c).map((f) => ({ ...f, booking: flightBooking(c, f) }));
        r.message = `${r.flights.length} sample offers (add a Duffel token for live prices)`;
      }
      return r;
    }
    if (id === "duffel_stays") {
      if (live) {
        r.hotels = await duffelStays(c);
        r.message = `${r.hotels.length} live offers`;
      } else {
        r.sample = true;
        r.hotels = sampleHotels(c).map((h) => ({ ...h, booking: hotelBooking(c, h) }));
        r.message = `${r.hotels.length} sample offers (add a Duffel token for live prices)`;
      }
      return r;
    }
    if (id === "cars") {
      if (!c.car.needed) return { ...r, status: "skipped", message: "No car needed" };
      // No public car-rental API is connected yet; prices are samples in both modes.
      r.sample = true;
      r.cars = sampleCars(c).map((car) => ({ ...car, booking: carBooking(c, car) }));
      r.message = `${r.cars.length} sample offers (no car-rental API connected yet)`;
      return r;
    }

    const site = MEMBERSHIP_SITES.find((s) => s.id === id)!;
    const m = memberships.find((x) => x.id === site.program);
    if (!m || !m.enabled) return { ...r, status: "skipped", message: "Membership turned off" };
    if (!live) {
      const got = site.sample(c, m);
      Object.assign(r, got, { sample: true });
      const n = (got.flights?.length ?? 0) + (got.hotels?.length ?? 0) + (got.packages?.length ?? 0);
      r.message = `${n} sample offers`;
      return r;
    }
    const opened = await openInBrowser(site.url);
    return {
      ...r,
      status: "manual",
      message: opened ? "Opened in your browser. Check it with the steps below." : "This site can't be read automatically yet. Check it with the steps below.",
      manualSteps: { kind: "steps", site: site.label, url: site.url, steps: site.steps(c) },
    };
  } catch (err) {
    return { ...r, status: "error", message: (err as Error).message };
  }
}
