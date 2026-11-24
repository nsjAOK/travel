import type { Bundle, Check, FlightOffer, HotelOffer } from "@/lib/types";
import { carLabel } from "@/lib/cars";
import { fmtTime } from "@/lib/adapters/links";
import { money } from "@/lib/client/store";

const SOURCE_NAMES: Record<string, string> = {
  duffel_flights: "Airline website",
  duffel_stays: "Hotel website",
  cars: "Rental company",
  costco: "Costco Travel package",
  chase: "Chase Travel portal",
  amex: "Amex Travel",
  marriott: "Marriott Bonvoy points",
  delta: "Delta SkyMiles",
};
export const sourceName = (s: string) => SOURCE_NAMES[s] ?? s;

const PROGRAM_NAMES: Record<string, string> = { chase_ur: "Chase points", amex_mr: "Amex points", marriott: "Bonvoy points", delta: "SkyMiles" };
export const programName = (p: string) => PROGRAM_NAMES[p] ?? p;

export function priceText(o: FlightOffer | HotelOffer): string {
  return o.payment.kind === "points" ? `${o.payment.points.toLocaleString("en-US")} ${o.payment.program === "delta" ? "mi" : "pts"}` : money(o.cash);
}

export function payLine(b: Bundle): string {
  const parts = [`${money(b.cash)} cash`];
  for (const p of b.pointsUsed) parts.push(`${p.points.toLocaleString("en-US")} ${programName(p.program)} (≈ ${money(p.value)})`);
  let line = parts.join(" + ");
  if (b.rewards) line += ` − ${money(b.rewards)} ${b.packageId ? "member reward" : "credit"}`;
  return line;
}

export function stopsText(n: number) {
  return n === 0 ? "nonstop" : `${n} stop${n > 1 ? "s" : ""}`;
}

export function Legs({ b, nights }: { b: Bundle; nights: number }) {
  const f = b.flight;
  const h = b.hotel;
  const inPackage = Boolean(b.packageId);
  const legs = [
    {
      kind: "Flight",
      price: inPackage ? "In package" : priceText(f),
      main: `${f.airline} · ${stopsText(f.stops)}`,
      sub: `Out ${fmtTime(f.outbound.depart)} → ${fmtTime(f.outbound.arrive)} · Back ${fmtTime(f.inbound.depart)} → ${fmtTime(f.inbound.arrive)}`,
      source: inPackage ? `Package share ≈ ${money(f.cash)}` : sourceName(f.source),
    },
    {
      kind: "Hotel",
      price: inPackage ? "In package" : priceText(h),
      main: `${h.roomName} · ${nights} night${nights === 1 ? "" : "s"}`,
      sub: [h.stars ? `${h.stars}★` : null, h.rating ? `${h.rating.toFixed(1)}/10` : null, h.sqft ? `${h.sqft} sq ft` : null].filter(Boolean).join(" · "),
      source: inPackage ? `Package share ≈ ${money(h.cash)}` : `${sourceName(h.source)}${h.credit ? `, includes ${money(h.credit)} credit` : ""}`,
    },
    b.car
      ? {
          kind: "Car",
          price: inPackage ? "In package" : money(b.car.cash),
          main: `${carLabel(b.car.vehicleClass)} · ${nights} days`,
          sub: `Pick up at the airport counter`,
          source: inPackage ? `Package share ≈ ${money(b.car.cash)}` : `${b.car.company}${b.car.sample ? " (sample price)" : ""}`,
        }
      : { kind: "Car", price: "—", main: "No car in this bundle", sub: "", source: "" },
  ];
  return (
    <div className="legs">
      {legs.map((g) => (
        <div className="leg-card" key={g.kind}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <span className="eyebrow">{g.kind}</span>
            <b>{g.price}</b>
          </div>
          <div style={{ fontWeight: 600 }}>{g.main}</div>
          <div className="sub">{g.sub}</div>
          <div className="small" style={{ marginTop: "auto", paddingTop: 6 }}>{g.source}</div>
        </div>
      ))}
    </div>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  return (
    <ul className="checks" aria-label="Limits met">
      {checks.map((k, i) => (
        <li key={i} className={k.ok === null ? "unknown" : ""} title={k.ok === null ? "The source didn't say; check before booking" : undefined}>
          {k.ok === null ? "?" : (
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
          {k.ok === null ? `Unconfirmed: ${k.label}` : k.label}
        </li>
      ))}
    </ul>
  );
}
