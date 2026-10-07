import test from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_BYTES, checkUpload, sniffImage } from "../src/lib/security/upload";
import { needsSignIn } from "../src/proxy";
import { REPORT_CATEGORIES } from "../src/lib/community/rules";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = Uint8Array.from([...Buffer.from("RIFF"), 1, 0, 0, 0, ...Buffer.from("WEBP")]);
test("upload: real type comes from the bytes, only jpg, png and webp pass", () => {
  assert.equal(sniffImage(png), "png"); assert.equal(sniffImage(jpg), "jpg"); assert.equal(sniffImage(webp), "webp");
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null); assert.equal(sniffImage(Buffer.from("MZ\x90\x00executable")), null); assert.equal(sniffImage(Buffer.from("GIF89a....")), null);
});
test("upload: size limit, empty files, and server made paths", () => {
  assert.equal(checkUpload(new Uint8Array(0), "u1", "proofs").ok, false);
  const big = new Uint8Array(MAX_UPLOAD_BYTES + 1); big.set(png); assert.equal(checkUpload(big, "u1", "proofs").ok, false);
  const a = checkUpload(png, "user-1", "proofs"), b = checkUpload(png, "user-1", "proofs"); assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) { assert.match(a.path, /^proofs\/user-1\/[0-9a-f-]{36}\.png$/); assert.notEqual(a.path, b.path); assert.equal(a.contentType, "image/png"); }
});
test("a file named like an image but holding other content is refused", () => { assert.equal(checkUpload(Buffer.from("<?php echo 1; ?>"), "u", "avatars").ok, false); });
test("proxy: signed-in and staff pages redirect, public pages do not", () => {
  for (const p of ["/settings", "/admin", "/admin/moderation", "/moderator/queue", "/my-predictions", "/community/create", "/community/bookings/create", "/community/bookings/abc/edit", "/profile/edit"]) assert.ok(needsSignIn(p), p);
  for (const p of ["/", "/matches", "/matches/sm:1", "/community", "/community/post/1", "/leaderboard", "/profile/someone", "/administrator", "/settings-help", "/api/health"]) assert.ok(!needsSignIn(p), p);
});
test("report reasons match the safety spec list", () => { assert.equal(REPORT_CATEGORIES.length, 9); assert.ok(REPORT_CATEGORIES.includes("scam") && REPORT_CATEGORIES.includes("other")); });
