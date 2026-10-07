import type { Weather } from "../../../types/context";
export interface OwResponse { list?: { dt: number; main: { temp: number; humidity: number }; wind: { speed: number }; pop?: number }[] }
/** OpenWeather 5 day / 3 hour forecast. Wind arrives in m/s and is converted to km/h. */
export function normalizeOpenWeather(r: OwResponse, kickoffUtc: string, now = new Date()): Weather | null {
  const k = Date.parse(kickoffUtc); let best: NonNullable<OwResponse["list"]>[number] | undefined, bd = Infinity;
  for (const e of r.list ?? []) { const d = Math.abs(e.dt * 1000 - k); if (d < bd) { bd = d; best = e; } }
  if (!best || bd > 3 * 3_600_000) return null;
  return { tempC: best.main.temp, humidityPct: best.main.humidity, windKmh: Math.round(best.wind.speed * 3.6 * 10) / 10, rainChancePct: best.pop != null ? Math.round(best.pop * 100) : null, forecastForUtc: new Date(best.dt * 1000).toISOString(),
    provenance: { source: "openweather", retrievedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3_600_000).toISOString() } };
}
