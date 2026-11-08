import assert from "node:assert/strict";
import { editBookId, normalizePath, readingBookId } from "../src/client/path.ts";

assert.equal(normalizePath("/"), "/");
assert.equal(normalizePath(""), "/");
assert.equal(normalizePath("/ajouter"), "/ajouter");
assert.equal(normalizePath("/ajouter/"), "/ajouter");
assert.equal(editBookId("/livres/demo-brume/modifier"), "demo-brume");
assert.equal(editBookId("/livres/demo-brume/modifier/"), "demo-brume");
assert.equal(editBookId("/livres/id%20livre/modifier"), "id livre");
assert.equal(editBookId("/ajouter"), null);
assert.equal(editBookId("/livres/demo-brume"), null);
assert.equal(readingBookId("/livres/demo-brume/lecture"), "demo-brume");
assert.equal(readingBookId("/livres/demo-brume/lecture/"), "demo-brume");
assert.equal(readingBookId("/livres/demo-brume/lectures"), null);
assert.equal(readingBookId("/livres/demo-brume/modifier"), null);

console.log("path.test.ts : ok");
