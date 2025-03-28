import { Publisher, Subscriber } from "zeromq";
import { integrationEnvConfig } from "../utils/config.js";
import { TelexService } from "./telexRequest.js";
import { formatMetricResponse } from "./messageFormatters.js";
import { MetricReplyType } from "../types/metricType.js";
import { metricsResponseAgent } from "../mastra/agents/metricsResponseAgent.js";
import { z } from "zod";
import { ChatHistoryService } from "../utils/chatHistory.js";
import { formatCpuAlertMessage } from "./messageFormatters/cpu.js";

export interface IZeromqMessage {
  type: string;
  channelId: string;
  data: any;
  timestamp: string;
}

class ZeromqServer {
  private static instance: ZeromqServer;
  private pubSocket: Publisher | null = null;
  private subSocket: Subscriber | null = null;
  private isInitialized = false;

  private constructor() {}

  // get the singleton instance of the zeromq server
  public static getInstance(): ZeromqServer {
    if (!ZeromqServer.instance) {
      ZeromqServer.instance = new ZeromqServer();
    }
    return ZeromqServer.instance;
  }

  // initialize the zeromq server
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("ZeroMQ server is already initialized");
      return;
    }

    try {
      const host = "0.0.0.0";
      const basePort = integrationEnvConfig.hostPort + 1;
      const subPort = basePort + 1;

      console.log({ host, basePort, subPort });

      // Initialize Publisher socket for sending commands
      this.pubSocket = new Publisher();
      await this.pubSocket.bind(`tcp://${host}:${basePort}`);
      console.info(`Publisher bound to tcp://${host}:${basePort}`);

      // Initialize Subscriber socket for receiving replies
      this.subSocket = new Subscriber();
      await this.subSocket.bind(`tcp://${host}:${subPort}`);
      console.info(`Subscriber bound to tcp://${host}:${subPort}`);

      // Start listening for replies
      this.handleReplies();

      this.isInitialized = true;
    } catch (error) {
      console.error(
        `Failed to initialize ZeroMQ server: ${(error as Error).message}`
      );
      throw error;
    }
  }

  // handle incoming replies sent from the metrics package
  private async handleReplies(): Promise<void> {
    if (!this.subSocket) {
      throw new Error("Subscriber socket not initialized");
    }

    try {
      // Subscribe to all channels
      await this.subSocket.subscribe("");

      // Track processed message IDs to prevent duplicates
      const processedMessages = new Set<string>();

      // Handle incoming replies
      for await (const [channelId, messageBuffer] of this.subSocket) {
        try {
          const message = JSON.parse(
            messageBuffer.toString()
          ) as IZeromqMessage;

          // Create a unique message identifier using channelId and timestamp
          const messageId = `${channelId}_${message.timestamp}`;

          // Skip if we've already processed this message
          if (processedMessages.has(messageId)) {
            continue;
          }

          // Add to processed messages
          processedMessages.add(messageId);

          // Clean up old messages (keep last 1000)
          if (processedMessages.size > 1000) {
            const oldestMessages = Array.from(processedMessages).slice(0, 100);
            oldestMessages.forEach((id) => processedMessages.delete(id));
          }

          console.info(
            `=> Received reply message type "${message.type}" from channel ${channelId}`
          );
          console.log("=> message from package =>", message);

          // Process the reply based on message type
          switch (message.type) {
            case MetricReplyType.getCpuMetrics:
            case MetricReplyType.getCpuLoadAverages:
            case MetricReplyType.getCpuUsagePerCore:
            case MetricReplyType.getMemoryStats:
            case MetricReplyType.getAllMetrics:
            case MetricReplyType.getDiskMetrics:
            case MetricReplyType.getProcessMetrics:
            case MetricReplyType.getNetworkMetrics:
              // Format the standard metric response
              const formattedMetrics = formatMetricResponse(
                message.type,
                message.data.metrics
              );

              console.log(formattedMetrics);

              // If there's a user message, use AI to enhance the response
              if (message.data.userMessage) {
                try {
                  // Get chat history for context
                  const chatHistory = ChatHistoryService.formatHistoryForAI(
                    channelId.toString()
                  );

                  // Combine formatted metrics with user message and history for context
                  const context = chatHistory
                    ? `
Previous conversation:
${chatHistory}

User asked: ${message.data.userMessage}

Current server metrics:
${formattedMetrics}

IMPORTANT: Only report and discuss the exact metrics shown above. Never make up or hallucinate metrics that aren't explicitly provided.
Based on the above metrics and the user's question, provide a helpful, conversational response. 
Analyze only the metrics that are actually present in the data. If values are high (above 80%), include suggestions.`
                    : `
User asked: ${message.data.userMessage}

Current server metrics:
${formattedMetrics}

IMPORTANT: Only report and discuss the exact metrics shown above. Never make up or hallucinate metrics that aren't explicitly provided.
Based on the above metrics and the user's question, provide a helpful, conversational response.
Analyze only the metrics that are actually present in the data. If values are high (above 80%), include suggestions.`;

                  // Generate enhanced response
                  const enhancedResponse = await metricsResponseAgent.generate(
                    context,
                    {
                      output: z.object({
                        response: z.string(),
                      }),
                    }
                  );

                  // Store the AI's response in chat history
                  ChatHistoryService.addMessage(channelId.toString(), {
                    role: "assistant",
                    content: enhancedResponse.object.response,
                    timestamp: new Date(),
                  });

                  // Send the enhanced response
                  await this.sendTelexResponse(
                    channelId.toString(),
                    enhancedResponse.object.response
                  );
                } catch (error) {
                  console.error("Error generating enhanced response:", error);
                  // Fallback to regular formatted metrics
                  await this.sendTelexResponse(
                    channelId.toString(),
                    formattedMetrics
                  );
                }
              } else {
                // No user message, just send the formatted metrics
                await this.sendTelexResponse(
                  channelId.toString(),
                  formattedMetrics
                );
              }
              break;

            case MetricReplyType.cpuThresholdAlert:
              // Handle the CPU threshold alert
              console.warn(
                `CPU threshold alert received: ${message.data.severity} level`
              );
              // If a message is provided in the data, use it, otherwise format it ourselves
              const alertMessage =
                message.data.message ||
                formatCpuAlertMessage(
                  message.data.metrics,
                  message.data.threshold,
                  message.data.severity === "critical"
                );
              await this.sendTelexResponse(channelId.toString(), alertMessage);
              break;

            default:
              console.info(`Unhandled message type: ${message.type}`);
          }
        } catch (error) {
          console.error(`Error processing reply: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      console.error(`Error in reply handler: ${(error as Error).message}`);
    }
  }

  private async sendTelexResponse(channelId: string, message: string) {
    // Send formatted metrics to Telex
    await TelexService.SendWebhookResponse({
      channelId: channelId.toString(),
      message,
    });
  }

  // publish a message to the subscriber
  public async publish(
    channelId: string,
    message: IZeromqMessage
  ): Promise<void> {
    if (!this.pubSocket || !this.isInitialized) {
      throw new Error("ZeroMQ server not initialized");
    }

    try {
      await this.pubSocket.send([channelId, JSON.stringify(message)]);
      console.info(
        `=> Published message type "${message.type}" to channel ${channelId}`
      );
    } catch (error) {
      console.error(
        `=> Failed to publish message: ${(error as Error).message}`
      );
      throw error;
    }
  }

  // close the zeromq server
  public async close(): Promise<void> {
    try {
      if (this.pubSocket) {
        await this.pubSocket.close();
        this.pubSocket = null;
      }
      if (this.subSocket) {
        await this.subSocket.close();
        this.subSocket = null;
      }
      this.isInitialized = false;
      console.info("=> ZeroMQ server closed");
    } catch (error) {
      console.error(
        `=> Error closing ZeroMQ server: ${(error as Error).message}`
      );
      throw error;
    }
  }
}

export const zeromqServer = ZeromqServer.getInstance();
