import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  MYSQL_DATABASE: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/)
    .default("discovery_today"),
  MYSQL_USER: z.string().default("discovery_app"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_SSL: z.enum(["true", "false"]).default("false"),
  TEST_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
  RESEARCH_SAMPLE_MODE: z.enum(["true", "false"]).default("false"),
});

export type ApiConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  webOrigin: string;
  mysql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  testAuthEnabled: boolean;
  researchSampleMode: boolean;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = environmentSchema.parse(source);
  const testAuthEnabled = parsed.TEST_AUTH_ENABLED === "true";
  if (parsed.NODE_ENV === "production" && testAuthEnabled) {
    throw new Error("TEST_AUTH_ENABLED cannot be enabled in production");
  }
  if (parsed.NODE_ENV === "production" && parsed.MYSQL_PASSWORD.length === 0) {
    throw new Error("MYSQL_PASSWORD is required in production");
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.API_HOST,
    port: parsed.API_PORT,
    webOrigin: parsed.WEB_ORIGIN,
    mysql: {
      host: parsed.MYSQL_HOST,
      port: parsed.MYSQL_PORT,
      database: parsed.MYSQL_DATABASE,
      user: parsed.MYSQL_USER,
      password: parsed.MYSQL_PASSWORD,
      ssl: parsed.MYSQL_SSL === "true",
    },
    testAuthEnabled,
    researchSampleMode: parsed.RESEARCH_SAMPLE_MODE === "true",
  };
}
