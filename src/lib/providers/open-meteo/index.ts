import "server-only";
import { providerFetch } from "../http";
import type { ProviderAdapter } from "../types";
import type { Weather } from "@/types/context";
import { normalizeOpenMeteo, type OmResponse } from "./normalize";
/** Free, no key. Forecast window is about 16 days. */
export const openMeteo: ProviderAdapter<Weather | null, { lat: number; lon: number; kickoffUtc: string }> = {
  id: "open-meteo",
  async fetch({ lat, lon, kickoffUtc }) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability&timezone=GMT&forecast_days=16`;
    const { json, latencyMs } = await providerFetch<OmResponse>({ provider: "open-meteo", url });
    return { data: normalizeOpenMeteo(json, kickoffUtc), meta: { provider: "open-meteo", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: true }; },
};
