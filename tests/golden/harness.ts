/**
 * Test harness for components that animate with requestAnimationFrame. Mounts the real component in jsdom with a fake frame clock so playback is
 * fully deterministic, and records a hash of the rendered HTML at each step. Used as a golden master: record against known-good code, then every
 * refactor must reproduce the same hashes.
 */
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";

export type Trace = Record<string, string>;
export const hash = (html: string) => createHash("sha256").update(html).digest("hex").slice(0, 16);

const REAL_PERFORMANCE = globalThis.performance;
let T = 0, nextId = 1, queue: [number, (t: number) => void][] = [];
const cancelled = new Set<number>();

export function installDom(opts: { reducedMotion?: boolean } = {}) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const w = dom.window as unknown as Record<string, unknown>;
  const define = (k: string, v: unknown) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  for (const k of ["window", "document", "HTMLElement", "Element", "Node", "SVGElement", "Event", "MouseEvent", "KeyboardEvent", "MutationObserver"]) define(k, k === "window" ? dom.window : w[k]);
  define("navigator", dom.window.navigator);
  define("IS_REACT_ACT_ENVIRONMENT", true);
  T = 0; nextId = 1; queue = []; cancelled.clear();
  // Wrap the real performance object so React's dev profiling (mark/measure) still works; only now() is under test control.
  const realPerf = REAL_PERFORMANCE;
  define("performance", new Proxy(realPerf, { get: (target, prop) => prop === "now" ? () => T : (typeof target[prop as keyof Performance] === "function" ? (target[prop as keyof Performance] as (...a: unknown[]) => unknown).bind(target) : target[prop as keyof Performance]) }));
  define("requestAnimationFrame", (cb: (t: number) => void) => { const id = nextId++; queue.push([id, cb]); return id; });
  define("cancelAnimationFrame", (id: number) => { cancelled.add(id); });
  (dom.window as unknown as Record<string, unknown>).matchMedia = (q: string) => ({ matches: Boolean(opts.reducedMotion) && /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  return dom;
}

export async function mount<P extends object>(dom: JSDOM, Component: ComponentType<P>, props: P): Promise<{ root: Root; html: () => string; buttons: () => HTMLButtonElement[] }> {
  const el = dom.window.document.getElementById("root")!, root = createRoot(el);
  await act(async () => { root.render(createElement(Component, props)); });
  return { root, html: () => el.innerHTML, buttons: () => [...el.querySelectorAll("button")] as unknown as HTMLButtonElement[] };
}

/** Advances the fake clock one animation frame at a time, running every callback that was waiting for a frame. */
export async function frames(n: number, dtMs = 16.7) {
  for (let i = 0; i < n; i++) {
    T += dtMs; const due = queue.splice(0);
    await act(async () => { for (const [id, cb] of due) if (!cancelled.has(id)) cb(T); });
  }
}
export async function click(el: HTMLElement) { await act(async () => { el.dispatchEvent(new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true, cancelable: true })); }); }

/** Lets pending promises and timers (mocked fetch, state updates) finish inside act. */
export async function settle(rounds = 3) { for (let i = 0; i < rounds; i++) await act(async () => { await new Promise(r => setTimeout(r, 4)); }); }
/** Sets a form control's value the way a user would, so React's change tracking sees it. */
export async function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el.tagName === "SELECT" ? "HTMLSelectElement" : "HTMLInputElement";
  const win = (globalThis as unknown as { window: Record<string, { prototype: object }> }).window;
  Object.getOwnPropertyDescriptor(win[proto].prototype, "value")!.set!.call(el, value);
  await act(async () => { el.dispatchEvent(new (globalThis as unknown as { Event: typeof Event }).Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
