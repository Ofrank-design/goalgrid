import { luminance } from "@/lib/simulation/visual";

export function easeSmooth(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

export function lineColor(kit: { fill: string; trim: string }) {
  return luminance(kit.fill) < 0.05 ? kit.trim : kit.fill;
}

export function formatClock(clock: number, addedTime: number) {
  return clock <= 90
    ? `${Math.max(0, Math.floor(clock))}'`
    : `90+${Math.min(addedTime, Math.floor(clock - 90))}'`;
}
