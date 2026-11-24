// Membership and rewards sites. None of them offer a public API, so:
//  - in sample mode they return clearly labelled sample offers that show how
//    each program changes the price;
//  - in live mode they return step-by-step instructions, and (on your own
//    computer, with MEMBERSHIP_BROWSER=1) open the site in a browser window
//    that keeps your sign-ins. Reading prices off these pages automatically is
//    the next step; it needs each site's current page layout.
import type { Booking, Criteria, FlightOffer, HotelOffer, Membership, PackageOffer, SourceResult } from "@/lib/types";
import { findAirport } from "@/lib/airports";
import { carLabel } from "@/lib/cars";
import { carRank, nights, sampleCars, sampleFlights, sampleHotels } from "./sample";
import { carBooking, flightBooking, fmtDate, fmtTime, hotelBooking, travelersText } from "./links";
import { flightChecks, hotelMiles, passes } from "@/lib/engine/filter";

export type MembershipSite = {
  id: string;
  label: string;
  program: string; // membership id it needs
  url: string;
  steps: (c: Criteria) => string[];
  sample: (c: Criteria, m: Membership) => Partial<Pick<SourceResult, "flights" | "hotels" | "packages">>;
};

const city = (c: Criteria) => findAirport(c.destination)?.city ?? c.destination;
const dates = (c: Criteria) => `${fmtDate(c.departDate)} – ${fmtDate(c.returnDate)}`;

// Portals redeem points at a fixed rate per point; these are typical card rates.
const PORTAL_CENTS: Record<string, number> = { chase_ur: 1.5, amex_mr: 1.0 };

function cheapestFlights(c: Criteria, seed: string, n = 3): FlightOffer[] {
  return sampleFlights(c)
    .filter((f) => passes(flightChecks(c, f)))
    .sort((a, b) => a.cash - b.cash)
    .slice(0, n)
    .map((f) => ({ ...f, id: `${seed}-${f.id}` }));
}

function goodHotels(c: Criteria, seed: string, n = 4): HotelOffer[] {
  // Sample hotels nudged to meet the traveler's limits, so each program shows up.
  const seedOffset = seed.length % 3;
  return sampleHotels(c)
    .filter((h) => hotelMiles(c, h) <= c.hotel.maxMilesFromAirport)
    .slice(seedOffset * n, seedOffset * n + n)
    .map((h, i) => ({
      ...h,
      id: `${seed}-${h.id}`,
      stars: Math.max(h.stars ?? 0, c.hotel.minStars ?? 0),
      rating: Math.max(h.rating ?? 0, c.hotel.minRating ?? 0) + 0.1 * i,
      bedrooms: Math.max(h.bedrooms ?? 0, c.hotel.minBedrooms ?? 0),
      sqft: Math.max(h.sqft ?? 0, c.hotel.minSqft ?? 0, 600),
      roomName: `${Math.max(h.bedrooms ?? 0, c.hotel.minBedrooms ?? 1, 1)}-bedroom suite`,
      amenities: [...new Set([...h.amenities, ...c.hotel.amenities])],
    }));
}

