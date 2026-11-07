import assert from "node:assert/strict";
import { normalizePath } from "../src/client/path.ts";

assert.equal(normalizePath("/"), "/");
assert.equal(normalizePath(""), "/");
assert.equal(normalizePath("/ajouter"), "/ajouter");
assert.equal(normalizePath("/ajouter/"), "/ajouter");

console.log("path.test.ts : ok");
