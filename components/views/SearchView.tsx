"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useApp } from "@/lib/client/nav";
import Header from "@/components/Header";
import { BookingLink, BookingSteps } from "@/components/Steps";
import type { SourceResult } from "@/lib/types";
import type { SourceInfo } from "@/lib/adapters";
import { rankBundles } from "@/lib/engine/rank";
import { hotelChecks } from "@/lib/engine/filter";
import { fmtDate } from "@/lib/adapters/links";
import { loadMemberships, loadTrip, money, saveBundles, saveResults, type Trip } from "@/lib/client/store";

type Row = SourceInfo & { state: "queued" | "running" | SourceResult["status"]; result?: SourceResult };

const PILL: Record<Row["state"], [string, string]> = {
  queued: ["pill-wait", "Queued"],
  running: ["pill-run", "Searching"],
  done: ["pill-done", "Done"],
  manual: ["pill-manual", "Check by hand"],
  error: ["pill-error", "Failed"],
  skipped: ["pill-wait", "Skipped"],
};

export default function SearchView() {
  const { go, services } = useApp();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = loadTrip();
    if (!t?.criteria) {
      go({ name: "plan" });
      return;
    }
    setTrip(t);
    const memberships = loadMemberships();
    services.sources().then(({ sources }: { sources: SourceInfo[] }) => {
      const chosen = sources.filter((s) => t.sources.includes(s.id));
      setRows(chosen.map((s) => ({ ...s, state: "running" })));
      chosen.forEach(async (s) => {
        let result: SourceResult;
        try {
          result = await services.search(s.id, t.criteria!, memberships);
        } catch (e) {
          result = { source: s.id, label: s.label, status: "error", message: (e as Error).message, sample: false, flights: [], hotels: [], cars: [], packages: [] };
        }
        setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, state: result.status, result } : r)));
      });
    });
  }, [go, services]);

  const finished = rows.filter((r) => r.state !== "running" && r.state !== "queued");
  const allDone = rows.length > 0 && finished.length === rows.length;
  const results = useMemo(() => rows.flatMap((r) => (r.result ? [r.result] : [])), [rows]);

  const funnel = useMemo(() => {
    const c = trip?.criteria;
    if (!c) return [];
    const hotels = results.flatMap((r) => [...r.hotels, ...r.packages.map((p) => p.hotel)]);
    const step = (label: string, keep: (i: number, checks: ReturnType<typeof hotelChecks>) => boolean) => ({ label, keep });
    const steps = [
      step("All hotel offers", () => true),
      step(`Within ${c.hotel.maxMilesFromAirport} mi of ${c.destination}`, (_, k) => k[0].ok !== false),
      step("Stars and rating", (_, k) => k.filter((x) => /★|Star|\/ 10|rating/.test(x.label)).every((x) => x.ok !== false)),
      step("Room size", (_, k) => k.filter((x) => /BR|sq ft|Room size/.test(x.label)).every((x) => x.ok !== false)),
      step("Amenities", (_, k) => k.filter((x) => /amenities|Not listed/.test(x.label)).every((x) => x.ok !== false)),
    ];
    let left = hotels.map((h) => hotelChecks(c, h));
    return steps.map((s) => {
      left = left.filter((k, i) => s.keep(i, k));
      return { label: s.label, count: left.length, of: hotels.length };
    });
  }, [results, trip]);

  const bundles = useMemo(() => (trip?.criteria && results.length ? rankBundles(trip.criteria, results, loadMemberships(), trip.options) : []), [results, trip]);

  useEffect(() => {
    if (allDone) {
      saveResults(results);
      saveBundles(bundles);
    }
  }, [allDone, results, bundles]);

  const c = trip?.criteria;
  const counts = {
    flights: results.reduce((n, r) => n + r.flights.length, 0),
    hotels: results.reduce((n, r) => n + r.hotels.length, 0),
    cars: results.reduce((n, r) => n + r.cars.length, 0),
  };

  return (
    <>
      <Header active="search" />
      <main className="page">
        <NavLink to={{ name: "plan" }} className="btn" style={{ border: 0, paddingLeft: 0 }}>← Edit constraints</NavLink>
        <h1 style={{ marginTop: 4 }}>{allDone ? `Searched ${rows.length} sources` : `Searching ${rows.length} sources`}</h1>
        {c ? (
          <p className="lede">
            {c.origin} → {c.destination} · {fmtDate(c.departDate)} – {fmtDate(c.returnDate)} · hotel within {c.hotel.maxMilesFromAirport} mi of {c.destination}
          </p>
        ) : null}

        <div className="card" style={{ marginTop: 20, padding: "18px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
            <span>{finished.length} of {rows.length} sources finished</span>
          </div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={finished.length} aria-label="Sources finished" style={{ marginTop: 10 }}>
            <div style={{ width: `${rows.length ? (finished.length / rows.length) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="cols">
          <section className="card main-col" aria-labelledby="src-h" style={{ gap: 0, padding: "8px 24px 16px" }}>
            <h2 id="src-h" style={{ margin: "16px 0 8px" }}>Sources</h2>
            <ul className="list">
              {rows.map((r) => (
                <li key={r.id}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{r.label}</div>
                      <div className="small">{r.via}</div>
                    </div>
                    <div style={{ flex: "1 1 240px", fontSize: 14, color: "var(--ink-2)" }}>{r.result?.message ?? "Searching…"}</div>
                    {r.result?.sample ? <span className="tag tag-sample">Sample</span> : null}
                    <span className={`pill ${PILL[r.state][0]}`}>{PILL[r.state][1]}</span>
                    {r.result?.manualSteps ? (
                      <button type="button" className="btn btn-sm btn-outline" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                        {open === r.id ? "Hide steps" : "Show steps"}
                      </button>
                    ) : null}
                  </div>
                  {open === r.id && r.result?.manualSteps ? (
                    <div className="steps-box">
                      <BookingSteps booking={r.result.manualSteps} />
                      <div style={{ marginTop: 12 }}><BookingLink booking={r.result.manualSteps} className="btn btn-outline btn-sm" /></div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <aside className="side-col">
            <section className="card" aria-labelledby="funnel-h">
              <h2 id="funnel-h">Hotel filter</h2>
              <p className="small" style={{ margin: "4px 0 14px" }}>Offers left after each hard limit</p>
              {funnel.map((f) => (
                <div key={f.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{f.label}</span><b>{f.count}</b></div>
                  <div className="progress" style={{ height: 8, marginTop: 4 }}><div style={{ width: `${f.of ? Math.max(2, (f.count / f.of) * 100) : 0}%` }} /></div>
                </div>
              ))}
            </section>

            <section className="card" aria-labelledby="combo-h">
              <h2 id="combo-h" style={{ marginBottom: 12 }}>Offers so far</h2>
              <div className="stat-grid">
                <div className="stat"><b>{counts.flights}</b><span className="small">flights</span></div>
                <div className="stat"><b>{counts.hotels}</b><span className="small">hotels</span></div>
                <div className="stat"><b>{counts.cars}</b><span className="small">cars</span></div>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 14 }}>
                {bundles[0] ? <>Cheapest so far: <strong>{money(bundles[0].effective)}</strong> effective, via {bundles[0].via}.</> : "No bundle meets every limit yet."}
              </p>
            </section>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!allDone}
                onClick={() => go({ name: "results" })}
              >
                {allDone ? `See ${bundles.length} match${bundles.length === 1 ? "" : "es"}` : "Waiting for sources…"}
              </button>
              {c && allDone && bundles.length === 0 ? (
                <p className="small" style={{ margin: 0, textAlign: "center" }}>Nothing meets every limit. Try a wider distance, time window or rating, then search again.</p>
              ) : null}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
