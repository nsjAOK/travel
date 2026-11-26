"use client";
// Small wrappers around browser storage. Storage can be unavailable (private
// windows, blocked site data), so every call is guarded.
import type { Bundle, Criteria, Membership, SourceResult } from "@/lib/types";
import type { RankOptions } from "@/lib/engine/rank";
import { DEFAULT_MEMBERSHIPS } from "@/lib/memberships";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable; the app still works for this page view */
  }
}

export type Trip = { text: string; criteria: Criteria | null; reader?: string; options: RankOptions; sources: string[] };
export type Booked = Record<string, { done: boolean; confirmation: string }>;

export const loadMemberships = () => read<Membership[]>("bf-memberships", DEFAULT_MEMBERSHIPS);
export const saveMemberships = (m: Membership[]) => write("bf-memberships", m);
export const loadTrip = () => read<Trip | null>("bf-trip", null);
export const saveTrip = (t: Trip) => write("bf-trip", t);
/** A finished search, saved with the exact trip and memberships it ran with, so results never show another trip's details. */
export type SavedSearch = { key: string; trip: Trip; results: SourceResult[]; bundles: Bundle[] };

/** Identifies what a search depends on: the trip's criteria, ranking options, sources and memberships. */
export const tripKey = (t: Trip | null, m: Membership[]) => (t?.criteria ? JSON.stringify([t.criteria, t.options, [...t.sources].sort(), m]) : "");

export const loadSearch = () => read<SavedSearch | null>("bf-search", null);
export const saveSearch = (s: SavedSearch) => write("bf-search", s);
export const loadBooked = (key: string) => read<Booked>(`bf-booked-${key}`, {});
export const saveBooked = (key: string, v: Booked) => write(`bf-booked-${key}`, v);

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
