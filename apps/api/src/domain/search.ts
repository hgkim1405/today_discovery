import { Buffer } from "node:buffer";
import { z } from "zod";
import {
  activitySearchQuerySchema,
  idSchema,
  isoDateSchema,
  type ActivitySearchQuery,
} from "@today/contracts";

const cursorSchema = z.string().transform((cursor, context) => {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [date, id] = decoded.split("|");
    const parsedDate = isoDateSchema.safeParse(date);
    const parsedId = idSchema.safeParse(id);
    if (!parsedDate.success || !parsedId.success)
      throw new Error("invalid cursor");
    return { date: parsedDate.data, id: parsedId.data };
  } catch {
    context.addIssue({ code: "custom", message: "Invalid cursor" });
    return z.NEVER;
  }
});

export type SearchFilters = ActivitySearchQuery & {
  cursorValue?: { date: string; id: string };
};
export type DbParam = string | number | boolean | null;

export function parseSearchFilters(
  input: Record<string, unknown>,
): SearchFilters {
  const parsed = activitySearchQuerySchema.parse(input);
  const cursorValue = parsed.cursor
    ? cursorSchema.parse(parsed.cursor)
    : undefined;
  return cursorValue ? { ...parsed, cursorValue } : parsed;
}

export function buildSearchWhere(
  filters: SearchFilters,
  todayKst: string,
): { sql: string; params: DbParam[] } {
  const clauses = [
    "a.lifecycle IN ('PUBLISHED','PARTIAL')",
    "COALESCE(a.event_end_on, '9999-12-31') >= ?",
  ];
  const params: DbParam[] = [todayKst];
  if (filters.region) {
    clauses.push("a.region_code = ?");
    params.push(filters.region);
  }
  if (filters.from) {
    clauses.push("COALESCE(a.event_end_on, '9999-12-31') >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("COALESCE(a.event_start_on, '9999-12-31') <= ?");
    params.push(filters.to);
  }
  if (filters.activityType) {
    clauses.push("a.activity_type = ?");
    params.push(filters.activityType);
  }
  if (filters.freeOnly) clauses.push("a.price_kind = 'FREE'");
  if (filters.maxConfirmedPriceKrw !== undefined) {
    clauses.push(
      "(a.price_kind = 'FREE' OR EXISTS (SELECT 1 FROM activity_programs p WHERE p.activity_id = a.id AND p.max_price_krw IS NOT NULL AND p.max_price_krw <= ?))",
    );
    params.push(filters.maxConfirmedPriceKrw);
  }
  if (filters.query) {
    clauses.push("(a.title LIKE ? ESCAPE '!' OR a.summary LIKE ? ESCAPE '!')");
    const escaped = filters.query.replace(
      /[!%_]/g,
      (character) => `!${character}`,
    );
    params.push(`%${escaped}%`, `%${escaped}%`);
  }
  if (filters.cursorValue) {
    clauses.push(
      "(COALESCE(a.event_start_on, '9999-12-31') > ? OR (COALESCE(a.event_start_on, '9999-12-31') = ? AND a.id > ?))",
    );
    params.push(
      filters.cursorValue.date,
      filters.cursorValue.date,
      filters.cursorValue.id,
    );
  }
  return { sql: clauses.join(" AND "), params };
}

export function makeCursor(date: string | null, id: string): string {
  return Buffer.from(`${date ?? "9999-12-31"}|${id}`, "utf8").toString(
    "base64url",
  );
}

export function todayInSeoul(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
