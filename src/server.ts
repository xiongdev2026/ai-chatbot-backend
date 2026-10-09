import app from "./app";
import { env } from "./config";
import logger from "./config/logger";

import { prisma } from "./database/prisma";

const startServer = async () => {
  try {
    const PORT = env.PORT;
    const server = app.listen(PORT, () => {
      logger.info(
        `Server running on http://localhost:${PORT} in ${env.NODE_ENV} mode`,
      );
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down server...");
      server.close(async () => {
        logger.info("HTTP server closed.");
        await prisma.$disconnect();
        logger.info("Database connections closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
