"use client";
import { useApp } from "@/lib/client/nav";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Chip from "@/components/Chip";
import type { CarClass, Criteria, Membership, TimeWindow } from "@/lib/types";
import type { SourceInfo } from "@/lib/adapters";
import type { RankOptions } from "@/lib/engine/rank";
import { AMENITIES, amenityLabel } from "@/lib/amenities";
import { findAirport } from "@/lib/airports";
import { CAR_LABELS } from "@/lib/cars";
import { searchBlocker } from "@/lib/parse/defaults";
import { fmtDate } from "@/lib/adapters/links";
import { loadMemberships, loadTrip, saveMemberships, saveTrip } from "@/lib/client/store";

const EXAMPLE =
  "Family of four (2 adults, kids 8 and 11) flying Seattle to Orlando, Mar 14–21 2027, give or take a day. Hotel within 8 miles of MCO, at least 4 stars and rated 8.5 or better, with 2 bedrooms or at least 600 sq ft. Must have free breakfast, a pool, a kitchenette, free parking, an airport shuttle and Wi-Fi. Economy, 1 stop max. Leave Seattle between 6 and 11 am and land in Orlando by 6 pm. Coming home, leave after 11 am and land in Seattle by 9 pm. Prefer Delta or Alaska. Midsize SUV.";

const CABINS = { economy: "Economy", premium_economy: "Premium economy", business: "Business", first: "First" } as const;

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function WindowInput({ label, value, onChange }: { label: string; value: TimeWindow; onChange: (w: TimeWindow) => void }) {
  const a = minutes(value.from);
  const b = Math.max(minutes(value.to), a);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input className="field" type="time" aria-label={`${label} from`} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value || "00:00" })} />
        <span className="small">to</span>
        <input className="field" type="time" aria-label={`${label} to`} value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value || "23:59" })} />
      </div>
      <div className="timeline" aria-hidden="true">
        <div style={{ left: `${(a / 1440) * 100}%`, width: `${Math.max(1, ((b - a) / 1440) * 100)}%` }} />
      </div>
      <div className="ticks" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
    </div>
  );
}

