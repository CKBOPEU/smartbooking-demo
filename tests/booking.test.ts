import test from "node:test";
import assert from "node:assert/strict";
import {
  createBooking,
  updateBooking,
  cancelBooking,
  completeBooking,
  decodeStore,
  slots,
  seedBookings,
  isDate,
  validateDraft,
  type Draft,
} from "../lib/booking.ts";
const now = Date.parse("2030-04-01T08:00:00Z");
const draft: Draft = {
  name: "Demo Client",
  email: "demo@example.com",
  date: "2030-04-01",
  time: "10:00",
  service: "review",
  notes: "",
};
test("durations block overlapping slots but allow exact boundaries", () => {
  const b = createBooking(draft, [], "one", now);
  assert.equal(
    validateDraft({ ...draft, time: "10:30" }, b, undefined, now),
    "conflict",
  );
  assert.equal(
    validateDraft({ ...draft, time: "11:00" }, b, undefined, now),
    null,
  );
  assert(!slots(draft.date, "workshop", b, undefined, now).includes("09:00"));
});
test("cancellation releases slot and remains in history", () => {
  const b = cancelBooking("one", createBooking(draft, [], "one", now));
  assert.equal(b[0].status, "cancelled");
  assert(slots(draft.date, "review", b, undefined, now).includes("10:00"));
});
test("rescheduling excludes self and detects other sessions", () => {
  let b = createBooking(draft, [], "one", now);
  b = createBooking({ ...draft, time: "12:00" }, b, "two", now);
  assert.equal(updateBooking("one", draft, b, now)[0].time, "10:00");
  assert.throws(
    () => updateBooking("one", { ...draft, time: "11:30" }, b, now),
    /conflict/,
  );
  assert.equal(
    updateBooking("one", { ...draft, time: "14:00" }, b, now)[0].time,
    "14:00",
  );
});
test("closed days, past times and closing boundaries are enforced", () => {
  assert.equal(
    validateDraft({ ...draft, date: "2030-04-07" }, [], undefined, now),
    "closed",
  );
  assert.equal(validateDraft(draft, [], undefined, now + 7200000), "past");
  assert.equal(
    validateDraft({ ...draft, time: "17:30" }, [], undefined, now),
    "time",
  );
  assert.equal(
    validateDraft({ ...draft, time: "17:00" }, [], undefined, now),
    null,
  );
});
test("completion requires end time; past and cancelled edits are locked", () => {
  const b = createBooking(draft, [], "one", now);
  assert.throws(() => completeBooking("one", b, now), /locked/);
  assert.equal(
    completeBooking("one", b, now + 10800000)[0].status,
    "completed",
  );
  assert.throws(() => updateBooking("one", draft, b, now + 7200000), /locked/);
  assert.throws(
    () => updateBooking("one", draft, cancelBooking("one", b), now),
    /locked/,
  );
});
test("stored schema rejects duplicates, overlaps, invalid times and malformed JSON", () => {
  const b = createBooking(draft, [], "one", now);
  assert.deepEqual(
    decodeStore(JSON.stringify({ version: 1, bookings: b })).bookings,
    b,
  );
  for (const bookings of [
    [...b, ...b],
    [...b, { ...b[0], id: "two" }],
    [{ ...b[0], time: "25:00" }],
  ])
    assert.throws(
      () => decodeStore(JSON.stringify({ version: 1, bookings })),
      /corrupt/,
    );
  assert.throws(() => decodeStore("{"));
  assert.throws(() => decodeStore('{"version":2,"bookings":[]}'), /corrupt/);
});
test("calendar dates are real and seeded data is valid", () => {
  assert(!isDate("2030-02-29"));
  assert(isDate("2032-02-29"));
  const b = seedBookings(new Date(now));
  assert.equal(b.length, 9);
  assert.equal(
    decodeStore(JSON.stringify({ version: 1, bookings: b })).bookings.length,
    9,
  );
});
test("names and emails validated and normalized", () => {
  assert.equal(
    validateDraft({ ...draft, name: " " }, [], undefined, now),
    "name",
  );
  assert.equal(
    validateDraft({ ...draft, email: "bad" }, [], undefined, now),
    "email",
  );
  const b = createBooking(
    { ...draft, name: "  Demo Client  ", email: "DEMO@example.com" },
    [],
    "one",
    now,
  );
  assert.equal(b[0].name, "Demo Client");
  assert.equal(b[0].email, "demo@example.com");
});
