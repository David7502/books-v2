import assert from "node:assert/strict";
import { validateReadingInput } from "../src/worker/validate-reading.ts";

const finished = validateReadingInput({
  status: "read",
  startedOn: "2020-01-02",
  finishedOn: "2020-01-03",
  location: "  train  ",
  rating: 4,
});
assert.equal(finished.ok, true);
if (finished.ok) {
  assert.equal(finished.reading.location, "train");
  assert.equal(finished.reading.rating, 4);
}

assert.equal(
  validateReadingInput({
    status: "read",
    startedOn: "2020-02-31",
    finishedOn: null,
    location: null,
    rating: null,
  }).ok,
  false,
);
assert.equal(
  validateReadingInput({
    status: "read",
    startedOn: "2020-01-10",
    finishedOn: "2020-01-01",
    location: null,
    rating: null,
  }).ok,
  false,
);
assert.equal(
  validateReadingInput({
    status: "to_read",
    startedOn: "2020-01-01",
    finishedOn: null,
    location: null,
    rating: null,
  }).ok,
  false,
);
assert.equal(
  validateReadingInput({
    status: "reading",
    startedOn: "2020-01-01",
    finishedOn: "2020-01-02",
    location: null,
    rating: null,
  }).ok,
  false,
);
assert.equal(
  validateReadingInput({
    status: "read",
    startedOn: null,
    finishedOn: null,
    location: null,
    rating: 6,
  }).ok,
  false,
);
assert.equal(
  validateReadingInput({
    status: "read",
    startedOn: "",
    finishedOn: "",
    location: "",
    rating: null,
  }).ok,
  true,
);

console.log("validate-reading.test.ts : ok");
