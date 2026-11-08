import assert from "node:assert/strict";
import { replaceBook, validateNewBook } from "../src/client/add-book.ts";
import { demoBooks, hasCompletedReading } from "../src/client/demo-books.ts";
import { bookMatchesQuery } from "../src/client/search.ts";

const before = demoBooks.map((book) => ({ ...book, coverKey: "cover-brume" }));
const target = before[0];
assert.ok(target);

const invalid = validateNewBook({
  title: "   ",
  author: target.author,
  ownership: "wishlist",
});
assert.equal(invalid.ok, false);

const valid = validateNewBook({
  title: "  La brume renommée  ",
  author: "  Ada Nouvelle  ",
  ownership: "wishlist",
});
assert.equal(valid.ok, true);
if (!valid.ok) {
  throw new Error("validation attendue");
}

const next = replaceBook(before, target.id, valid.book);
assert.equal(next.length, before.length);
assert.equal(new Set(next.map((book) => book.id)).size, next.length);
assert.equal(before[0]?.title, "La brume du phare");
assert.equal(next[0]?.id, target.id);
assert.equal(next[0]?.title, "La brume renommée");
assert.equal(next[0]?.author, "Ada Nouvelle");
assert.equal(next[0]?.ownership, "wishlist");
assert.equal(next[0]?.coverKey, "cover-brume");
assert.equal(next[1], before[1]);
assert.equal(next[2], before[2]);
assert.equal(next[3], before[3]);
assert.equal(hasCompletedReading(target.id), true);
assert.deepEqual(
  next.filter((book) => bookMatchesQuery(book, "renommee")).map((book) => book.id),
  [target.id],
);
assert.deepEqual(
  next.filter((book) => bookMatchesQuery(book, "phare")).map((book) => book.id),
  [],
);

const missing = replaceBook(before, "livre-absent", valid.book);
assert.equal(missing.length, before.length);
assert.deepEqual(
  missing.map((book) => book.title),
  before.map((book) => book.title),
);

console.log("edit-book.test.ts : ok");
