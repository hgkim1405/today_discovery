import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import type { components } from "@today/contracts";
import type { ApiConfig } from "./config.js";
import { newUlid } from "./ids.js";
import {
  buildSearchWhere,
  makeCursor,
  parseSearchFilters,
  todayInSeoul,
  type DbParam,
} from "./domain/search.js";
import { safeExternalUrl } from "./domain/urls.js";

type Database = Pick<Pool, "execute">;
type Activity = components["schemas"]["Activity"];
type ActivityRow = RowDataPacket & {
  id: string;
  title: string;
  summary: string | null;
  activity_type: Activity["activityType"];
  lifecycle: Activity["lifecycle"];
  price_kind: Activity["priceKind"];
  price_note: string | null;
  region_code: string | null;
  event_start_on: string | null;
  event_end_on: string | null;
  booking_status: Activity["bookingStatus"];
  booking_status_checked_utc: string | Date | null;
  verification_level: Activity["verificationLevel"];
  last_verified_utc: string | Date | null;
  official_detail_url: string | null;
  place_id: string | null;
  place_name: string | null;
  address_text: string | null;
  lat: string | number | null;
  lng: string | number | null;
  geocode_status: NonNullable<Activity["place"]>["geocodeStatus"] | null;
};
type AttributionRow = RowDataPacket & {
  activity_id: string;
  source_code: string;
  source_url: string;
  attribution_text: string | null;
};
type ProgramRow = RowDataPacket & {
  id: string;
  activity_id: string;
  name: string;
  description: string | null;
  price_kind: Activity["priceKind"];
  min_price_krw: number | null;
  max_price_krw: number | null;
  price_note: string | null;
  participation_note: string | null;
};

const protectedId = "01J00000000000000000000000";
const roleSchema = z.enum(["USER", "CURATOR", "ADMIN"]);
const mergeDecisionSchema = z
  .object({ decision: z.enum(["SAME_EVENT", "DIFFERENT_EVENT"]) })
  .strict();
const reportSchema = z
  .object({
    activityId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    reason: z.enum([
      "WRONG_DATE",
      "WRONG_PRICE",
      "BROKEN_LINK",
      "COPYRIGHT",
      "OTHER",
    ]),
    details: z.string().max(2000).optional(),
  })
  .strict();

function problem(
  reply: FastifyReply,
  status: number,
  title: string,
  code: string,
  detail?: string,
) {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: `https://today-discovery.invalid/problems/${code.toLowerCase()}`,
      title,
      status,
      detail,
      code,
    });
}

function dateTimeToIso(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asPlace(row: ActivityRow): Activity["place"] {
  if (row.place_id === null) return null;
  return {
    name: row.place_name,
    address: row.address_text,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    geocodeStatus: row.geocode_status ?? "NOT_PROVIDED",
  };
}

async function rows<T extends RowDataPacket[]>(
  db: Database,
  sql: string,
  params: DbParam[] = [],
): Promise<T> {
  const [result] = await db.execute<T>(sql, params);
  return result;
}

async function loadAttributions(
  db: Database,
  activityIds: string[],
): Promise<Map<string, Activity["sourceAttributions"]>> {
  if (activityIds.length === 0) return new Map();
  const marks = activityIds.map(() => "?").join(",");
  const result = await rows<AttributionRow[]>(
    db,
    `SELECT asl.activity_id, ds.source_code, sr.upstream_url AS source_url, ds.attribution_text
       FROM activity_source_links asl
       JOIN source_records sr ON sr.id = asl.source_record_id
       JOIN data_sources ds ON ds.id = sr.source_id
      WHERE asl.match_decision = 'CONFIRMED' AND sr.is_tombstoned = FALSE
        AND sr.upstream_url IS NOT NULL AND asl.activity_id IN (${marks})`,
    activityIds,
  );
  const byActivity = new Map<string, Activity["sourceAttributions"]>();
  for (const row of result) {
    const sourceUrl = safeExternalUrl(row.source_url);
    if (!sourceUrl) continue;
    const list = byActivity.get(row.activity_id) ?? [];
    list.push({
      sourceCode: row.source_code,
      sourceUrl,
      attributionText: row.attribution_text,
    });
    byActivity.set(row.activity_id, list);
  }
  return byActivity;
}

function toActivity(
  row: ActivityRow,
  attributions: Activity["sourceAttributions"] = [],
): Activity {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    activityType: row.activity_type,
    lifecycle: row.lifecycle,
    regionCode: row.region_code,
    startOn: row.event_start_on,
    endOn: row.event_end_on,
    priceKind: row.price_kind,
    priceNote: row.price_note,
    bookingStatus: row.booking_status,
    bookingStatusCheckedAt: dateTimeToIso(row.booking_status_checked_utc),
    verificationLevel: row.verification_level,
    lastVerifiedAt: dateTimeToIso(row.last_verified_utc),
    place: asPlace(row),
    officialDetailUrl: safeExternalUrl(row.official_detail_url),
    sourceAttributions: attributions,
  };
}

