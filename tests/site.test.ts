import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isExternal, tokenize } from "../src/lib/site/inline";
import { checkContact } from "../src/lib/site/contact";
const root = process.cwd(), SLUGS = ["about", "methodology", "responsible-use", "privacy", "terms", "contact"];
const ROUTES = new Set(["/accuracy", "/contact", "/responsible-use", "/privacy", "/terms", "/about", "/methodology", "/dashboard", "/community"]);
const page = (s: string) => JSON.parse(readFileSync(join(root, "src/content/info", s + ".json"), "utf8"));
test("inline links tokenize", () => {
  assert.deepEqual(tokenize("a [b](/c) d"), [{ t: "text", v: "a " }, { t: "link", v: "b", href: "/c" }, { t: "text", v: " d" }]); assert.deepEqual(tokenize("plain"), [{ t: "text", v: "plain" }]); assert.ok(isExternal("https://x.y") && !isExternal("/x"));
});
test("all six pages exist with a hero image, unique section ids and valid links", () => {
  for (const s of SLUGS) {
    const p = page(s); assert.equal(p.slug, s); assert.ok(p.title && p.eyebrow && p.lead.length > 20); assert.ok(existsSync(join(root, "public/site", s + ".webp")), `hero ${s}`);
    const ids = p.sections.map((x: { id: string }) => x.id); assert.equal(new Set(ids).size, ids.length, `ids ${s}`);
    for (const sec of p.sections) { assert.ok(sec.heading); assert.ok(sec.slot === "form" || sec.paragraphs?.length || sec.bullets?.length, `${s}/${sec.id} has no content`);
      for (const text of [...(sec.paragraphs ?? []), ...(sec.bullets ?? []), sec.note ?? ""]) for (const t of tokenize(text)) if (t.t === "link" && !isExternal(t.href) && !t.href.startsWith("mailto:")) assert.ok(ROUTES.has(t.href), `${s}: link ${t.href}`); }
  }
  assert.ok(SLUGS.filter(s => page(s).sections.some((x: { slot?: string }) => x.slot === "form")).join() === "contact");
});
test("contact validation", () => {
  const ok = { name: " Ada ", email: "ADA@Example.com", topic: "bug", message: "The page does not load for me." };
  const r = checkContact(ok); assert.ok(r.ok && r.data.email === "ada@example.com" && r.data.name === "Ada");
  for (const bad of [{ ...ok, name: "" }, { ...ok, email: "nope" }, { ...ok, topic: "spam" }, { ...ok, message: "short" }, { ...ok, message: "x".repeat(2001) }, null]) assert.ok(!checkContact(bad).ok);
});
