import type { Membership } from "@/lib/types";

// Starting values; the traveler edits these on the Plan page and they are
// saved in the browser. Cents-per-point is the traveler's own valuation.
export const DEFAULT_MEMBERSHIPS: Membership[] = [
  { id: "costco", name: "Costco Executive", detail: "Travel packages · 2% reward", balance: null, centsPerPoint: null, enabled: true },
  { id: "chase_ur", name: "Chase Ultimate Rewards", detail: "Chase Travel portal", balance: 120000, centsPerPoint: 1.5, enabled: true },
  { id: "amex_mr", name: "Amex Membership Rewards", detail: "Amex Travel portal", balance: 85000, centsPerPoint: 1.2, enabled: true },
  { id: "marriott", name: "Marriott Bonvoy", detail: "Points stays", balance: 210000, centsPerPoint: 0.8, enabled: true },
  { id: "delta", name: "Delta SkyMiles", detail: "Award flights", balance: 60000, centsPerPoint: 1.2, enabled: true },
];

export function membershipById(list: Membership[], id: string): Membership | undefined {
  return list.find((m) => m.id === id && m.enabled);
}

/** Dollar value of points at the traveler's own valuation. */
export function pointsValue(list: Membership[], program: string, points: number): number {
  const m = list.find((x) => x.id === program);
  return Math.round((points * (m?.centsPerPoint ?? 1)) / 100);
}