const activitySelect = `SELECT a.id, a.title, a.summary, a.activity_type, a.lifecycle, a.price_kind,
       a.price_note, a.region_code, a.event_start_on, a.event_end_on, a.booking_status,
       a.booking_status_checked_utc, a.verification_level, a.last_verified_utc,
       a.official_detail_url, a.place_id, p.name_ko AS place_name, p.address_text,
       p.lat, p.lng, p.geocode_status
  FROM activities a LEFT JOIN places p ON p.id = a.place_id`;

async function publicActivity(
  db: Database,
  id: string,
): Promise<Activity | null> {
  const activityRows = await rows<ActivityRow[]>(
    db,
    `${activitySelect} WHERE a.id = ? AND a.lifecycle IN ('PUBLISHED','PARTIAL') LIMIT 1`,
    [id],
  );
  const row = activityRows[0];
  if (!row) return null;
  const attributions = await loadAttributions(db, [id]);
  return toActivity(row, attributions.get(id) ?? []);
}

function principalFor(
  request: FastifyRequest,
  config: ApiConfig,
): FastifyRequest["principal"] {
  if (config.nodeEnv !== "test" || !config.testAuthEnabled) return null;
  const parsed = roleSchema.safeParse(request.headers["x-test-role"]);
  return parsed.success ? { id: protectedId, role: parsed.data } : null;
}

function requirePrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (!request.principal) {
    problem(reply, 401, "Authentication required", "UNAUTHORIZED");
    return false;
  }
  return true;
}

function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  accepted: Array<"CURATOR" | "ADMIN">,
): boolean {
  if (!requirePrincipal(request, reply)) return false;
  if (!accepted.includes(request.principal!.role as "CURATOR" | "ADMIN")) {
    problem(reply, 403, "Forbidden", "FORBIDDEN");
    return false;
  }
  return true;
}

