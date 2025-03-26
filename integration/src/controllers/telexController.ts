import { Request, Response } from "express";
import { AppResponse, IntegrationConstants } from "../utils/constant.js";
import { TelexService } from "../services/telexRequest.js";
import { HelperService } from "../utils/helper.js";
import { telexGeneratedConfig } from "../utils/telexConfig.js";
import {
  getMetricsFromPackage,
  metricReq,
} from "../services/metricsService.js";
import { MetricType } from "../types/metricType.js";
import { metricsAiAgent } from "../mastra/agents/metricsAgent.js";
import { z } from "zod";

export async function webhook(req: Request, res: Response) {
  const { channel_id, message, settings } = req.body;
  console.log("=> new webhook from telex =>", message);
  try {
    // Return initial response to telex immediately
    res.status(200).json({ status: "success", message: "Message received" });

    const cleanedMessage = HelperService.cleanTelexMessage(message);

    // don't do anything if the message is from this integration
    if (cleanedMessage.includes(IntegrationConstants.App.Name)) {
      return;
    }

    // Get user message and process
    const agent = await metricsAiAgent.generate(cleanedMessage, {
      output: z.object({
        response: z.string(),
      }),
    });

    // console.log("Agent response =>", agent.object.response);

    await metricReq(channel_id, agent.object.response, settings);
  } catch (error) {
    console.error("Error sending webhook response:", error);
    // Attempt to send error message back to user
    try {
      await TelexService.SendWebhookResponse({
        channelId: channel_id,
        message:
          "Sorry, I encountered an error while sending the response. Please try again.",
      });
    } catch (e) {
      console.error("Failed to send error message:", e);
    }
  }
}

export async function tick(req: Request, res: Response) {
  const { channel_id, settings } = req.body;
  console.log("new tick => channel_id :", channel_id);

  // Return initial response to telex immediately
  res.status(200).json({ status: "success", message: "Message received" });

  // check if the interval metrics reporting is enabled
  const intervalMetricsReporting = settings.find(
    (setting: any) => setting.label === "enable_interval_metrics_reporting"
  );

  if (!intervalMetricsReporting.default) {
    return;
  }

  await getMetricsFromPackage(MetricType.getCpuMetrics, channel_id, settings);
}

export async function healthCheck(req: Request, res: Response) {
  return AppResponse({
    res,
    statusCode: 200,
    message: "Server is healthy",
  }).Success();
}

// integration config endpoint
export async function integrationConfig(req: Request, res: Response) {
  res.status(200).json(telexGeneratedConfig);
}
