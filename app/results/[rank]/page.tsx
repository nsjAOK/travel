"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { BookingLink, BookingSteps } from "@/components/Steps";
import { payLine } from "@/components/BundleParts";
import type { Bundle } from "@/lib/types";
import { fmtDate } from "@/lib/adapters/links";
import { loadBooked, loadBundles, loadTrip, money, saveBooked, type Booked, type Trip } from "@/lib/client/store";

export default function GuidePage({ params }: { params: Promise<{ rank: string }> }) {
  const { rank } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [booked, setBooked] = useState<Booked>({});
  const [loaded, setLoaded] = useState(false);

  const b = bundles.find((x) => String(x.rank) === rank);
  const key = b ? `${b.title}-${b.effective}` : "";

  useEffect(() => {
    setTrip(loadTrip());
    setBundles(loadBundles());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (key) setBooked(loadBooked(key));
  }, [key]);

  const update = (i: number, patch: Partial<{ done: boolean; confirmation: string }>) => {
    const cur = booked[i] ?? { done: false, confirmation: "" };
    const next = { ...booked, [i]: { ...cur, ...patch } };
    setBooked(next);
    saveBooked(key, next);
  };

  if (loaded && (!b || !trip?.criteria)) {
    return (
      <>
        <Header active="results" />
        <main className="page">
          <div className="card">
            <h1>Booking guide not found</h1>
            <p className="lede">Run a search first, then open a guide from the results.</p>
            <Link href="/results" className="btn btn-primary" style={{ marginTop: 16 }}>Back to results</Link>
          </div>
        </main>
      </>
    );
  }
  if (!b || !trip?.criteria) return null;

  const c = trip.criteria;
  const doneCount = b.steps.filter((_, i) => booked[i]?.done).length;
  const next = bundles.find((x) => x.rank === b.rank + 1);
  const headroom = next ? next.effective - b.effective : null;

  return (
    <>
      <Header active="results" />
      <main className="page">
        <Link href="/results" className="btn" style={{ border: 0, paddingLeft: 0 }}>← All matches</Link>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginTop: 4 }}>
          <div>
            <h1>Booking guide: {b.title}</h1>
            <p className="lede">
              Match #{b.rank} · {c.origin} → {c.destination} · {fmtDate(c.departDate)} – {fmtDate(c.returnDate)} · {b.steps.length} booking{b.steps.length === 1 ? "" : "s"}
              {b.sample ? " · sample prices" : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="total" style={{ fontSize: 30 }}>{money(b.effective)}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{payLine(b)}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 20, padding: "18px 24px" }}>
          <div style={{ fontWeight: 600 }}>{doneCount} of {b.steps.length} booked</div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={b.steps.length} aria-valuenow={doneCount} aria-label="Bookings done" style={{ marginTop: 10 }}>
            <div style={{ width: `${(doneCount / b.steps.length) * 100}%`, background: "var(--ok)" }} />
          </div>
        </div>

        <div className="cols">
          <ol className="main-col" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {b.steps.map((s, i) => {
              const done = Boolean(booked[i]?.done);
              return (
                <li key={i} className="bundle">
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <span className="rank" aria-hidden="true" style={done ? { background: "var(--ok)", color: "#fff" } : undefined}>{i + 1}</span>
                    <div>
                      <h2 style={{ fontSize: 21 }}>{s.title}</h2>
                      <div className="small">{s.booking.kind === "steps" ? s.booking.site : s.booking.label}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}><BookingSteps booking={s.booking} /></div>
                  <div className="actions" style={{ alignItems: "flex-end" }}>
                    <BookingLink booking={s.booking} />
                    <label className="stack" style={{ flex: "1 1 200px" }}>Confirmation number
                      <input className="field" placeholder="e.g. ABC123" value={booked[i]?.confirmation ?? ""} onChange={(e) => update(i, { confirmation: e.target.value })} />
                    </label>
                    <button type="button" className="btn" aria-pressed={done} onClick={() => update(i, { done: !done })}
                      style={done ? { borderColor: "var(--ok)", background: "var(--ok-soft)", color: "var(--ok)", fontWeight: 600 } : undefined}>
                      {done ? "✓ Booked" : "Mark as booked"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <aside className="side-col">
            <section className="card" aria-labelledby="ready-h">
              <h2 id="ready-h" style={{ marginBottom: 10 }}>Have these ready</h2>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Each traveler's name exactly as on their ID</li>
                {c.childAges.length ? <li>Birth dates for the {c.childAges.length} child{c.childAges.length > 1 ? "ren" : ""}</li> : null}
                <li>Known Traveler / TSA PreCheck numbers</li>
                <li>Frequent flyer and hotel loyalty numbers</li>
                {b.car ? <li>Driver's license for the car renter</li> : null}
              </ul>
            </section>

            <section className="card" aria-labelledby="change-h">
              <h2 id="change-h" style={{ marginBottom: 10 }}>If a price has changed</h2>
              {headroom !== null ? (
                <>
                  <p style={{ margin: "0 0 12px", color: "var(--ink-2)" }}>Up by less than {money(headroom)}: book it. It's still cheaper than match #{b.rank + 1} ({money(next!.effective)}).</p>
                  <p style={{ margin: "0 0 14px", color: "var(--ink-2)" }}>Up by more: stop and search again before booking anything else.</p>
                </>
              ) : (
                <p style={{ margin: "0 0 14px", color: "var(--ink-2)" }}>This is the last match. If a price has gone up, search again before booking anything else.</p>
              )}
              <Link href="/search" className="btn btn-outline" style={{ width: "100%" }}>Search again</Link>
            </section>

            <section className="card" aria-labelledby="order-h">
              <h2 id="order-h" style={{ marginBottom: 10 }}>Booking order</h2>
              <p style={{ margin: 0, color: "var(--ink-2)" }}>
                {b.packageId
                  ? "This is one package: everything is booked in a single checkout."
                  : "Book the flight first. Flights sell out and change price fastest, and hotels and cars usually allow free cancellation if plans change."}
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
