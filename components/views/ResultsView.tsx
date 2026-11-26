"use client";
import { useEffect, useState } from "react";
import { NavLink, useApp } from "@/lib/client/nav";
import Header from "@/components/Header";
import { BookingLink, BookingSteps } from "@/components/Steps";
import { Checks, Legs, payLine } from "@/components/BundleParts";
import type { Bundle, SourceResult } from "@/lib/types";
import { nights } from "@/lib/adapters/sample";
import { fmtDate } from "@/lib/adapters/links";
import { confirmed } from "@/lib/engine/filter";
import { loadMemberships, loadSearch, loadTrip, money, tripKey, type Trip } from "@/lib/client/store";

export default function ResultsView() {
  const { services } = useApp();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [results, setResults] = useState<SourceResult[]>([]);
  const [open, setOpen] = useState<number | null>(1);
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // Show the last finished search with the trip it ran for, never the trip being edited now.
    const s = loadSearch();
    setTrip(s?.trip ?? null);
    setBundles(s?.bundles ?? []);
    setResults(s?.results ?? []);
    setStale(Boolean(s && tripKey(loadTrip(), loadMemberships()) !== s.key));
    setLoaded(true);
  }, []);

  const c = trip?.criteria;
  const manual = results.filter((r) => r.status === "manual" && r.manualSteps);
  const failed = results.filter((r) => r.status === "error");
  const anySample = bundles.some((b) => b.sample);
  const unconfirmed = bundles.filter((b) => !confirmed(b.checks)).length;
  const sortLabel = trip?.options.sortBy === "cash" ? "cash out of pocket" : trip?.options.sortBy === "points" ? "fewest points" : "effective cost";

  return (
    <>
      <Header active="results" />
      <main className="page">
        {loaded && (!c || bundles.length === 0) ? (
          <div className="card">
            <h1>No results yet</h1>
            <p className="lede">{c ? "Nothing met every limit in the last search. Loosen a limit and search again." : "Describe a trip and run a search first."}</p>
            <NavLink to={{ name: "plan" }} className="btn btn-primary" style={{ marginTop: 16 }}>Plan a trip</NavLink>
          </div>
        ) : null}

        {c && bundles.length > 0 ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1>
                  {unconfirmed === 0
                    ? `${bundles.length} bundle${bundles.length === 1 ? "" : "s"} meet every limit`
                    : `${bundles.length} bundle${bundles.length === 1 ? "" : "s"} found`}
                </h1>
                <p className="lede">
                  {c.origin} → {c.destination} · {fmtDate(c.departDate)} – {fmtDate(c.returnDate)} · sorted by {sortLabel}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <NavLink to={{ name: "search" }} className="btn">{stale ? "Search your current trip" : "Refresh prices"}</NavLink>
                <NavLink to={{ name: "plan" }} className="btn">Edit constraints</NavLink>
              </div>
            </div>

            {stale ? (
              <p className="notice notice-info" style={{ marginTop: 16 }}>
                These results are from your last finished search. You've changed the trip or your memberships since then, so search again to see matches for the current trip.
              </p>
            ) : null}
            {unconfirmed > 0 ? (
              <p className="notice" style={{ marginTop: 12 }}>
                {unconfirmed === bundles.length
                  ? "Some limits couldn't be confirmed from the sources' data for any of these bundles (shown with a ?). Check those before booking."
                  : `Bundles that confirm every limit are listed first, sorted by ${sortLabel}. The last ${unconfirmed} have a limit the source didn't confirm (shown with a ?), so check it before booking.`}
              </p>
            ) : null}

            {anySample ? (
              <p className="notice" style={{ marginTop: 16 }}>
                Some prices below are <strong>sample data</strong> (hotel names, prices and points are made up).{" "}
                {services.host === "claude"
                  ? "This copy runs inside Claude; run the app on your computer with a Duffel token for live flight and hotel prices."
                  : "Add a Duffel token for live flight and hotel prices; car prices stay samples until a car-rental source is connected."}
              </p>
            ) : null}
            {failed.length ? (
              <p className="notice notice-bad" style={{ marginTop: 12 }}>
                {failed.map((f) => `${f.label}: ${f.message}`).join(" · ")}
              </p>
            ) : null}

            <ol className="list" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              {bundles.map((b) => (
                <li key={b.rank} className="bundle" style={{ borderTop: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0, flex: "1 1 420px" }}>
                      <span className={`rank ${b.rank === 1 ? "best" : ""}`} aria-label={`Rank ${b.rank}`}>{b.rank}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <h2 style={{ fontSize: 22 }}>{b.title}</h2>
                          {b.rank === 1 ? <span className="tag tag-accent">Best value</span> : null}
                          {b.sample ? <span className="tag tag-sample">Sample</span> : null}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                          <span className="tag tag-member">{b.via}</span>
                          <span className="tag tag-grey">{b.steps.every((s) => s.booking.kind === "link") ? "Direct links" : b.packageId ? "Step-by-step booking" : "Links + steps"}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="total">{money(b.effective)}</div>
                      <div className="small">effective total for {c.adults + c.childAges.length} traveler{c.adults + c.childAges.length === 1 ? "" : "s"}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{payLine(b)}</div>
                    </div>
                  </div>

                  <Legs b={b} nights={nights(c)} />
                  <Checks checks={b.checks} />

                  <div className="actions">
                    <button type="button" className="btn btn-primary" aria-expanded={open === b.rank} onClick={() => setOpen(open === b.rank ? null : b.rank)}>
                      {open === b.rank ? "Hide booking steps" : "How to book"}
                    </button>
                    <NavLink to={{ name: "guide", rank: b.rank }} className="btn btn-outline">Open booking guide</NavLink>
                  </div>

                  {open === b.rank ? (
                    <div className="steps-box">
                      {b.steps.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < b.steps.length - 1 ? 18 : 0 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <b>{b.steps.length > 1 ? `${i + 1}. ` : ""}{s.title}</b>
                            <BookingLink booking={s.booking} className="btn btn-outline btn-sm" />
                          </div>
                          <BookingSteps booking={s.booking} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            {manual.length ? (
              <section className="card" style={{ marginTop: 24 }} aria-labelledby="manual-h">
                <h2 id="manual-h">Also check by hand</h2>
                <p className="small" style={{ margin: "4px 0 12px" }}>These membership sites can't be read automatically yet. If one beats {money(bundles[0].effective)}, book it there.</p>
                {manual.map((r) => (
                  <details key={r.source} style={{ borderTop: "1px solid var(--line-2)", padding: "12px 0" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 32 }}>{r.label}</summary>
                    <div className="steps-box">
                      <BookingSteps booking={r.manualSteps!} />
                      <div style={{ marginTop: 12 }}><BookingLink booking={r.manualSteps!} className="btn btn-outline btn-sm" /></div>
                    </div>
                  </details>
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}
