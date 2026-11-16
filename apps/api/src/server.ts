import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down VibeTrace API");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Graceful shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(
      {
        api: `http://localhost:${config.port}/api/v1`,
        docs: `http://localhost:${config.port}/api/v1/docs`,
        storage: config.storageDriver,
        ai: config.ai.provider,
      },
      "VibeTrace API ready",
    );
  } catch (error) {
    app.log.error({ err: error }, "Failed to start VibeTrace API");
    process.exit(1);
  }
}

void main();
