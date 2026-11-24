// Reads a free-text trip description with Claude (server side) and returns Criteria.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Criteria } from "@/lib/types";
import { AMENITIES } from "@/lib/amenities";
import { readerInstructions, toCriteria } from "./shared";

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

export class ParseRefusedError extends Error {}

export async function parseWithClaude(text: string, today = new Date()): Promise<Criteria> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(TripSchema) },
    system: readerInstructions(today.toISOString().slice(0, 10)),
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal") throw new ParseRefusedError("Claude declined to read this description.");
  if (!response.parsed_output) throw new Error(`Could not read the trip description (stop reason: ${response.stop_reason}).`);
  return toCriteria(response.parsed_output);
}
