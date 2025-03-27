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
import { ChatHistoryService } from "../utils/chatHistory.js";
import { metricsResponseAgent } from "../mastra/agents/metricsResponseAgent.js";

export async function webhook(req: Request, res: Response) {
  const { channel_id, message, settings } = req.body;
  console.log("full body request =>", req.body);
  console.log("=> new webhook from telex =>", message);
  try {
    // Return initial response to telex immediately
    res.status(200).json({ status: "success", message: "Message received" });

    const cleanedMessage = HelperService.cleanTelexMessage(message);

    // don't do anything if the message is from this integration
    if (cleanedMessage.includes(IntegrationConstants.App.Name)) {
      return;
    }

    // Store the user message in chat history
    ChatHistoryService.addMessage(channel_id, {
      role: "user",
      content: cleanedMessage,
      timestamp: new Date(),
    });

    // Use the classifier agent to determine which metrics to fetch
    const agent = await metricsAiAgent.generate(cleanedMessage, {
      output: z.object({
        response: z.string(),
      }),
    });
    // Get the metric type response
    const metricType = agent.object.response.trim();

    console.log("=> agent classification =>", metricType);

    // if the metric type is conversation, we don't need to fetch any metrics we just process the response referencing the chat history
    if (metricType === "conversation") {
      // Get chat history for context
      const chatHistory = ChatHistoryService.formatHistoryForAI(channel_id);
      console.log("=> chat history =>", chatHistory);

      // Create a prompt for purely conversational responses
      const context = `
          You are a helpful server monitoring assistant. Help the user with their question ${chatHistory ? "based on available context" : ""}.

          ${
            chatHistory
              ? `Previous conversation:
          ${chatHistory}`
              : ""
          }

          User's current message: ${cleanedMessage}

          Provide a helpful response. If the user is asking about specific metrics that you don't have data for:
          1. Explain you need to fetch that data
          2. Let them know you'll get the information
          3. Ask if they'd like to see additional metrics as well`;

      // Generate conversational response
      const enhancedResponse = await metricsResponseAgent.generate(context, {
        output: z.object({
          response: z.string(),
        }),
      });
      const enhancedResponseMessage = enhancedResponse.object.response;

      // Store the AI's response in chat history
      ChatHistoryService.addMessage(channel_id, {
        role: "assistant",
        content: enhancedResponseMessage,
        timestamp: new Date(),
      });

      // Send the enhanced response
      await TelexService.SendWebhookResponse({
        channelId: channel_id,
        message: enhancedResponseMessage,
      });
    } else {
      // Process the response - fetch the actual metrics from the server
      // Note: We don't store the classifier response in history since it's just for routing
      await metricReq(channel_id, metricType, settings, cleanedMessage);
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

  await getMetricsFromPackage(MetricType.getAllMetrics, channel_id, settings);
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
