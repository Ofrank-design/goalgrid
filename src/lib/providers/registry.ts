import type { ProviderAdapter, ProviderId } from "./types";
const adapters = new Map<ProviderId, ProviderAdapter<unknown, never>>();
export const registerProvider = (a: ProviderAdapter<unknown, never>) => void adapters.set(a.id, a);
export const getProvider = (id: ProviderId) => { const a = adapters.get(id); if (!a) throw new Error(`Provider not registered: ${id}`); return a; };
export const listProviders = () => [...adapters.keys()];
