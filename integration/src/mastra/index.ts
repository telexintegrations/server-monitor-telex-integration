import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { metricsAiAgent } from "./agents/metricsAgent.js";

export const mastra = new Mastra({
  agents: { metricsAiAgent },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
});
