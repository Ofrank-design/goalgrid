import { createHash, timingSafeEqual } from "node:crypto";
const d = (s: string) => createHash("sha256").update(s).digest();
export const safeEqual = (expected: string | undefined, submitted: string): boolean => Boolean(expected) && timingSafeEqual(d(submitted), d(expected as string));
/** Constant time check of an Authorization: Bearer header. */
export function bearerOk(header: string | null, secret: string): boolean { return Boolean(secret) && header !== null && timingSafeEqual(d(header), d(`Bearer ${secret}`)); }
