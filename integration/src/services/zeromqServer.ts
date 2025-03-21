import { Publisher, Subscriber } from "zeromq";
import { integrationEnvConfig } from "../utils/config.js";
import { TelexService } from "./telexRequest.js";
import {
  formatMetricResponse,
  formatCpuAlertMessage,
} from "./messageFormatters.js";
import { MetricReplyType } from "../types/metricType.js";
import { mastra } from "../mastra/index.js";

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

  public static getInstance(): ZeromqServer {
    if (!ZeromqServer.instance) {
      ZeromqServer.instance = new ZeromqServer();
    }
    return ZeromqServer.instance;
  }

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
            `Received reply message type "${message.type}" from channel ${channelId}`
          );
          console.log("message from package", message);

          // Process the reply based on message type
          switch (message.type) {
            case MetricReplyType.getCpuMetrics:
            case MetricReplyType.getCpuLoadAverages:
            case MetricReplyType.getCpuUsagePerCore:
              // Use the universal formatter for standard metric types
              const formattedMessage = formatMetricResponse(
                message.type,
                message.data.metrics
              );
              await this.sendTelexResponse(
                channelId.toString(),
                formattedMessage
              );
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

            case MetricReplyType.getAllMetrics:
              // Get the metrics agent instance
              const agent = mastra.getAgent("metricsAgent");
              // Generate a response using the agent with the metrics data
              const response = await agent.generate(
                message.data.userMessage ||
                  "Analyze these system metrics and provide insights",
                {
                  threadId: channelId.toString(),
                  resourceId: channelId.toString(),
                  context: [
                    {
                      role: "system",
                      content: JSON.stringify({
                        metrics: message.data.metrics,
                        messageType: message.type,
                        timestamp: message.timestamp,
                      }),
                    },
                  ],
                }
              );

              // Send the agent's formatted response to Telex
              if (response && response.text) {
                await this.sendTelexResponse(
                  channelId.toString(),
                  response.text
                );
              } else {
                console.error("Error: Agent response is empty or undefined");
                await this.sendTelexResponse(
                  channelId.toString(),
                  "Sorry, I encountered an error while analyzing the metrics. Please try again."
                );
              }
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
        `Published message type "${message.type}" to channel ${channelId}`
      );
    } catch (error) {
      console.error(`Failed to publish message: ${(error as Error).message}`);
      throw error;
    }
  }

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
      console.info("ZeroMQ server closed");
    } catch (error) {
      console.error(`Error closing ZeroMQ server: ${(error as Error).message}`);
      throw error;
    }
  }
}

export const zeromqServer = ZeromqServer.getInstance();
