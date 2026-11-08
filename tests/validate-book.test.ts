import assert from "node:assert/strict";
import { validateBookInput } from "../src/worker/validate.ts";

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
}

assert.equal(validateBookInput({ title: "   ", author: "Ada", ownership: "owned" }).ok, false);
assert.equal(validateBookInput({ title: "Titre", author: "  ", ownership: "wishlist" }).ok, false);
assert.equal(validateBookInput({ title: "Titre", author: "Ada", ownership: "borrowed" }).ok, false);
assert.equal(validateBookInput(["Titre"]).ok, false);
assert.equal(
  validateBookInput({ title: "a".repeat(201), author: "Ada", ownership: "none" }).ok,
  false,
);

console.log("validate-book.test.ts : ok");
