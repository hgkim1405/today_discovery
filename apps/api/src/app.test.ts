import assert from "node:assert/strict";
import test from "node:test";
import type { ApiConfig } from "./config.js";
import { createApp } from "./app.js";

const config: ApiConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3000,
  webOrigin: "http://localhost:5173",
  mysql: {
    host: "localhost",
    port: 3306,
    database: "discovery_today",
    user: "test",
    password: "",
    ssl: false,
  },
  testAuthEnabled: true,
  researchSampleMode: false,
};

function noRowsDatabase() {
  return { execute: async () => [[], []] as never };
}

function decisionDatabase(affectedRows = 1, existingDecision?: string) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    execute: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.startsWith("UPDATE merge_review_cases"))
        return [{ affectedRows }, []] as never;
      return [
        existingDecision ? [{ decision: existingDecision }] : [],
        [],
      ] as never;
    },
  };
}

const reviewHeaders = {
  "x-test-role": "ADMIN",
  "x-csrf-token": "review-token",
  cookie: "__Host-discovery_csrf=review-token",
};

test("guest personal data requests require authentication", async () => {
  const app = await createApp({
    config: { ...config, testAuthEnabled: false },
    db: noRowsDatabase(),
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me/favorites",
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, "UNAUTHORIZED");
  } finally {
    await app.close();
  }
});

test("a regular account cannot read the curator merge queue", async () => {
  const app = await createApp({ config, db: noRowsDatabase() });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/merge-cases",
      headers: { "x-test-role": "USER" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "FORBIDDEN");
  } finally {
    await app.close();
  }
});

test("an administrator can read the merge queue and receives security headers", async () => {
  const app = await createApp({ config, db: noRowsDatabase() });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/merge-cases",
      headers: { "x-test-role": "ADMIN" },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { items: [] });
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
  } finally {
    await app.close();
  }
});

test("merge decisions require a curator or administrator", async () => {
  const app = await createApp({ config, db: noRowsDatabase() });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/merge-cases/01J00000000000000000000000",
      headers: { "x-test-role": "USER" },
      payload: { decision: "SAME_EVENT" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "FORBIDDEN");
  } finally {
    await app.close();
  }
});

test("merge decisions require a matching CSRF cookie and header", async () => {
  const db = decisionDatabase();
  const app = await createApp({ config, db: db as never });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/merge-cases/01J00000000000000000000000",
      headers: { "x-test-role": "ADMIN" },
      payload: { decision: "SAME_EVENT" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "CSRF_INVALID");
    assert.equal(db.calls.length, 0);
  } finally {
    await app.close();
  }
});

test("a non-ASCII CSRF mismatch is rejected without a server error", async () => {
  const app = await createApp({ config, db: noRowsDatabase() });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/merge-cases/01J00000000000000000000000",
      headers: {
        "x-test-role": "ADMIN",
        "x-csrf-token": "é",
        cookie: "__Host-discovery_csrf=x",
      },
      payload: { decision: "SAME_EVENT" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "CSRF_INVALID");
  } finally {
    await app.close();
  }
});

test("a curator can record a human merge decision without merging source records", async () => {
  const db = decisionDatabase();
  const app = await createApp({ config, db: db as never });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/merge-cases/01J00000000000000000000000",
      headers: { ...reviewHeaders, "x-test-role": "CURATOR" },
      payload: { decision: "SAME_EVENT" },
    });
    assert.equal(response.statusCode, 204);
    assert.deepEqual(db.calls[0]?.params, [
      "SAME_EVENT",
      "01J00000000000000000000000",
    ]);
    assert.match(db.calls[0]?.sql ?? "", /decision = 'OPEN'/);
  } finally {
    await app.close();
  }
});

test("an already reviewed merge case returns a conflict", async () => {
  const db = decisionDatabase(0, "DIFFERENT_EVENT");
  const app = await createApp({ config, db: db as never });
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/merge-cases/01J00000000000000000000000",
      headers: reviewHeaders,
      payload: { decision: "SAME_EVENT" },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "CONFLICT");
  } finally {
    await app.close();
  }
});
