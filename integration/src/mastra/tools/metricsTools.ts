import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getMetricsFromPackage } from "../../services/metricsService.js";
import { MetricType } from "../../types/metricType.js";

export const getAllMetricsTool = createTool({
  id: "getAllMetrics",
  description:
    "Fetches current system metrics including CPU usage, memory usage, and load averages. Use this to get real-time system performance data.",
  inputSchema: z.object({
    userMessage: z.string().describe("User message sent to the ai"),
    channelId: z.string().describe("The channel ID to send metrics to"),
  }),
  execute: async ({ context }) => {
    try {
      const { channelId, userMessage } = context;
      console.log("calling getAllMetricsTool");
      await getMetricsFromPackage(
        MetricType.getAllMetrics,
        channelId,
        {},
        userMessage
      );

      // return processing response
      return {
        success: true,
        message: "Metrics is being retrieved, please wait...",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch metrics data: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
