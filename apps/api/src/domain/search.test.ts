import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSearchWhere,
  makeCursor,
  parseSearchFilters,
  todayInSeoul,
} from "./search.js";
import { safeExternalUrl } from "./urls.js";

test("freeOnly selects only activities whose event price is confirmed free", () => {
  const filters = parseSearchFilters({ freeOnly: "true" });
  const where = buildSearchWhere(filters, "2026-10-13");
  assert.match(where.sql, /a\.price_kind = 'FREE'/);
  assert.doesNotMatch(where.sql, /MIXED|UNKNOWN/);
});

test("budget filter includes only free items or programs with a confirmed upper price", () => {
  const filters = parseSearchFilters({ maxConfirmedPriceKrw: "10000" });
  const where = buildSearchWhere(filters, "2026-10-13");
  assert.match(
    where.sql,
    /p\.max_price_krw IS NOT NULL AND p\.max_price_krw <= \?/,
  );
  assert.deepEqual(where.params, ["2026-10-13", 10_000]);
});

test("search values are bound as parameters and wildcard characters are escaped", () => {
  const where = buildSearchWhere(
    parseSearchFilters({ query: "100%_" }),
    "2026-10-13",
  );
  assert.match(where.sql, /a\.title LIKE \?/);
  assert.deepEqual(where.params.slice(-2), ["%100!%!_%", "%100!%!_%"]);
});

test("cursor is opaque and malformed cursor is rejected", () => {
  const cursor = makeCursor("2026-10-14", "01J00000000000000000000000");
  assert.deepEqual(parseSearchFilters({ cursor }).cursorValue, {
    date: "2026-10-14",
    id: "01J00000000000000000000000",
  });
  assert.throws(() => parseSearchFilters({ cursor: "not-a-cursor" }));
});

test("date boundary uses Asia/Seoul", () => {
  assert.equal(
    todayInSeoul(new Date("2026-10-12T15:30:00.000Z")),
    "2026-10-13",
  );
});

test("external links allow HTTPS public hosts and reject unsafe schemes or local hosts", () => {
  assert.equal(
    safeExternalUrl("https://www.visitkorea.or.kr/festival"),
    "https://www.visitkorea.or.kr/festival",
  );
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("http://example.org"), null);
  assert.equal(safeExternalUrl("https://127.0.0.1/admin"), null);
  assert.equal(safeExternalUrl("https://[::1]/admin"), null);
  assert.equal(safeExternalUrl("https://[fd00::1]/admin"), null);
  assert.equal(safeExternalUrl("https://user:secret@example.org"), null);
});
