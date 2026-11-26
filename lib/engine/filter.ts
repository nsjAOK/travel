// Hard-limit checks. A check is ok:true (meets it), ok:false (fails it), or
// ok:null when the source didn't say (e.g. room size missing from a listing).
import { carLabel } from "@/lib/cars";
import type { CarOffer, Check, Criteria, FlightOffer, HotelOffer, TimeWindow } from "@/lib/types";
import { findAirport, milesBetween } from "@/lib/airports";
import { amenityLabel } from "@/lib/amenities";
import { carRank } from "@/lib/adapters/sample";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function inWindow(isoLocal: string, w: TimeWindow): boolean {
  const t = toMin(isoLocal.slice(11, 16));
  const a = toMin(w.from);
  const b = toMin(w.to);
  return a <= b ? t >= a && t <= b : t >= a || t <= b; // b < a means it wraps past midnight
}

const isAnyTime = (w: TimeWindow) => w.from === "00:00" && w.to === "23:59";

/**
 * One leg meets its windows when it leaves on the planned day inside the
 * departure window and lands inside the arrival window. When the traveler set
 * an arrival window ("land by 6 pm"), it must also land that same day, unless
 * the window itself runs past midnight; an overnight flight landing the next
 * morning doesn't meet "by 6 pm".
 */
function legOk(leg: { depart: string; arrive: string }, date: string, win: { depart: TimeWindow; arrive: TimeWindow }): boolean {
  if (leg.depart.slice(0, 10) !== date) return false;
  if (!inWindow(leg.depart, win.depart) || !inWindow(leg.arrive, win.arrive)) return false;
  const wraps = toMin(win.arrive.from) > toMin(win.arrive.to);
  if (!isAnyTime(win.arrive) && !wraps && leg.arrive.slice(0, 10) !== date) return false;
  return true;
}

export function flightChecks(c: Criteria, f: FlightOffer): Check[] {
  const ff = c.flight;
  const nextDay = (leg: { depart: string; arrive: string }) => leg.arrive.slice(0, 10) > leg.depart.slice(0, 10);
  return [
    { label: f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`, ok: f.stops <= ff.maxStops },
    { label: nextDay(f.outbound) ? "Outbound times (lands next day)" : "Outbound times", ok: legOk(f.outbound, c.departDate, ff.outbound) },
    { label: nextDay(f.inbound) ? "Return times (lands next day)" : "Return times", ok: legOk(f.inbound, c.returnDate, ff.inbound) },
  ];
}

export function hotelMiles(c: Criteria, h: HotelOffer): number {
  const a = findAirport(c.destination);
  return a ? milesBetween(a.lat, a.lng, h.lat, h.lng) : Infinity;
}

export function hotelChecks(c: Criteria, h: HotelOffer): Check[] {
  const hh = c.hotel;
  const checks: Check[] = [];
  const miles = hotelMiles(c, h);
  checks.push({ label: `${miles.toFixed(1)} mi from ${c.destination}`, ok: miles <= hh.maxMilesFromAirport });
  if (hh.minStars !== null) checks.push({ label: h.stars !== null ? `${h.stars}★` : "Star class", ok: h.stars === null ? null : h.stars >= hh.minStars });
  if (hh.minRating !== null) checks.push({ label: h.rating !== null ? `${h.rating.toFixed(1)} / 10` : "Guest rating", ok: h.rating === null ? null : h.rating >= hh.minRating });

  if (hh.minBedrooms !== null || hh.minSqft !== null) {
    // Either limit is enough: "2 bedrooms or 600 sq ft".
    const byBeds = hh.minBedrooms !== null && h.bedrooms !== null ? h.bedrooms >= hh.minBedrooms : null;
    const bySqft = hh.minSqft !== null && h.sqft !== null ? h.sqft >= hh.minSqft : null;
    const ok = byBeds === true || bySqft === true ? true : byBeds === null && bySqft === null ? null : false;
    const parts = [h.bedrooms ? `${h.bedrooms} BR` : null, h.sqft ? `${h.sqft} sq ft` : null].filter(Boolean);
    checks.push({ label: parts.length ? parts.join(" · ") : "Room size", ok });
  }

  if (hh.amenities.length) {
    const missing = hh.amenities.filter((a) => !h.amenities.includes(a));
    // Live listings often leave amenities out, so a missing one is "unconfirmed" there.
    const ok = missing.length === 0 ? true : h.sample ? false : null;
    checks.push({
      label: missing.length === 0 ? `All ${hh.amenities.length} amenities` : `Not listed: ${missing.map(amenityLabel).join(", ")}`,
      ok,
    });
  }
  return checks;
}

export function carChecks(c: Criteria, car: CarOffer): Check[] {
  if (!c.car.vehicleClass) return [];
  return [{ label: carLabel(car.vehicleClass), ok: carRank(car.vehicleClass) >= carRank(c.car.vehicleClass) }];
}

/** false if any check fails; unconfirmed checks pass here and are shown in amber. */
export const passes = (checks: Check[]) => checks.every((k) => k.ok !== false);
export const confirmed = (checks: Check[]) => checks.every((k) => k.ok === true);
