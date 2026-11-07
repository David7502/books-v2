import assert from "node:assert/strict";
import { demoBooks, hasCompletedReading } from "../src/client/demo-books.ts";
import {
  bookMatchesQuery,
  formatResultCount,
  normalizeSearch,
} from "../src/client/search.ts";

function visibleIds(query: string): string[] {
  return demoBooks
    .filter((book) => bookMatchesQuery(book, query))
    .map((book) => book.id);
}

const byId = Object.fromEntries(demoBooks.map((book) => [book.id, book]));

assert.deepEqual(visibleIds("phare"), ["demo-brume"]);
assert.deepEqual(visibleIds("BRUME"), ["demo-brume"]);
assert.deepEqual(visibleIds("  phare  "), ["demo-brume"]);
assert.equal(byId["demo-brume"]?.ownership, "owned");
assert.equal(hasCompletedReading("demo-brume"), true);

assert.deepEqual(visibleIds("sablier"), ["demo-horloge"]);
assert.deepEqual(visibleIds("MILO"), ["demo-horloge"]);
assert.equal(byId["demo-horloge"]?.ownership, "wishlist");
assert.equal(hasCompletedReading("demo-horloge"), false);

assert.deepEqual(visibleIds("memoires"), ["demo-cartographe"]);
assert.deepEqual(visibleIds("Mémoires"), ["demo-cartographe"]);
assert.equal(byId["demo-cartographe"]?.ownership, "owned");
assert.equal(hasCompletedReading("demo-cartographe"), false);

assert.deepEqual(visibleIds("  nina  "), ["demo-jardin"]);
assert.equal(byId["demo-jardin"]?.ownership, "none");
assert.equal(hasCompletedReading("demo-jardin"), true);

assert.deepEqual(visibleIds(""), demoBooks.map((book) => book.id));
assert.deepEqual(visibleIds("   "), demoBooks.map((book) => book.id));
assert.deepEqual(visibleIds("zzzz"), []);
assert.deepEqual(visibleIds("j’ai"), []);

assert.equal(normalizeSearch("  Été  "), "ete");
assert.equal(formatResultCount(0), "Aucun livre");
assert.equal(formatResultCount(1), "1 livre");
assert.equal(formatResultCount(4), "4 livres");

console.log("search.test.ts : ok");
