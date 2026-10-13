import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Pool } from "mysql2/promise";
import type { ApiConfig } from "./config.js";
import { registerRoutes } from "./routes.js";

export type AppDatabase = Pick<Pool, "execute">;

export async function createApp(options: {
  config: ApiConfig;
  db: AppDatabase;
  now?: () => Date;
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: options.config.nodeEnv === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "MYSQL_PASSWORD",
      ],
    },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });
  await app.register(cors, {
    origin: options.config.webOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "x-csrf-token"],
    maxAge: 600,
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    return payload;
  });
  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "Unhandled request error");
    reply.code(500).type("application/problem+json").send({
      type: "https://today-discovery.invalid/problems/internal-error",
      title: "Internal server error",
      status: 500,
      code: "INTERNAL_ERROR",
    });
  });
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).type("application/problem+json").send({
      type: "https://today-discovery.invalid/problems/not-found",
      title: "Not found",
      status: 404,
      code: "NOT_FOUND",
    });
  });
  await registerRoutes(app, options.db, options.config, options.now);
  return app;
}
