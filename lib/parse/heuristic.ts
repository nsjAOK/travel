// A rule-based reader for trip descriptions. It's used when no Claude API key
// is set, and it handles the common phrasings. The Claude reader in
// ./claude.ts is much more forgiving.
import type { Criteria, CarClass, TimeWindow } from "@/lib/types";
import { AIRPORTS } from "@/lib/airports";
import { amenitiesIn } from "@/lib/amenities";
import { emptyCriteria, missingQuestions, ANY_TIME } from "./defaults";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const AIRLINES = ["Delta", "Alaska", "United", "American", "Southwest", "JetBlue", "Spirit", "Frontier", "Hawaiian", "Air Canada"];

function num(s: string | undefined): number | null {
  if (!s) return null;
  const w = WORD_NUM[s.toLowerCase()];
  if (w) return w;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "6", "6 am", "11:30pm", "noon" -> "HH:MM". `defaultPm` handles "between 6 and 11 am". */
export function toClock(raw: string, meridiem?: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] ?? meridiem ?? "").replace(/\./g, "");
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

const TIME = String.raw`(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon|midnight)`;

/** Read a time window for one verb group ("leave|depart" or "land|arrive") inside one sentence. */
function windowFor(sentence: string, verbs: string): TimeWindow | null {
  const s = sentence.toLowerCase();
  const between = new RegExp(String.raw`(?:${verbs})[^.;]*?between\s+${TIME}\s+(?:and|to|-|–)\s+${TIME}`).exec(s);
  if (between) {
    const mer = between[2].match(/am|pm/)?.[0];
    const a = toClock(between[1], /am|pm/.test(between[1]) ? undefined : mer);
    const b = toClock(between[2]);
    if (a && b) return { from: a, to: b };
  }
  const after = new RegExp(String.raw`(?:${verbs})[^.;]*?(?:after|from)\s+${TIME}`).exec(s);
  const before = new RegExp(String.raw`(?:${verbs})[^.;]*?(?:before|by|until)\s+${TIME}`).exec(s);
  if (after || before) {
    return {
      from: (after && toClock(after[1])) || ANY_TIME.from,
      to: (before && toClock(before[1])) || ANY_TIME.to,
    };
  }
  return null;
}

function findAirports(text: string): string[] {
  const hits: { code: string; at: number }[] = [];
  const lower = text.toLowerCase();
  for (const a of AIRPORTS) {
    const codeAt = text.search(new RegExp(String.raw`\b${a.code}\b`));
    if (codeAt >= 0) hits.push({ code: a.code, at: codeAt });
    for (const alias of [a.city.toLowerCase(), ...a.aliases]) {
      if (alias.length < 3) continue;
      const at = lower.search(new RegExp(String.raw`\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`));
      if (at >= 0) hits.push({ code: a.code, at });
    }
  }
  hits.sort((x, y) => x.at - y.at);
  return [...new Set(hits.map((h) => h.code))];
}

function findDates(text: string, today: Date): { depart: string; ret: string } | null {
  const iso = [...text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map((m) => m[0]);
  if (iso.length >= 2) return { depart: iso[0], ret: iso[1] };

  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:-|–|to|through|thru)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?)?,?\s*(\d{4})?/i;
  const m = re.exec(text);
  if (!m) return null;
  const m1 = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
  const d1 = parseInt(m[2], 10);
  let year = m[5] ? parseInt(m[5], 10) : today.getFullYear();
  if (!m[5] && new Date(year, m1, d1) < today) year += 1;
  let m2 = m1;
  let d2: number | null = m[4] ? parseInt(m[4], 10) : null;
  if (m[3]) m2 = MONTHS.indexOf(m[3].toLowerCase().slice(0, 3));

  if (d2 === null) {
    // A second, separate date: "return March 21"
    const rest = text.slice(m.index + m[0].length);
    const m2match = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i.exec(rest);
    if (!m2match) return null;
    m2 = MONTHS.indexOf(m2match[1].toLowerCase().slice(0, 3));
    d2 = parseInt(m2match[2], 10);
  }
  const y2 = m2 < m1 ? year + 1 : year;
  return { depart: `${year}-${pad(m1 + 1)}-${pad(d1)}`, ret: `${y2}-${pad(m2 + 1)}-${pad(d2)}` };
}

const CAR_WORDS: [RegExp, CarClass][] = [
  [/full[- ]?size suv|large suv/i, "fullsize_suv"],
  [/(mid[- ]?size |standard |small )?suv/i, "midsize_suv"],
  [/minivan|mini-van/i, "minivan"],
  [/full[- ]?size/i, "fullsize"],
  [/mid[- ]?size|intermediate/i, "midsize"],
  [/compact/i, "compact"],
  [/economy car/i, "economy"],
  [/luxury|premium car/i, "luxury"],
];

