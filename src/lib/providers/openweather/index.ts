import "server-only";
import { env } from "@/lib/env";
import { providerFetch } from "../http";
import { ProviderError, type ProviderAdapter } from "../types";
import type { Weather } from "@/types/context";
import { normalizeOpenWeather, type OwResponse } from "./normalize";
export const openWeather: ProviderAdapter<Weather | null, { lat: number; lon: number; kickoffUtc: string }> & { configured(): boolean } = {
  id: "openweather",
  configured: () => Boolean(env().OPENWEATHER_API_KEY),
  async fetch({ lat, lon, kickoffUtc }) {
    const key = env().OPENWEATHER_API_KEY; if (!key) throw new ProviderError("openweather", "auth", "Not configured");
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(key)}`;
    const { json, latencyMs } = await providerFetch<OwResponse>({ provider: "openweather", url });
    return { data: normalizeOpenWeather(json, kickoffUtc), meta: { provider: "openweather", fetchedAt: new Date().toISOString(), cached: false, latencyMs } };
  },
  async health() { return { ok: this.configured() }; },
};
