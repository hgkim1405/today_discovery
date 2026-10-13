import assert from "node:assert/strict";
import test from "node:test";
import { activitySearchQuerySchema } from "./index.js";

test("freeOnly query accepts exact boolean text and defaults false", () => {
  assert.equal(activitySearchQuerySchema.parse({}).freeOnly, false);
  assert.equal(
    activitySearchQuerySchema.parse({ freeOnly: "true" }).freeOnly,
    true,
  );
  assert.equal(
    activitySearchQuerySchema.parse({ freeOnly: "false" }).freeOnly,
    false,
  );
  assert.equal(
    activitySearchQuerySchema.safeParse({ freeOnly: "yes" }).success,
    false,
  );
});

test("date range rejects an end date before the start date", () => {
  assert.equal(
    activitySearchQuerySchema.safeParse({
      from: "2026-10-20",
      to: "2026-10-19",
    }).success,
    false,
  );
});

test("free filter remains independent from maximum price", () => {
  const result = activitySearchQuerySchema.parse({
    freeOnly: "true",
    maxConfirmedPriceKrw: "0",
  });
  assert.equal(result.freeOnly, true);
  assert.equal(result.maxConfirmedPriceKrw, 0);
});
