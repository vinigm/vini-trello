import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Vinello GitHub Pages app", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

  assert.match(html, /<title>Vinello — organize do seu jeito<\/title>/i);
  assert.match(html, /id="root"/i);
  assert.match(html, /\/vini-trello\/assets\/index-/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});
