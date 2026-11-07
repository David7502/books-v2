import assert from "node:assert/strict";
import {
  appendBook,
  createBook,
  validateNewBook,
} from "../src/client/add-book.ts";
import { demoBooks, hasCompletedReading } from "../src/client/demo-books.ts";
import { bookMatchesQuery } from "../src/client/search.ts";

const missingTitle = validateNewBook({
  title: "   ",
  author: " Lina ",
  ownership: "owned",
});
assert.equal(missingTitle.ok, false);
if (!missingTitle.ok) {
  assert.deepEqual(missingTitle.errors, ["title"]);
}

const missingAuthor = validateNewBook({
  title: " Nuage ",
  author: " \n ",
  ownership: "wishlist",
});
assert.equal(missingAuthor.ok, false);
if (!missingAuthor.ok) {
  assert.deepEqual(missingAuthor.errors, ["author"]);
}

const missingBoth = validateNewBook({
  title: " ",
  author: " ",
  ownership: "none",
});
assert.equal(missingBoth.ok, false);
if (!missingBoth.ok) {
  assert.deepEqual(missingBoth.errors, ["title", "author"]);
}

for (const ownership of ["owned", "wishlist", "none"] as const) {
  const result = validateNewBook({
    title: "  Le nuage en papier  ",
    author: "  Lina Brume  ",
    ownership,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.book.title, "Le nuage en papier");
    assert.equal(result.book.author, "Lina Brume");
    assert.equal(result.book.ownership, ownership);
  }
}

const added = createBook(
  { title: "Le nuage en papier", author: "Lina Brume", ownership: "owned" },
  "new-nuage",
);
assert.equal(added.coverKey, undefined);
assert.equal(hasCompletedReading(added.id), false);

const nextBooks = appendBook(demoBooks, added);
assert.equal(demoBooks.length, 4);
assert.equal(nextBooks.length, 5);
assert.notEqual(nextBooks, demoBooks);
assert.deepEqual(
  nextBooks.slice(0, 4).map((book) => book.id),
  demoBooks.map((book) => book.id),
);
assert.equal(nextBooks[0]?.ownership, "owned");
assert.equal(hasCompletedReading("demo-brume"), true);
assert.equal(hasCompletedReading("demo-horloge"), false);
assert.equal(hasCompletedReading("demo-jardin"), true);
assert.equal(hasCompletedReading("demo-cartographe"), false);

assert.deepEqual(
  nextBooks.filter((book) => bookMatchesQuery(book, "nuage")).map((book) => book.id),
  ["new-nuage"],
);
assert.deepEqual(
  nextBooks.filter((book) => bookMatchesQuery(book, "phare")).map((book) => book.id),
  ["demo-brume"],
);

console.log("add-book.test.ts : ok");
