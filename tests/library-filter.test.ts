import assert from "node:assert/strict";
import {
  emptyLibraryMessage,
  libraryCounts,
  visibleLibraryBooks,
} from "../src/client/library-filter.ts";

const books = [
  { title: "La brume", author: "Ada", ownership: "owned", completed: true },
  { title: "L'horloge", author: "Milo", ownership: "wishlist", completed: false },
  { title: "Le jardin", author: "Nina", ownership: "none", completed: true },
  { title: "Le cartographe", author: "Oscar", ownership: "owned", completed: false },
];

const counts = libraryCounts(books);
assert.equal(counts.all, 4);
assert.equal(counts.read, 2);
assert.equal(counts.wishlist, 1);
assert.equal(counts.owned, 2);
assert.notEqual(counts.owned + counts.wishlist + counts.read, counts.all);

assert.deepEqual(
  visibleLibraryBooks(books, "", "all").map((book) => book.title),
  books.map((book) => book.title),
);
assert.deepEqual(
  visibleLibraryBooks(books, "nina", "read").map((book) => book.title),
  ["Le jardin"],
);
assert.deepEqual(visibleLibraryBooks(books, "nina", "owned"), []);
assert.deepEqual(
  visibleLibraryBooks(books, "oscar", "owned").map((book) => book.title),
  ["Le cartographe"],
);
assert.equal(
  visibleLibraryBooks(books, "", "wishlist").some((book) => book.completed),
  false,
);
assert.equal(
  visibleLibraryBooks(books, "", "owned").some((book) => book.ownership === "none"),
  false,
);

const classified = [
  { ...books[0], category: "novel", collection: null },
  { ...books[1], category: "comic", collection: "Lucky Luke" },
  { ...books[2], category: null, collection: null },
  { ...books[3], category: "essay", collection: "Lucky Luke" },
];
assert.equal(libraryCounts(classified).all, 4);
assert.equal(libraryCounts(classified).owned, 2);
assert.deepEqual(
  visibleLibraryBooks(classified, "", "owned", "comic").map((book) => book.title),
  [],
);
assert.deepEqual(
  visibleLibraryBooks(classified, "milo", "wishlist", "comic", "lucky").map(
    (book) => book.title,
  ),
  ["L'horloge"],
);
assert.equal(
  emptyLibraryMessage("owned", "", "Bande dessinée"),
  "Aucun livre pour J’ai, Bande dessinée.",
);

assert.equal(
  emptyLibraryMessage("all", "zzzz"),
  "Aucun livre ne correspond à cette recherche.",
);
assert.equal(emptyLibraryMessage("read", "   "), "Aucun livre pour Lu.");
assert.match(emptyLibraryMessage("wishlist", "ada"), /Je veux/);
assert.match(emptyLibraryMessage("owned", "ada"), /« ada »/);

console.log("library-filter.test.ts : ok");
