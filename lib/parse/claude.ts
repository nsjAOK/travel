// Reads a free-text trip description with Claude and returns Criteria.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Criteria } from "@/lib/types";
import { AIRPORTS } from "@/lib/airports";
import { AMENITIES } from "@/lib/amenities";
import { emptyCriteria, missingQuestions, ANY_TIME } from "./defaults";

const MODEL = "claude-opus-5-5";

const Window = z.object({
  from: z.string().describe("24h HH:MM; 00:00 if no lower limit"),
  to: z.string().describe("24h HH:MM; 23:59 if no upper limit"),
});

const TripSchema = z.object({
  origin: z.string().nullable().describe("IATA code of the departure airport, or null if not stated"),
  destination: z.string().nullable().describe("IATA code of the arrival airport the hotel must be near, or null"),
  departDate: z.string().nullable().describe("YYYY-MM-DD"),
  returnDate: z.string().nullable().describe("YYYY-MM-DD"),
  dateFlexDays: z.number().int(),
  adults: z.number().int(),
  childAges: z.array(z.number().int()).describe("one entry per child; use 10 if an age isn't given"),
  hotel: z.object({
    maxMilesFromAirport: z.number().nullable(),
    minStars: z.number().nullable(),
    minRating: z.number().nullable().describe("guest rating on a 10-point scale; convert 4.5/5 to 9.0"),
    minBedrooms: z.number().int().nullable(),
    minSqft: z.number().int().nullable(),
    amenities: z.array(z.enum(AMENITIES.map((a) => a.key) as [string, ...string[]])),
  }),
  flight: z.object({
    cabin: z.enum(["economy", "premium_economy", "business", "first"]),
    maxStops: z.number().int(),
    preferredAirlines: z.array(z.string()),
    checkedBags: z.number().int().nullable().describe("total checked bags for the group, null if not mentioned"),
    outboundDepart: Window,
    outboundArrive: Window,
    returnDepart: Window,
    returnArrive: Window,
  }),
  car: z.object({
    needed: z.boolean(),
    vehicleClass: z.enum(["economy", "compact", "midsize", "fullsize", "midsize_suv", "fullsize_suv", "minivan", "luxury"]).nullable(),
  }),
  maxBudget: z.number().nullable().describe("total trip budget in USD, or null"),
  notes: z.array(z.string()).describe("wishes that don't fit any field above, short phrases"),
  questions: z.array(z.string()).describe("short questions about anything important that is ambiguous"),
});

function systemPrompt(today: string): string {
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
  ].join("\n");
}

export class ParseRefusedError extends Error {}

export async function parseWithClaude(text: string, today = new Date()): Promise<Criteria> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(TripSchema) },
    system: systemPrompt(today.toISOString().slice(0, 10)),
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal") throw new ParseRefusedError("Claude declined to read this description.");
  const p = response.parsed_output;
  if (!p) throw new Error(`Could not read the trip description (stop reason: ${response.stop_reason}).`);

  const c = emptyCriteria();
  c.origin = (p.origin ?? "").toUpperCase();
  c.destination = (p.destination ?? "").toUpperCase();
  c.departDate = p.departDate ?? "";
  c.returnDate = p.returnDate ?? "";
  c.dateFlexDays = Math.max(0, p.dateFlexDays);
  c.adults = Math.max(1, p.adults);
  c.childAges = p.childAges;
  c.hotel = {
    ...c.hotel,
    maxMilesFromAirport: p.hotel.maxMilesFromAirport ?? c.hotel.maxMilesFromAirport,
    minStars: p.hotel.minStars,
    minRating: p.hotel.minRating,
    minBedrooms: p.hotel.minBedrooms,
    minSqft: p.hotel.minSqft,
    amenities: p.hotel.amenities,
  };
  const w = (x: { from: string; to: string }) => ({ from: x.from || ANY_TIME.from, to: x.to || ANY_TIME.to });
  c.flight = {
    cabin: p.flight.cabin,
    maxStops: Math.max(0, p.flight.maxStops),
    preferredAirlines: p.flight.preferredAirlines,
    checkedBags: p.flight.checkedBags,
    outbound: { depart: w(p.flight.outboundDepart), arrive: w(p.flight.outboundArrive) },
    inbound: { depart: w(p.flight.returnDepart), arrive: w(p.flight.returnArrive) },
  };
  c.car = { needed: p.car.needed, vehicleClass: p.car.vehicleClass };
  c.maxBudget = p.maxBudget;
  c.notes = p.notes;
  c.questions = [...new Set([...p.questions, ...missingQuestions(c)])];
  return c;
}
