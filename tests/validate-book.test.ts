import assert from "node:assert/strict";
import { validateBookInput, validateCreateBook } from "../src/worker/validate.ts";

const injection = "Robert'); DROP TABLE books;--";
const accepted = validateBookInput({
  title: `  ${injection}  `,
  author: "Ada",
  ownership: "owned",
});
assert.equal(accepted.ok, true);
if (accepted.ok) {
  assert.equal(accepted.book.title, injection);
  assert.equal(accepted.book.ownership, "owned");
  assert.equal(accepted.book.category, null);
  assert.equal(accepted.book.collection, null);
}

assert.equal(validateBookInput({ title: "   ", author: "Ada", ownership: "owned" }).ok, false);
assert.equal(validateBookInput({ title: "Titre", author: "  ", ownership: "wishlist" }).ok, false);
assert.equal(validateBookInput({ title: "Titre", author: "Ada", ownership: "borrowed" }).ok, false);
assert.equal(validateBookInput(["Titre"]).ok, false);
assert.equal(
  validateBookInput({ title: "a".repeat(201), author: "Ada", ownership: "none" }).ok,
  false,
);

const created = validateCreateBook({
  title: "Emprunt",
  author: "Lina",
  ownership: "none",
  read: true,
});
assert.equal(created.ok, true);
if (created.ok) {
  assert.equal(created.book.ownership, "none");
  assert.equal(created.read, true);
}
assert.equal(
  validateCreateBook({ title: "Titre", author: "Ada", ownership: "owned", read: "oui" }).ok,
  false,
);
assert.equal(
  validateCreateBook({ title: "   ", author: "Ada", ownership: "none", read: true }).ok,
  false,
);
const unread = validateCreateBook({ title: "Titre", author: "Ada", ownership: "wishlist" });
assert.equal(unread.ok, true);
if (unread.ok) {
  assert.equal(unread.read, false);
}

const classified = validateCreateBook({
  title: "Lucky Luke",
  author: "Morris",
  ownership: "owned",
  category: "comic",
  collection: "  Lucky Luke  ",
});
assert.equal(classified.ok, true);
if (classified.ok) {
  assert.equal(classified.book.category, "comic");
  assert.equal(classified.book.collection, "Lucky Luke");
}
assert.equal(
  validateBookInput({
    title: "Titre",
    author: "Ada",
    ownership: "none",
    category: "Roman",
  }).ok,
  false,
);
assert.equal(
  validateBookInput({
    title: "Titre",
    author: "Ada",
    ownership: "none",
    collection: "a".repeat(81),
  }).ok,
  false,
);
assert.equal(
  validateBookInput({
    title: "Titre",
    author: "Ada",
    ownership: "none",
    category: "",
    collection: "   ",
  }).ok,
  true,
);

console.log("validate-book.test.ts : ok");
