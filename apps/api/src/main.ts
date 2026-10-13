import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";

const config = loadConfig();
const pool = createPool(config.mysql);
const app = await createApp({ config, db: pool });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "API startup failed");
  await pool.end();
  process.exitCode = 1;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().finally(() => pool.end());
  });
}
