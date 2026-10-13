import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { loadConfig } from "../config.js";
import { createPool } from "./pool.js";

const config = loadConfig();
const pool = createPool(config.mysql);
const migrationCandidates = [
  resolve(process.cwd(), "infra/db/migrations"),
  resolve(process.cwd(), "../../infra/db/migrations"),
];
let migrationsDirectory: string | undefined;
for (const candidate of migrationCandidates) {
  try {
    await access(candidate);
    migrationsDirectory = candidate;
    break;
  } catch {
    // Check the next known repository layout.
  }
}
if (!migrationsDirectory)
  throw new Error(
    "Could not locate infra/db/migrations from the current working directory",
  );
const direction = process.argv[2] ?? "up";

if (!["up", "down"].includes(direction))
  throw new Error("Usage: migrate.ts [up|down]");

try {
  await pool.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(180) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at_utc DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB`);

  if (direction === "up") {
    const names = (await readdir(migrationsDirectory))
      .filter(
        (name) =>
          /^\d+_[a-z0-9_-]+\.sql$/i.test(name) && !name.endsWith(".down.sql"),
      )
      .sort();
    for (const name of names) {
      const sql = await readFile(resolve(migrationsDirectory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const [found] = await pool.execute(
        "SELECT version, checksum FROM schema_migrations WHERE version = ?",
        [name],
      );
      const existing = (
        found as Array<RowDataPacket & { version: string; checksum: string }>
      )[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        console.log(`Already applied: ${name}`);
        continue;
      }
      await pool.query(sql);
      await pool.execute(
        "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
        [name, checksum],
      );
      console.log(`Applied: ${name}`);
    }
  } else {
    const [found] = await pool.execute(
      "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
    );
    const latest = (found as Array<RowDataPacket & { version: string }>)[0];
    if (!latest) {
      console.log("No migrations to roll back.");
    } else {
      const downName = latest.version.replace(/\.sql$/, ".down.sql");
      const sql = await readFile(
        resolve(migrationsDirectory, downName),
        "utf8",
      );
      await pool.query(sql);
      await pool.execute("DELETE FROM schema_migrations WHERE version = ?", [
        latest.version,
      ]);
      console.log(`Rolled back: ${latest.version}`);
    }
  }
} finally {
  await pool.end();
}