export async function registerRoutes(
  app: FastifyInstance,
  db: Database,
  config: ApiConfig,
  now: () => Date = () => new Date(),
): Promise<void> {
  app.decorateRequest("principal", null);
  app.addHook("preHandler", async (request) => {
    request.principal = principalFor(request, config);
  });

  app.get("/api/v1/health/ready", async (_request, reply) => {
    try {
      await db.execute(
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
      );
      return reply.code(200).send({ status: "ready", database: "ready" });
    } catch {
      return problem(reply, 503, "Service unavailable", "DATABASE_NOT_READY");
    }
  });

  app.get("/api/v1/activities", async (request, reply) => {
    let filters;
    try {
      filters = parseSearchFilters(request.query as Record<string, unknown>);
    } catch (error) {
      const detail =
        error instanceof z.ZodError
          ? error.issues.map((issue) => issue.message).join("; ")
          : undefined;
      return problem(
        reply,
        400,
        "Invalid search filters",
        "BAD_REQUEST",
        detail,
      );
    }
    const where = buildSearchWhere(filters, todayInSeoul(now()));
    const [result] = await db.execute<ActivityRow[]>(
      `${activitySelect} WHERE ${where.sql}
       ORDER BY COALESCE(a.event_start_on, '9999-12-31'), a.id LIMIT ?`,
      [...where.params, filters.limit + 1],
    );
    const hasMore = result.length > filters.limit;
    const pageRows = result.slice(0, filters.limit);
    const attributionMap = await loadAttributions(
      db,
      pageRows.map((row) => row.id),
    );
    const items = pageRows.map((row) =>
      toActivity(row, attributionMap.get(row.id) ?? []),
    );
    const last = pageRows.at(-1);
    return reply.send({
      items,
      nextCursor:
        hasMore && last ? makeCursor(last.event_start_on, last.id) : null,
      generatedAt: now().toISOString(),
      researchSampleMode: config.researchSampleMode,
    });
  });

  app.get<{ Params: { activityId: string } }>(
    "/api/v1/activities/:activityId",
    async (request, reply) => {
      const id = request.params.activityId;
      const activity = await publicActivity(db, id);
      if (!activity) return problem(reply, 404, "Not found", "NOT_FOUND");
      const programRows = await rows<ProgramRow[]>(
        db,
        `SELECT id, activity_id, name, description, price_kind, min_price_krw, max_price_krw,
              price_note, participation_note
         FROM activity_programs WHERE activity_id = ? ORDER BY name, id`,
        [id],
      );
      const programs = programRows.map((program) => ({
        id: program.id,
        activityId: program.activity_id,
        name: program.name,
        description: program.description,
        priceKind: program.price_kind,
        minPriceKrw: program.min_price_krw,
        maxPriceKrw: program.max_price_krw,
        priceNote: program.price_note,
        participationNote: program.participation_note,
      }));
      return reply.send({ ...activity, programs });
    },
  );

  app.get<{ Params: { activityId: string } }>(
    "/api/v1/activities/:activityId/programs",
    async (request, reply) => {
      const activity = await publicActivity(db, request.params.activityId);
      if (!activity) return problem(reply, 404, "Not found", "NOT_FOUND");
      const result = await rows<ProgramRow[]>(
        db,
        `SELECT id, activity_id, name, description, price_kind, min_price_krw, max_price_krw,
              price_note, participation_note
         FROM activity_programs WHERE activity_id = ? ORDER BY name, id`,
        [request.params.activityId],
      );
      return reply.send({
        items: result.map((program) => ({
          id: program.id,
          activityId: program.activity_id,
          name: program.name,
          description: program.description,
          priceKind: program.price_kind,
          minPriceKrw: program.min_price_krw,
          maxPriceKrw: program.max_price_krw,
          priceNote: program.price_note,
          participationNote: program.participation_note,
        })),
      });
    },
  );

  app.get<{ Params: { programId: string }; Querystring: { from?: string } }>(
    "/api/v1/programs/:programId/sessions",
    async (request, reply) => {
      const programId = request.params.programId;
      const params: DbParam[] = [programId];
      let fromClause = "";
      if (request.query.from) {
        const parsed = z.iso.date().safeParse(request.query.from);
        if (!parsed.success)
          return problem(reply, 400, "Invalid date filter", "BAD_REQUEST");
        fromClause = " AND s.starts_at_utc >= ?";
        params.push(`${parsed.data} 00:00:00`);
      }
      const result = await rows<RowDataPacket[]>(
        db,
        `SELECT s.id, s.program_id, s.starts_at_utc, s.ends_at_utc, s.booking_status,
                s.booking_url, s.booking_checked_utc, s.price_krw, s.seats_available, s.seats_checked_utc
           FROM activity_sessions s JOIN activity_programs p ON p.id = s.program_id
           JOIN activities a ON a.id = p.activity_id
          WHERE s.program_id = ? AND s.starts_at_utc IS NOT NULL
            AND a.lifecycle IN ('PUBLISHED','PARTIAL')${fromClause}
          ORDER BY s.starts_at_utc, s.id`,
        params,
      );
      return reply.send({
        items: result.map((session) => ({
          id: session.id as string,
          programId: session.program_id as string,
          startsAt: dateTimeToIso(
            session.starts_at_utc as string | Date | null,
          ),
          endsAt: dateTimeToIso(session.ends_at_utc as string | Date | null),
          bookingStatus: session.booking_status as string,
          bookingUrl: safeExternalUrl(session.booking_url as string | null),
          bookingCheckedAt: dateTimeToIso(
            session.booking_checked_utc as string | Date | null,
          ),
          priceKrw: session.price_krw as number | null,
          seatsAvailable: session.seats_available as number | null,
          seatsCheckedAt: dateTimeToIso(
            session.seats_checked_utc as string | Date | null,
          ),
        })),
      });
    },
  );

  app.get("/api/v1/discover/recommendations", async (request, reply) => {
    const raw = request.query as Record<string, unknown>;
    const result = z
      .object({
        region: z.string().max(12).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        limit: z.coerce.number().int().min(1).max(20).default(10),
      })
      .safeParse(raw);
    if (!result.success)
      return problem(
        reply,
        400,
        "Invalid recommendation filters",
        "BAD_REQUEST",
      );
    const filters = parseSearchFilters({
      ...result.data,
      freeOnly: "false",
      limit: result.data.limit,
    });
    const where = buildSearchWhere(filters, todayInSeoul(now()));
    const [found] = await db.execute<ActivityRow[]>(
      `${activitySelect} WHERE ${where.sql} ORDER BY COALESCE(a.event_start_on, '9999-12-31'), a.id LIMIT ?`,
      [...where.params, result.data.limit],
    );
    const attributions = await loadAttributions(
      db,
      found.map((row) => row.id),
    );
    return reply.send({
      generatedAt: now().toISOString(),
      items: found.map((row) => ({
        activity: toActivity(row, attributions.get(row.id) ?? []),
        reasons: ["선택한 날짜와 지역 조건에 맞는 활동"],
      })),
    });
  });

  app.get("/api/v1/me", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    return reply.send({
      id: request.principal!.id,
      displayName: null,
      role: request.principal!.role,
    });
  });

  app.get("/api/v1/me/preferences", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    return reply.send({
      regionCode: null,
      preferredCategories: [],
      maxBudgetKrw: null,
      notificationsOptIn: false,
      emailMarketingOptIn: false,
    });
  });

  app.patch("/api/v1/me/preferences", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    if (!checkCsrf(request))
      return problem(reply, 403, "CSRF validation failed", "CSRF_INVALID");
    return problem(
      reply,
      501,
      "Account provider is not configured",
      "AUTH_NOT_CONFIGURED",
    );
  });

  app.get("/api/v1/me/favorites", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    return reply.send({ items: [] });
  });

  app.post("/api/v1/me/favorites", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    if (!checkCsrf(request))
      return problem(reply, 403, "CSRF validation failed", "CSRF_INVALID");
    return problem(
      reply,
      501,
      "Account provider is not configured",
      "AUTH_NOT_CONFIGURED",
    );
  });

  app.delete<{ Params: { activityId: string } }>(
    "/api/v1/me/favorites/:activityId",
    async (request, reply) => {
      if (!requirePrincipal(request, reply)) return;
      if (!checkCsrf(request))
        return problem(reply, 403, "CSRF validation failed", "CSRF_INVALID");
      return problem(
        reply,
        501,
        "Account provider is not configured",
        "AUTH_NOT_CONFIGURED",
      );
    },
  );

  app.get("/api/v1/me/experiences", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    return reply.send({ items: [] });
  });

  app.post("/api/v1/me/experiences", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    if (!checkCsrf(request))
      return problem(reply, 403, "CSRF validation failed", "CSRF_INVALID");
    return problem(
      reply,
      501,
      "Account provider is not configured",
      "AUTH_NOT_CONFIGURED",
    );
  });

  app.get("/api/v1/missions", async (_request, reply) => {
    const result = await rows<RowDataPacket[]>(
      db,
      "SELECT id, title, starts_on, ends_on FROM missions WHERE enabled = TRUE AND ends_on >= ? ORDER BY starts_on, id",
      [todayInSeoul(now())],
    );
    return reply.send({
      items: result.map((mission) => ({
        id: mission.id,
        title: mission.title,
        startsOn: mission.starts_on,
        endsOn: mission.ends_on,
      })),
    });
  });

  app.get("/api/v1/me/notifications", async (request, reply) => {
    if (!requirePrincipal(request, reply)) return;
    return reply.send({ items: [] });
  });

  const reportWindows = new Map<string, number[]>();
  app.post("/api/v1/reports", async (request, reply) => {
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success)
      return problem(reply, 400, "Invalid report", "BAD_REQUEST");
    const currentTime = now().getTime();
    const ip = request.ip;
    const recent = (reportWindows.get(ip) ?? []).filter(
      (time) => currentTime - time < 60 * 60 * 1000,
    );
    if (recent.length >= 5)
      return problem(reply, 429, "Too many reports", "RATE_LIMITED");
    recent.push(currentTime);
    reportWindows.set(ip, recent);
    const [activityRows] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM activities WHERE id = ? AND lifecycle IN ('PUBLISHED','PARTIAL') LIMIT 1",
      [parsed.data.activityId],
    );
    if (activityRows.length === 0)
      return problem(reply, 404, "Not found", "NOT_FOUND");
    await db.execute(
      "INSERT INTO content_reports (id, activity_id, reason, details) VALUES (?, ?, ?, ?)",
      [
        newUlid(currentTime),
        parsed.data.activityId,
        parsed.data.reason,
        parsed.data.details ?? null,
      ],
    );
    return reply.code(202).send();
  });

  app.get<{ Params: { sourceCode: string } }>(
    "/api/v1/admin/sources/:sourceCode/runs",
    async (request, reply) => {
      if (!requireRole(request, reply, ["ADMIN"])) return;
      const result = await rows<RowDataPacket[]>(
        db,
        `SELECT r.id, r.state, r.fetched_count, r.accepted_count, r.rejected_count,
              r.started_at_utc, r.finished_at_utc
         FROM source_sync_runs r JOIN data_sources s ON s.id = r.source_id
        WHERE s.source_code = ? ORDER BY r.started_at_utc DESC LIMIT 50`,
        [request.params.sourceCode],
      );
      return reply.send({
        items: result.map((run) => ({
          id: run.id,
          state: run.state,
          fetched: run.fetched_count,
          accepted: run.accepted_count,
          rejected: run.rejected_count,
          startedAt: dateTimeToIso(run.started_at_utc),
          finishedAt: dateTimeToIso(run.finished_at_utc),
        })),
      });
    },
  );

  app.get("/api/v1/admin/merge-cases", async (request, reply) => {
    if (!requireRole(request, reply, ["CURATOR", "ADMIN"])) return;
    const result = await rows<RowDataPacket[]>(
      db,
      `SELECT c.id, c.left_source_record_id, c.right_source_record_id, c.reason, c.decision,
              l.payload_json AS left_payload, r.payload_json AS right_payload
         FROM merge_review_cases c
         JOIN source_records l ON l.id = c.left_source_record_id
         JOIN source_records r ON r.id = c.right_source_record_id
        WHERE c.decision = 'OPEN' ORDER BY c.id`,
    );
    return reply.send({
      items: result.map((entry) => ({
        id: entry.id,
        leftSourceRecordId: entry.left_source_record_id,
        rightSourceRecordId: entry.right_source_record_id,
        decision: entry.decision,
        reason: entry.reason,
        leftRecord: entry.left_payload,
        rightRecord: entry.right_payload,
      })),
    });
  });

  app.patch<{ Params: { caseId: string } }>(
    "/api/v1/admin/merge-cases/:caseId",
    async (request, reply) => {
      if (!requireRole(request, reply, ["CURATOR", "ADMIN"])) return;
      if (!checkCsrf(request))
        return problem(reply, 403, "CSRF validation failed", "CSRF_INVALID");
      if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(request.params.caseId))
        return problem(reply, 400, "Invalid merge case", "BAD_REQUEST");
      const parsed = mergeDecisionSchema.safeParse(request.body);
      if (!parsed.success)
        return problem(reply, 400, "Invalid merge decision", "BAD_REQUEST");

      const [updated] = await db.execute<ResultSetHeader>(
        `UPDATE merge_review_cases
            SET decision = ?, reviewed_at_utc = UTC_TIMESTAMP(3)
          WHERE id = ? AND decision = 'OPEN'`,
        [parsed.data.decision, request.params.caseId],
      );
      if (updated.affectedRows === 1) return reply.code(204).send();

      const [found] = await db.execute<RowDataPacket[]>(
        "SELECT decision FROM merge_review_cases WHERE id = ? LIMIT 1",
        [request.params.caseId],
      );
      if (found.length === 0)
        return problem(reply, 404, "Not found", "NOT_FOUND");
      return problem(reply, 409, "Merge case already reviewed", "CONFLICT");
    },
  );
}

function checkCsrf(request: FastifyRequest): boolean {
  const header = request.headers["x-csrf-token"];
  const cookie = request.headers.cookie
    ?.split(";")
    .map((piece) => piece.trim())
    .find((piece) => piece.startsWith("__Host-discovery_csrf="));
  const cookieValue = cookie?.slice("__Host-discovery_csrf=".length);
  if (!header || Array.isArray(header) || !cookieValue) return false;
  const headerBytes = Buffer.from(header, "utf8");
  const cookieBytes = Buffer.from(cookieValue, "utf8");
  if (headerBytes.length !== cookieBytes.length) return false;
  return timingSafeEqual(headerBytes, cookieBytes);
}
