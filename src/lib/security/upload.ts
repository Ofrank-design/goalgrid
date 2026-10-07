import { randomUUID } from "node:crypto";
/** Upload policy: JPG, PNG or WebP only, at most 1 MB, type taken from the file's own bytes, path made on the server. */
export const MAX_UPLOAD_BYTES = 1_000_000;
const KINDS = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export type ImageKind = keyof typeof KINDS;
/** Reads the real type from the first bytes. The client's file name and declared type are never trusted. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
export type UploadCheck = { ok: true; kind: ImageKind; contentType: string; path: string } | { ok: false; error: string };
/** The path is built from the user id and a random name, so a user can never choose where a file lands or overwrite another's. */
export function checkUpload(bytes: Uint8Array, userId: string, folder: "avatars" | "proofs"): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "Images must be 1 MB or smaller." };
  const kind = sniffImage(bytes); if (!kind) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  return { ok: true, kind, contentType: KINDS[kind], path: `${folder}/${userId}/${randomUUID()}.${kind}` };
}
