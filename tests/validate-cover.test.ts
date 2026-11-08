import assert from "node:assert/strict";
import { detectCoverType, validateCoverBytes } from "../src/worker/validate-cover.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new Uint8Array(12);
webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const svg = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
);
const html = new TextEncoder().encode("<!doctype html><html><body>livre</body></html>");

assert.equal(detectCoverType(png), "image/png");
assert.equal(detectCoverType(jpeg), "image/jpeg");
assert.equal(detectCoverType(webp), "image/webp");
assert.equal(detectCoverType(svg), null);
assert.equal(detectCoverType(html), null);

const namedSvg = validateCoverBytes(svg, "image/jpeg");
assert.equal(namedSvg.ok, false);

const mismatch = validateCoverBytes(png, "image/jpeg");
assert.equal(mismatch.ok, false);
if (!mismatch.ok) {
  assert.match(mismatch.error, /type annoncé/);
}

const accepted = validateCoverBytes(png, "image/png; charset=binary");
assert.equal(accepted.ok, true);
if (accepted.ok) {
  assert.equal(accepted.contentType, "image/png");
}

const tooBig = validateCoverBytes(new Uint8Array(2 * 1024 * 1024 + 1), "image/png");
assert.equal(tooBig.ok, false);
const empty = validateCoverBytes(new Uint8Array(), "image/png");
assert.equal(empty.ok, false);

console.log("validate-cover.test.ts : ok");
