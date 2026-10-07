import type { Weather } from "../../../types/context";
export interface OmResponse { hourly?: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[]; wind_speed_10m: number[]; precipitation_probability?: number[] } }
/** Picks the forecast hour nearest kickoff. Returns null if the nearest hour is more than 90 minutes away. */
export function normalizeOpenMeteo(r: OmResponse, kickoffUtc: string, now = new Date()): Weather | null {
  const h = r.hourly; if (!h?.time?.length) return null;
  const k = Date.parse(kickoffUtc); let bi = -1, bd = Infinity;
  h.time.forEach((t, i) => { const d = Math.abs(Date.parse(t + "Z") - k); if (d < bd) { bd = d; bi = i; } });
  if (bi < 0 || bd > 90 * 60_000 || h.temperature_2m[bi] == null) return null;
  return { tempC: h.temperature_2m[bi], humidityPct: h.relative_humidity_2m[bi], windKmh: h.wind_speed_10m[bi], rainChancePct: h.precipitation_probability?.[bi] ?? null, forecastForUtc: new Date(h.time[bi] + "Z").toISOString(),
    provenance: { source: "open-meteo", retrievedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3_600_000).toISOString() } };
}