export default function PlanView() {
  const { go, services } = useApp();
  const [text, setText] = useState(EXAMPLE);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [reader, setReader] = useState<string>("");
  const [warning, setWarning] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [reading, setReading] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [env, setEnv] = useState<{ live: boolean; claude: boolean } | null>(null);
  const [options, setOptions] = useState<RankOptions>({ limit: 5, sortBy: "effective" });
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setMemberships(loadMemberships());
    const trip = loadTrip();
    if (trip) {
      setText(trip.text);
      setCriteria(trip.criteria);
      setReader(trip.reader ?? "");
      setOptions(trip.options);
      if (trip.sources.length) setEnabled(trip.sources);
    }
    services
      .sources()
      .then((d) => {
        setSources(d.sources);
        setEnv({ live: d.live, claude: d.claude });
        setEnabled((prev) => (prev.length ? prev : d.sources.map((s) => s.id)));
      })
      .catch(() => setError("Couldn't load the list of sources. Reload the page to try again."));
  }, [services]);

  const updateMembership = (id: string, patch: Partial<Membership>) => {
    const next = memberships.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setMemberships(next);
    saveMemberships(next);
  };

  async function readTrip() {
    setReading(true);
    setError("");
    setWarning("");
    try {
      if (text.trim().length < 10) throw new Error("Describe your trip in a sentence or two first.");
      const data = await services.parse(text);
      setCriteria(data.criteria);
      setReader(data.reader);
      setDismissed([]);
      if (data.warning) setWarning(data.warning);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  // Immutable update helper for nested criteria fields.
  const set = (fn: (c: Criteria) => void) =>
    setCriteria((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const groups = useMemo(() => {
    if (!criteria) return [];
    const c = criteria;
    const h = c.hotel;
    const f = c.flight;
    const num = (v: number | null, onSave: (v: number | null) => void, extra: { min?: number; step?: number; suffix?: string } = {}) => ({ type: "number" as const, value: v, onSave, ...extra });
    return [
      {
        label: "Trip",
        chips: [
          <Chip key="o" text={c.origin ? `From ${c.origin}` : "From: not set"} edit={{ type: "text", value: c.origin, onSave: (v) => set((x) => { x.origin = v.trim().toUpperCase(); }) }} />,
          <Chip key="d" text={c.destination ? `To ${c.destination}` : "To: not set"} edit={{ type: "text", value: c.destination, onSave: (v) => set((x) => { x.destination = v.trim().toUpperCase(); }) }} />,
          <Chip key="dd" text={c.departDate ? `Leave ${fmtDate(c.departDate)}` : "Departure date: not set"} edit={{ type: "date", value: c.departDate, onSave: (v) => set((x) => { x.departDate = v; }) }} />,
          <Chip key="rd" text={c.returnDate ? `Return ${fmtDate(c.returnDate)}` : "Return date: not set"} edit={{ type: "date", value: c.returnDate, onSave: (v) => set((x) => { x.returnDate = v; }) }} />,
          <Chip key="fx" text={c.dateFlexDays ? `± ${c.dateFlexDays} day${c.dateFlexDays > 1 ? "s" : ""} (noted, not searched yet)` : "Exact dates"} edit={num(c.dateFlexDays, (v) => set((x) => { x.dateFlexDays = v ?? 0; }), { min: 0, suffix: "days" })} />,
          <Chip key="a" text={`${c.adults} adult${c.adults === 1 ? "" : "s"}`} edit={num(c.adults, (v) => set((x) => { x.adults = Math.max(1, v ?? 1); }), { min: 1 })} />,
          <Chip key="k" text={c.childAges.length ? `${c.childAges.length} child${c.childAges.length > 1 ? "ren" : ""} (${c.childAges.join(", ")})` : "No children"} edit={{ type: "text", value: c.childAges.join(", "), onSave: (v) => set((x) => { x.childAges = (v.match(/\d{1,2}/g) ?? []).map(Number); }) }} />,
        ],
      },
      {
        label: "Hotel",
        chips: [
          <Chip key="mi" text={`Within ${h.maxMilesFromAirport} mi of ${c.destination || "the airport"}`} edit={num(h.maxMilesFromAirport, (v) => set((x) => { x.hotel.maxMilesFromAirport = v ?? 10; }), { min: 1, suffix: "mi" })} />,
          <Chip key="st" text={h.minStars ? `${h.minStars}★ or higher` : "Any star class"} edit={num(h.minStars, (v) => set((x) => { x.hotel.minStars = v; }), { min: 1, step: 0.5, suffix: "★" })} />,
          <Chip key="ra" text={h.minRating ? `Rating ${h.minRating}+` : "Any rating"} edit={num(h.minRating, (v) => set((x) => { x.hotel.minRating = v; }), { min: 1, step: 0.1, suffix: "/ 10" })} />,
          <Chip key="br" text={h.minBedrooms ? `${h.minBedrooms}+ bedrooms` : "Any bedrooms"} edit={num(h.minBedrooms, (v) => set((x) => { x.hotel.minBedrooms = v; }), { min: 0 })} />,
          <Chip key="sq" text={h.minSqft ? `${h.minSqft}+ sq ft` : "Any size"} edit={num(h.minSqft, (v) => set((x) => { x.hotel.minSqft = v; }), { min: 0, step: 50, suffix: "sq ft" })} />,
          ...h.amenities.map((a) => <Chip key={`am-${a}`} text={amenityLabel(a)} onRemove={() => set((x) => { x.hotel.amenities = x.hotel.amenities.filter((y) => y !== a); })} />),
          <Chip
            key="am-add"
            text="+ Amenity"
            edit={{
              type: "select",
              value: AMENITIES.find((a) => !h.amenities.includes(a.key))?.key ?? "",
              options: AMENITIES.filter((a) => !h.amenities.includes(a.key)).map((a) => ({ value: a.key, label: a.label })),
              onSave: (v) => set((x) => { if (v && !x.hotel.amenities.includes(v)) x.hotel.amenities.push(v); }),
            }}
          />,
        ],
      },
      {
        label: "Flight",
        chips: [
          <Chip key="cb" text={CABINS[f.cabin]} edit={{ type: "select", value: f.cabin, options: Object.entries(CABINS).map(([value, label]) => ({ value, label })), onSave: (v) => set((x) => { x.flight.cabin = v as Criteria["flight"]["cabin"]; }) }} />,
          <Chip key="sp" text={f.maxStops === 0 ? "Nonstop only" : `${f.maxStops} stop${f.maxStops > 1 ? "s" : ""} max`} edit={{ type: "select", value: String(f.maxStops), options: [{ value: "0", label: "Nonstop only" }, { value: "1", label: "1 stop max" }, { value: "2", label: "2 stops max" }], onSave: (v) => set((x) => { x.flight.maxStops = Number(v); }) }} />,
          <Chip key="bg" text={f.checkedBags === null ? `Bags: assuming ${c.adults}` : `${f.checkedBags} checked bag${f.checkedBags === 1 ? "" : "s"}`} edit={num(f.checkedBags, (v) => set((x) => { x.flight.checkedBags = v; }), { min: 0 })} />,
          ...f.preferredAirlines.map((a) => <Chip key={`al-${a}`} text={`Prefer ${a}`} onRemove={() => set((x) => { x.flight.preferredAirlines = x.flight.preferredAirlines.filter((y) => y !== a); })} />),
          <Chip key="tm" text="Times: see below" />,
        ],
      },
      {
        label: "Car",
        chips: [
          <Chip
            key="car"
            text={!c.car.needed ? "No car" : c.car.vehicleClass ? CAR_LABELS[c.car.vehicleClass] : "Midsize or larger"}
            edit={{
              type: "select",
              value: !c.car.needed ? "none" : c.car.vehicleClass ?? "midsize",
              options: [{ value: "none", label: "No car" }, ...Object.entries(CAR_LABELS).map(([value, label]) => ({ value, label }))],
              onSave: (v) => set((x) => { x.car = v === "none" ? { needed: false, vehicleClass: null } : { needed: true, vehicleClass: v as CarClass }; }),
            }}
          />,
          ...(c.car.needed ? [<Chip key="pk" text={`Pick up at ${c.destination || "the airport"}`} />] : []),
        ],
      },
      {
        label: "Budget",
        chips: [
          <Chip key="bu" text={c.maxBudget ? `Up to $${c.maxBudget.toLocaleString("en-US")}` : "No budget cap"} edit={num(c.maxBudget, (v) => set((x) => { x.maxBudget = v; }), { min: 0, step: 100, suffix: "USD" })} />,
          ...c.notes.map((n, i) => <Chip key={`n-${i}`} text={`Noted: ${n}`} onRemove={() => set((x) => { x.notes = x.notes.filter((_, j) => j !== i); })} />),
        ],
      },
    ];
  }, [criteria]);

  const unknownAirport = criteria && [criteria.origin, criteria.destination].find((code) => code && !findAirport(code));
  const blocker = criteria ? (unknownAirport ? `We don't know airport ${unknownAirport} yet.` : searchBlocker(criteria)) : null;
  const ready = Boolean(criteria && !blocker);
  const questions = (criteria?.questions ?? []).filter((q) => !dismissed.includes(q));
  const chosen = sources.filter((s) => enabled.includes(s.id));

  function search() {
    if (!criteria) return;
    saveTrip({ text, criteria, reader, options, sources: enabled });
    go({ name: "search" });
  }

  return (
    <>
      <Header active="search" />
      <main className="page">
        <h1>Plan a trip</h1>
        <p className="lede">Describe the trip in your own words. We pick out every requirement, show you what we understood, then return the 3–5 cheapest hotel + flight + car bundles that meet all of them.</p>

        {env && !env.live ? (
          <p className="notice" style={{ marginTop: 16 }}>
            <strong>Sample mode.</strong>{" "}
            {services.host === "claude"
              ? "This copy runs inside Claude, so prices are made-up samples. Everything else works as it does with live prices; run the app on your computer for real prices."
              : "Prices are made-up samples until a Duffel token is added (see README). Everything else works as it will with live prices."}
          </p>
        ) : null}

        <div className="cols">
          <div className="main-col">
            <section className="card" aria-labelledby="desc-h">
              <div className="card-head">
                <h2 id="desc-h"><label htmlFor="trip-text">Describe your trip</label></h2>
                {env ? (
                  <span className="small">
                    {env.claude
                      ? services.host === "claude" ? "Read by Claude on your account" : "Read by Claude"
                      : "Read by the built-in reader (add an Anthropic API key to use Claude)"}
                  </span>
                ) : null}
              </div>
              <textarea id="trip-text" className="field" rows={7} value={text} onChange={(e) => setText(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-primary" onClick={readTrip} disabled={reading}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.6 4.2 4.4 1.3-4.4 1.3L8 12.5 6.4 8.3 2 7l4.4-1.3z" fill="currentColor" /></svg>
                  {reading ? "Reading…" : criteria ? "Read it again" : "Read my trip"}
                </button>
                <button type="button" className="btn" onClick={() => { setText(""); setCriteria(null); }}>Clear</button>
                <span className="small" style={{ flex: "1 1 260px" }}>Write it the way you would tell a travel agent. You can also mention a budget, refundable fares or bags.</span>
              </div>
              {error ? <p className="notice notice-bad" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
              {warning ? <p className="notice" style={{ marginTop: 12 }}>{warning}</p> : null}
            </section>

            {criteria ? (
              <>
                <section className="card" aria-labelledby="und-h">
                  <div className="card-head">
                    <h2 id="und-h">What we understood</h2>
                    <span className="small">Read by {reader === "claude" ? "Claude" : "the built-in reader"}{questions.length ? ` · ${questions.length} need${questions.length === 1 ? "s" : ""} your answer` : ""}</span>
                  </div>
                  <p className="small" style={{ margin: "0 0 8px" }}>Every item is a hard limit. Select one to change it, or edit your description and read it again.</p>
                  {groups.map((g) => (
                    <div className="group-row" key={g.label}>
                      <div className="group-label">{g.label}</div>
                      <div className="group-items chips">{g.chips}</div>
                    </div>
                  ))}
                  {unknownAirport ? (
                    <p className="notice notice-bad" style={{ marginTop: 8 }}>We don't have coordinates for {unknownAirport} yet, so we can't measure hotel distance. Pick a nearby major airport or add it to lib/airports.ts.</p>
                  ) : null}
                  {questions.map((q) => (
                    <div key={q} className="notice" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", marginTop: 8 }}>
                      <div style={{ flex: "1 1 320px" }}>{q}</div>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setDismissed((d) => [...d, q])}>OK</button>
                    </div>
                  ))}
                </section>

                <section className="card" aria-labelledby="times-h">
                  <div className="card-head">
                    <h2 id="times-h">Flight times</h2>
                    <span className="small">Filled in from your description · local airport times</span>
                  </div>
                  <p className="small" style={{ margin: "0 0 16px" }}>Flights that leave or land outside these windows are left out.</p>
                  <div className="windows">
                    <fieldset className="leg">
                      <legend>Outbound{criteria.departDate ? ` · ${fmtDate(criteria.departDate)}` : ""}</legend>
                      <div className="small" style={{ marginBottom: 10 }}>{criteria.origin} → {criteria.destination}</div>
                      <WindowInput label={`Leave ${criteria.origin || "origin"} between`} value={criteria.flight.outbound.depart} onChange={(w) => set((x) => { x.flight.outbound.depart = w; })} />
                      <WindowInput label={`Land at ${criteria.destination || "destination"} between`} value={criteria.flight.outbound.arrive} onChange={(w) => set((x) => { x.flight.outbound.arrive = w; })} />
                    </fieldset>
                    <fieldset className="leg">
                      <legend>Return{criteria.returnDate ? ` · ${fmtDate(criteria.returnDate)}` : ""}</legend>
                      <div className="small" style={{ marginBottom: 10 }}>{criteria.destination} → {criteria.origin}</div>
                      <WindowInput label={`Leave ${criteria.destination || "destination"} between`} value={criteria.flight.inbound.depart} onChange={(w) => set((x) => { x.flight.inbound.depart = w; })} />
                      <WindowInput label={`Land at ${criteria.origin || "origin"} between`} value={criteria.flight.inbound.arrive} onChange={(w) => set((x) => { x.flight.inbound.arrive = w; })} />
                    </fieldset>
                  </div>
                </section>
              </>
            ) : null}
          </div>

          <aside className="side-col">
            <section className="card" aria-labelledby="mem-h">
              <h2 id="mem-h">Your memberships</h2>
              <p className="small" style={{ margin: "4px 0 12px" }}>Points are counted at the value you set per point (¢). Saved in this browser.</p>
              <ul className="list">
                {memberships.map((m) => (
                  <li key={m.id}>
                    <label className="check-row" style={{ minHeight: 36 }}>
                      <input type="checkbox" checked={m.enabled} onChange={(e) => updateMembership(m.id, { enabled: e.target.checked })} />
                      <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{m.name}</b> <span className="small">· {m.detail}</span></span>
                    </label>
                    {m.balance !== null && m.centsPerPoint !== null ? (
                      <div className="mem-row">
                        <label className="stack small">Balance
                          <input className="field" type="number" min={0} step={1000} value={m.balance} onChange={(e) => updateMembership(m.id, { balance: Number(e.target.value) })} />
                        </label>
                        <label className="stack small">Value (¢ per point)
                          <input className="field" type="number" min={0} step={0.1} value={m.centsPerPoint} onChange={(e) => updateMembership(m.id, { centsPerPoint: Number(e.target.value) })} />
                        </label>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="src-h">
              <h2 id="src-h" style={{ marginBottom: 12 }}>Sources to search</h2>
              {(["api", "browser"] as const).map((kind) => (
                <div key={kind} style={{ marginBottom: 8 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{kind === "api" ? "Travel data" : "Membership sites"}</div>
                  {sources.filter((s) => s.kind === kind).map((s) => (
                    <label key={s.id} className="check-row">
                      <input type="checkbox" checked={enabled.includes(s.id)} onChange={(e) => setEnabled((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))} />
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <span className="small">{s.via}</span>
                    </label>
                  ))}
                </div>
              ))}
              <p className="small" style={{ margin: "8px 0 0", padding: 12, background: "var(--bg)", borderRadius: 8 }}>Membership sites are checked in your own signed-in browser. Your passwords stay on your computer.</p>
            </section>

            <section className="card" aria-labelledby="rank-h">
              <h2 id="rank-h" style={{ marginBottom: 12 }}>Ranking</h2>
              <label className="stack">Sort by
                <select className="field" value={options.sortBy} onChange={(e) => setOptions({ ...options, sortBy: e.target.value as RankOptions["sortBy"] })}>
                  <option value="effective">Lowest effective cost (cash + points value)</option>
                  <option value="cash">Lowest cash out of pocket</option>
                  <option value="points">Fewest points used</option>
                </select>
              </label>
              <label className="stack" style={{ marginTop: 12 }}>Number of matches
                <select className="field" value={options.limit} onChange={(e) => setOptions({ ...options, limit: Number(e.target.value) })}>
                  {[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </section>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" className="btn btn-primary btn-big" onClick={search} disabled={!ready || chosen.length === 0}>
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 12l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Search {chosen.length} source{chosen.length === 1 ? "" : "s"}
              </button>
              {!criteria ? <p className="small" style={{ margin: 0, textAlign: "center" }}>Read your trip first.</p> : blocker ? <p className="small" role="status" style={{ margin: 0, textAlign: "center" }}>{blocker}</p> : null}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
