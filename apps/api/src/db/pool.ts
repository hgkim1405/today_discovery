import mysql, { type Pool } from "mysql2/promise";
import type { ApiConfig } from "../config.js";

export function createPool(config: ApiConfig["mysql"]): Pool {
  const { ssl, ...connection } = config;
  return mysql.createPool({
    ...connection,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    multipleStatements: true,
    timezone: "Z",
    dateStrings: true,
    ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
}
