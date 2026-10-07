import test from "node:test";
import assert from "node:assert/strict";
import { cleanSearchTerm, containsPattern } from "../src/lib/community/search-term";

test("cleanSearchTerm trims, collapses whitespace and caps length", () => {
  assert.equal(cleanSearchTerm("  arsenal \n  fc  "), "arsenal fc");
  assert.equal(cleanSearchTerm("x".repeat(100)).length, 60);
  assert.equal(cleanSearchTerm("abcdef", 3), "abc");
});

test("containsPattern escapes LIKE wildcards so user text matches literally", () => {
  assert.equal(containsPattern("arsenal"), "%arsenal%");
  assert.equal(containsPattern("100%"), "%100\\%%");
  assert.equal(containsPattern("a_b"), "%a\\_b%");
  assert.equal(containsPattern("c:\\x"), "%c:\\\\x%");
});

test("containsPattern leaves filter-syntax characters alone because the value is bound, not spliced into a filter string", () => {
  assert.equal(containsPattern("a,b).c("), "%a,b).c(%");
});
