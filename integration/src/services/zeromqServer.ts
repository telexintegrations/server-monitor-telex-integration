import { Publisher, Subscriber } from "zeromq";
import { integrationEnvConfig } from "../utils/config.js";
import { TelexService } from "./telexRequest.js";
import {
  formatMetricsMessage,
  getFormattedLoadAverages,
  formatCpuAlertMessage,
} from "./messageFormatters.js";
import { MetricReplyType } from "../types/metricType.js";

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

      // Handle incoming replies
      for await (const [channelId, messageBuffer] of this.subSocket) {
        try {
          const message = JSON.parse(
            messageBuffer.toString()
          ) as IZeromqMessage;
          console.info(
            `Received reply message type "${message.type}" from channel ${channelId}`
          );

          // Process the reply based on message type
          switch (message.type) {
            case MetricReplyType.getCpuMetrics:
              // For regular metrics, format them
              const metricsMessage = formatMetricsMessage(message.data.metrics);
              await this.sendTelexResponse(
                channelId.toString(),
                metricsMessage
              );
              break;

            case MetricReplyType.getCpuLoadAverages:
              const avgsMessage = getFormattedLoadAverages(
                message.data.metrics
              );
              await this.sendTelexResponse(channelId.toString(), avgsMessage);
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
