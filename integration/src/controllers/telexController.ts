import { Request, Response } from "express";
import {
  AppResponse,
  IntegrationConstants,
  SetupInstruction,
} from "../utils/constant.js";
import { TelexService } from "../services/telexRequest.js";
import { HelperService } from "../utils/helper.js";
import { telexGeneratedConfig } from "../utils/telexConfig.js";
import { mastra } from "../mastra/index.js";
import { getMetricsFromPackage } from "../services/metricsService.js";
import { MetricType } from "../types/metricType.js";

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

    // Handle / commands
    if (cleanedMessage.startsWith("/")) {
      switch (cleanedMessage) {
        case "/setup-monitoring":
          const installCommand =
            IntegrationConstants.Github.InstallationScriptUrl(channel_id);

          // send the setup instructions to the channel
          TelexService.SendWebhookResponse({
            channelId: channel_id,
            message: SetupInstruction(installCommand),
          });
          break;
        case "/cpu":
          await getMetricsFromPackage(
            MetricType.getCpuMetrics,
            channel_id,
            settings
          );
          break;
        case "/cpuLoadAvg":
          await getMetricsFromPackage(
            MetricType.getCpuLoadAverages,
            channel_id,
            settings
          );
          break;
        case "/perCoreUsage":
          await getMetricsFromPackage(
            MetricType.getCpuUsagePerCore,
            channel_id,
            settings
          );
          break;
        default:
          break;
      }
      return;
    }

    // Use the metrics agent to handle the request
    const agent = mastra.getAgent("metricsAgent");
    const response = await agent.generate(cleanedMessage, {
      threadId: channel_id,
      resourceId: channel_id,
      context: [
        {
          role: "system",
          content: JSON.stringify({
            channelId: channel_id,
            settings: settings,
          }),
        },
      ],
    });

    console.log("response text =>", response.text);

    // Check if the response contains a tool call
    const containsToolCall =
      response.toolCalls && response.toolCalls.length > 0;

    // Validate response before sending
    if (!response || !response.text) {
      return;
    }

    // Only send a response if there's no tool call
    if (!containsToolCall) {
      // Send the agent's response to telex
      await TelexService.SendWebhookResponse({
        channelId: channel_id,
        message: response.text,
      });
    } else {
      console.log(
        "Tool call detected, not sending immediate response to Telex"
      );
    }
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
