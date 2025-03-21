import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { weatherAgent } from "./agents/index.js";
import { metricsAgent } from "./agents/metricsAgent.js";
export const mastra = new Mastra({
  agents: { weatherAgent, metricsAgent },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});
