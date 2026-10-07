/** Usage: tsx scripts/loadtest.ts <url> [concurrency=20] [seconds=15]. Run it against a staging site, never against production without warning your providers. */
async function main() {
  const [url, c = "20", s = "15"] = process.argv.slice(2); if (!url) { console.error("Usage: tsx scripts/loadtest.ts <url> [concurrency] [seconds]"); process.exit(1); }
  const conc = Number(c), end = Date.now() + Number(s) * 1000, lat: number[] = [], codes = new Map<string, number>();
  async function worker() { while (Date.now() < end) { const t = performance.now(); try { const r = await fetch(url, { headers: { "User-Agent": "goalgrid-loadtest" } }); await r.arrayBuffer(); codes.set(String(r.status), (codes.get(String(r.status)) ?? 0) + 1); } catch { codes.set("error", (codes.get("error") ?? 0) + 1); } lat.push(performance.now() - t); } }
  const t0 = Date.now(); await Promise.all(Array.from({ length: conc }, worker));
  lat.sort((a, b) => a - b); const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))]?.toFixed(0), secs = (Date.now() - t0) / 1000;
  console.log(`${lat.length} requests in ${secs.toFixed(1)}s (${(lat.length / secs).toFixed(1)}/s) at concurrency ${conc}`);
  console.log(`latency ms: p50 ${q(0.5)}  p95 ${q(0.95)}  p99 ${q(0.99)}  max ${lat[lat.length - 1]?.toFixed(0)}`); console.log("status:", Object.fromEntries(codes));
}
void main();
