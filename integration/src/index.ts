import cors from "cors";
import express, { Request, Response } from "express";
import { GlobalErrorHandler } from "./middleware/errorHandler.js";
import telexRouter from "./routes/telexRoutes.js";
import { zeromqServer } from "./services/zeromqServer.js";
import { integrationEnvConfig } from "./utils/config.js";
import { AppResponse, IntegrationConstants } from "./utils/constant.js";
import { telexGeneratedConfig } from "./utils/telexConfig.js";

const app = express();
const PORT = integrationEnvConfig.hostPort;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_, res) => {
  return AppResponse({
    res,
    statusCode: 200,
    message: "Server is healthy",
  }).Success();
});

// Integration config endpoint
app.get("/integration-config", (req: Request, res: Response) => {
  res.status(200).json(telexGeneratedConfig);
});

app.use(telexRouter);

// Generic error handler
app.use("*", (_, res) => {
  return AppResponse({
    res,
    statusCode: 404,
    data: `🤔 Hmm... looks like you're lost in the matrix! 🕴️, visit 👉 ${IntegrationConstants.Github.Repository} 👈`,
  }).Success();
});

// Global error handler
app.use(GlobalErrorHandler);

// Start server
app.listen(PORT, () => {
  console.info(`Server is running on port http://localhost:${PORT}`);
});

// start zeromq server
try {
  // sleep for 2 seconds before initializing zeromq server
  await new Promise((resolve) => setTimeout(resolve, 2000));

  zeromqServer.initialize();
  console.info(`ZeroMQ Publisher Initialized`);
} catch (error) {
  console.error("Failed to initialize ZeroMQ server:", error);
  process.exit(1);
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  console.info("SIGTERM signal received.");
  await zeromqServer.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.info("SIGINT signal received.");
  await zeromqServer.close();
  process.exit(0);
});

export default app;