export function parseHeuristic(text: string, today = new Date()): Criteria {
  const c = emptyCriteria();
  const lower = text.toLowerCase();
  const sentences = text.split(/(?<=[.!?;])\s+|\n+/);

  // Airports: "X to Y" order wins; otherwise first mention is the origin.
  const codes = findAirports(text);
  if (codes.length >= 2) {
    c.origin = codes[0];
    c.destination = codes[1];
  } else if (codes.length === 1) {
    c.destination = codes[0];
  }

  const dates = findDates(text, today);
  if (dates) {
    c.departDate = dates.depart;
    c.returnDate = dates.ret;
  }
  const flex = lower.match(/(?:give or take|plus or minus|±|\+\/-)\s*(?:a|one|(\d+))?\s*day/);
  if (flex) c.dateFlexDays = flex[1] ? parseInt(flex[1], 10) : 1;

  // Travelers
  const adults = lower.match(/(\d+|one|two|three|four|five|six)\s+adults?/);
  if (adults) c.adults = num(adults[1]) ?? 1;
  const kidAges = lower.match(/(?:kids|children|sons?|daughters?)\s*(?:aged?|ages)?\s*\(?((?:\d{1,2}(?:\s*(?:,|and|&)\s*)?)+)/);
  if (kidAges) c.childAges = (kidAges[1].match(/\d{1,2}/g) ?? []).map(Number);
  else {
    const kids = lower.match(/(\d+|one|two|three|four)\s+(?:kids|children)/);
    if (kids) c.childAges = Array(num(kids[1]) ?? 0).fill(10);
  }
  const familyOf = lower.match(/(?:family|group|party) of (\d+|two|three|four|five|six)/);
  if (familyOf && !adults) {
    const total = num(familyOf[1]) ?? 2;
    c.adults = Math.max(1, total - c.childAges.length);
  }

  // Hotel
  const miles = lower.match(/within\s+(\d+(?:\.\d+)?)\s*(?:mi|miles?)/);
  if (miles) c.hotel.maxMilesFromAirport = parseFloat(miles[1]);
  const stars = lower.match(/(\d(?:\.5)?)\s*(?:\+\s*)?(?:-|\s)?stars?/) ?? lower.match(/(\d(?:\.5)?)★/);
  if (stars) c.hotel.minStars = parseFloat(stars[1]);
  const rating = lower.match(/rat(?:ed|ing)(?: of)?\s*(?:at least\s*)?(\d(?:\.\d)?)/);
  if (rating) c.hotel.minRating = parseFloat(rating[1]);
  const beds = lower.match(/(\d|one|two|three|four)\s*(?:\+\s*)?(?:-|\s)?(?:bedrooms?|br\b)/);
  if (beds) c.hotel.minBedrooms = num(beds[1]);
  const sqft = lower.match(/(\d{3,4})\s*(?:\+\s*)?(?:sq\.?\s*ft|square feet|sqft)/);
  if (sqft) c.hotel.minSqft = parseInt(sqft[1], 10);
  const amenitySentences = sentences.filter((s) => /must have|with|amenit|need|want|include/i.test(s) && !/flight|fly|car\b|suv/i.test(s));
  c.hotel.amenities = amenitiesIn(amenitySentences.join(" "));

  // Flight
  if (/business class|\bbusiness\b/.test(lower)) c.flight.cabin = "business";
  else if (/first class/.test(lower)) c.flight.cabin = "first";
  else if (/premium economy/.test(lower)) c.flight.cabin = "premium_economy";
  if (/non-?stop|direct flights?/.test(lower) && !/(\d)\s*stops?/.test(lower)) c.flight.maxStops = 0;
  const stops = lower.match(/(\d|one|two)\s*stops?\s*max|max(?:imum)?\s*(?:of\s*)?(\d|one|two)\s*stops?|up to\s*(\d|one|two)\s*stops?/);
  if (stops) c.flight.maxStops = num(stops[1] ?? stops[2] ?? stops[3]) ?? 1;
  c.flight.preferredAirlines = AIRLINES.filter((a) => lower.includes(a.toLowerCase()));
  const bags = lower.match(/(\d|one|two|three|four|no)\s+(?:checked\s+)?bags?/);
  if (bags) c.flight.checkedBags = bags[1] === "no" ? 0 : num(bags[1]);
  else if (/carry-?on only|no checked/.test(lower)) c.flight.checkedBags = 0;

  for (const s of sentences) {
    const inbound = /coming home|return|way back|fly(?:ing)? back|head(?:ing)? home/i.test(s);
    const leg = inbound ? c.flight.inbound : c.flight.outbound;
    // Split "leave after 11 am and land by 9 pm" into one clause per verb.
    const clauses = s.split(/,|\band\s+(?=(?:land|arriv|leav|depart|get in|be in|take off))/i);
    for (const clause of clauses) {
      const dep = windowFor(clause, "leave|leaving|depart|departing|take off|wheels up");
      const arr = windowFor(clause, "land|landing|arrive|arriving|get in|be in");
      if (dep) leg.depart = dep;
      if (arr) leg.arrive = arr;
    }
  }

  // Car
  if (/no car|don't need a car|do not need a car|without a car/.test(lower)) c.car.needed = false;
  else for (const [re, cls] of CAR_WORDS) if (re.test(text)) { c.car.vehicleClass = cls; break; }

  const budget = lower.match(/(?:under|below|budget(?: of| is)?|max(?:imum)?(?: of)?|no more than)\s*\$\s*([\d,]+)/);
  if (budget) c.maxBudget = parseInt(budget[1].replace(/,/g, ""), 10);
  if (/refundable/.test(lower)) c.notes.push("Refundable fares and rates preferred");

  c.questions = missingQuestions(c);
  return c;
}
