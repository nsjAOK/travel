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
export const loadResults = () => read<SourceResult[]>("bf-results", []);
export const saveResults = (r: SourceResult[]) => write("bf-results", r);
export const loadBundles = () => read<Bundle[]>("bf-bundles", []);
export const saveBundles = (b: Bundle[]) => write("bf-bundles", b);
export const loadBooked = (key: string) => read<Booked>(`bf-booked-${key}`, {});
export const saveBooked = (key: string, v: Booked) => write(`bf-booked-${key}`, v);

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