export const MEMBERSHIP_SITES: MembershipSite[] = [
  {
    id: "costco",
    label: "Costco Travel",
    program: "costco",
    url: "https://www.costcotravel.com",
    steps: (c) => [
      "Sign in at costcotravel.com with your membership.",
      `Choose Vacation Packages → Flight + Hotel${c.car.needed ? " + Car" : ""}. Enter ${c.origin} to ${c.destination}, ${dates(c)}, ${travelersText(c)}.`,
      `Filter hotels to ${c.hotel.minStars ?? 3}+ stars near ${c.destination} airport and compare suites with ${c.hotel.minBedrooms ?? 1}+ bedrooms.`,
      "Note the package total (it includes taxes) and compare it with the matches here.",
    ],
    sample: (c) => {
      const f = cheapestFlights(c, "costco", 1)[0];
      const hs = goodHotels(c, "costco", 2);
      const car = c.car.needed ? sampleCars(c).filter((x) => !c.car.vehicleClass || carRank(x.vehicleClass) >= carRank(c.car.vehicleClass)).sort((a, b) => a.cash - b.cash)[0] : null;
      if (!f) return {};
      const packages: PackageOffer[] = hs.map((h, i) => {
        const cash = Math.round((f.cash + h.cash + (car?.cash ?? 0)) * (0.9 + i * 0.03));
        const booking: Booking = {
          kind: "steps",
          site: "Costco Travel",
          url: "https://www.costcotravel.com",
          steps: [
            "Sign in at costcotravel.com with your membership.",
            `Choose Vacation Packages → Flight + Hotel${car ? " + Car" : ""}. Enter ${c.origin} to ${c.destination}, ${dates(c)}, ${travelersText(c)}.`,
            `In the hotel list, search for “${h.name}” and pick the ${h.roomName}.`,
            `Pick the ${f.airline} flight leaving ${fmtTime(f.outbound.depart)} and returning at ${fmtTime(f.inbound.depart)}.`,
            ...(car ? [`Add a ${carLabel(car.vehicleClass).toLowerCase().replace("suv", "SUV")}, picked up at the ${c.destination} counter.`] : []),
            `Check the total is $${cash.toLocaleString("en-US")} or less before you pay. If it's higher, search again here first.`,
          ],
        };
        return { id: `costco-pkg-${i}`, source: "costco", sample: true, flight: { ...f, source: "costco" }, hotel: { ...h, source: "costco" }, car: car ? { ...car, source: "costco" } : null, cash, rewardRate: 0.02, booking };
      });
      return { packages };
    },
  },
  {
    id: "chase",
    label: "Chase Travel",
    program: "chase_ur",
    url: "https://www.chase.com",
    steps: (c) => [
      "Sign in at chase.com and open Chase Travel from your card's page.",
      `Search Flights, round trip ${c.origin} → ${c.destination}, ${dates(c)}, ${travelersText(c)}.`,
      "Note the price in points for flights that fit your times, then do the same under Hotels.",
    ],
    sample: (c, m) => {
      const rate = PORTAL_CENTS.chase_ur;
      const flights = cheapestFlights(c, "chase", 3)
        .map((f) => ({ ...f, source: "chase", payment: { kind: "points" as const, program: "chase_ur", points: Math.round((f.cash * 100) / rate / 100) * 100 } }))
        .filter((f) => f.payment.points <= (m.balance ?? Infinity))
        .map((f) => ({
          ...f,
          booking: {
            kind: "steps" as const,
            site: "Chase Travel",
            url: "https://www.chase.com",
            steps: [
              "Sign in at chase.com and open Chase Travel from your card's page.",
              `Choose Flights → Round trip. Enter ${c.origin} to ${c.destination}, ${dates(c)}, ${travelersText(c)}.`,
              `Pick ${f.airline} ${f.outbound.flightNumbers.join(" + ")} leaving ${fmtTime(f.outbound.depart)}, returning on ${f.inbound.flightNumbers.join(" + ")} at ${fmtTime(f.inbound.depart)}.`,
              `At checkout, use ${f.payment.points.toLocaleString("en-US")} points to cover the full fare.`,
              "Add your frequent flyer numbers so the trip still earns miles.",
            ],
          },
        }));
      return { flights };
    },
  },
  {
    id: "amex",
    label: "Amex Travel",
    program: "amex_mr",
    url: "https://www.amextravel.com",
    steps: (c) => [
      "Sign in at amextravel.com.",
      `Search Hotels near ${c.destination} airport for ${dates(c)}, ${travelersText(c)}. Look for hotels that show a property credit or other perks.`,
      "Note the total and the perks, then compare.",
    ],
    sample: (c) => {
      const hotels = goodHotels(c, "amex", 2).map((h) => ({
        ...h,
        source: "amex",
        cash: Math.round(h.cash * 1.04),
        credit: 100,
        booking: {
          kind: "steps" as const,
          site: "Amex Travel",
          url: "https://www.amextravel.com",
          steps: [
            "Sign in at amextravel.com with your card account.",
            `Under Hotels, search “${h.name}” for ${dates(c)}, ${travelersText(c)}.`,
            `Pick the ${h.roomName} rate that shows the $100 property credit.`,
            "Pay with your card; the credit is used at the hotel during your stay.",
          ],
        },
      }));
      return { hotels };
    },
  },
  {
    id: "marriott",
    label: "Marriott Bonvoy",
    program: "marriott",
    url: "https://www.marriott.com",
    steps: (c) => [
      "Sign in at marriott.com.",
      `Search ${city(c)} for ${dates(c)} with “Use Points” turned on.`,
      "Note the points price for hotels close to the airport; stays of 5 nights get the 5th night free.",
    ],
    sample: (c, m) => {
      const n = nights(c);
      const free = Math.floor(n / 5);
      const hotels = goodHotels(c, "marriott", 2)
        .map((h, i) => {
          const points = (n - free) * (30000 + i * 5000);
          return {
            ...h,
            source: "marriott",
            payment: { kind: "points" as const, program: "marriott", points },
            booking: {
              kind: "steps" as const,
              site: "Marriott Bonvoy",
              url: "https://www.marriott.com",
              steps: [
                "Sign in at marriott.com.",
                `Search ${city(c)}, ${dates(c)}, with “Use Points” turned on.`,
                `Pick ${h.name}, ${h.roomName}. It should cost ${points.toLocaleString("en-US")} points${free ? " with the 5th night free" : ""}.`,
              ],
            },
          };
        })
        .filter((h) => h.payment.points <= (m.balance ?? Infinity));
      return { hotels };
    },
  },
  {
    id: "delta",
    label: "Delta SkyMiles",
    program: "delta",
    url: "https://www.delta.com",
    steps: (c) => [
      "Sign in at delta.com.",
      `Search ${c.origin} → ${c.destination}, ${dates(c)}, and switch “Shop with Miles” on.`,
      "Note the miles price for flights that fit your times.",
    ],
    sample: (c, m) => {
      const flights = cheapestFlights(c, "delta", 4)
        .filter((f) => f.airline === "Delta")
        .map((f) => {
          const points = Math.round(f.cash / 0.0125 / 1000) * 1000;
          return {
            ...f,
            source: "delta",
            payment: { kind: "points" as const, program: "delta", points },
            booking: {
              kind: "steps" as const,
              site: "Delta SkyMiles",
              url: "https://www.delta.com",
              steps: [
                "Sign in at delta.com.",
                `Search ${c.origin} → ${c.destination}, ${dates(c)}, ${travelersText(c)}, with “Shop with Miles” on.`,
                `Pick ${f.outbound.flightNumbers.join(" + ")} and return ${f.inbound.flightNumbers.join(" + ")}. It should cost ${points.toLocaleString("en-US")} miles plus taxes.`,
              ],
            },
          };
        })
        .filter((f) => f.payment.points <= (m.balance ?? Infinity));
      return { flights };
    },
  },
];

/** Open a site in a browser that keeps your sign-ins. Only on your own computer. */
export async function openInBrowser(url: string): Promise<boolean> {
  if (process.env.MEMBERSHIP_BROWSER !== "1") return false;
  try {
    // Playwright is optional (npm install playwright on your own computer), so load it by name at runtime.
    const pkg = "playwright";
    type Pw = { chromium: { launchPersistentContext(dir: string, o: { headless: boolean }): Promise<{ newPage(): Promise<{ goto(u: string): Promise<unknown> }> }> } };
    const { chromium } = (await import(/* webpackIgnore: true */ pkg)) as Pw;
    const ctx = await chromium.launchPersistentContext(".browser-profile", { headless: false });
    const page = await ctx.newPage();
    await page.goto(url);
    return true; // the window stays open for you
  } catch {
    return false;
  }
}

// Re-exported so booking guides can build the same instructions.
export { carBooking, flightBooking, hotelBooking };
