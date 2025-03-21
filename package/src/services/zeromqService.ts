import { Subscriber, Publisher } from "zeromq";
import { logger } from "../utils/logger.js";
import { CollectorService } from "../metrics/collector.js";
import { AppConstants } from "../utils/constant.js";
import { isDevEnvironment } from "../config/config.js";
import { getStoreData, saveStoreData } from "../utils/store.js";
import os from "os";

export enum IncomingMessageType {
  getAllMetrics = "getAllMetrics",
  getCpuMetrics = "getCpuMetrics",
  getCpuLoadAverages = "getCpuLoadAverages",
  getCpuUsagePerCore = "getCpuUsagePerCore",
  ping = "ping",
}

export enum OutGoingMessageReplyType {
  getAllMetrics = "getAllMetricsReply",
  getCpuMetrics = "getCpuMetricsReply",
  getCpuLoadAverages = "getCpuLoadAveragesReply",
  getCpuUsagePerCore = "getCpuUsagePerCoreReply",
  cpuThresholdAlert = "cpuThresholdAlertReply",
  replyPong = "replyPong",
}

export const functionMap = {
  [OutGoingMessageReplyType.getAllMetrics]: CollectorService.getMetrics,
  [OutGoingMessageReplyType.getCpuMetrics]: CollectorService.getMetrics,
  [OutGoingMessageReplyType.getCpuLoadAverages]: CollectorService.getMetrics,
  [OutGoingMessageReplyType.getCpuUsagePerCore]:
    CollectorService.getCpuUsagePerCoreMetrics,
};

export interface IZeromqMessage {
  type: IncomingMessageType | string;
  channelId: string;
  data: any;
  timestamp: string;
}

let subSocket: Subscriber | null = null;
let pubSocket: Publisher | null = null;

// Connect to the integration server's publisher socket
export async function connectToIntegrationServer(
  channelId: string
): Promise<void> {
  try {
    if (subSocket) {
      logger.warn("ZeroMQ socket is already connected");
      return;
    }

    // fetch the host and port from the integration server
    const serverConfig = await getIntegrationServerHostAndPort();

    if (!serverConfig?.serverUrl || !serverConfig?.serverPort) {
      throw new Error("Failed to fetch integration server config");
    }

    const serverUrl = serverConfig?.serverUrl;
    const serverPort = serverConfig?.serverPort + 1;

    logger.info(`Integration server: ${serverUrl}:${serverPort}`);

    // Set up subscriber socket
    subSocket = new Subscriber();
    const subSocketAddress = `tcp://${serverUrl}:${serverPort}`;
    await subSocket.connect(subSocketAddress);
    await subSocket.subscribe(channelId);

    // Set up publisher socket for replies
    pubSocket = new Publisher();
    const pubPort = serverPort + 1; // Use next port for replies
    const pubSocketAddress = `tcp://${serverUrl}:${pubPort}`;
    await pubSocket.connect(pubSocketAddress);

    logger.info(`Connected to integration server at ${subSocketAddress}`);
    logger.info(`Reply socket connected to ${pubSocketAddress}`);
    logger.info(`Subscribed to channel ${channelId}`);

    // Start message handler
    handleMessages(channelId);
  } catch (error) {
    logger.error(
      `Failed to connect to integration server: ${(error as Error).message}`
    );
    throw error;
  }
}

// Send a reply back to the integration server
export async function sendReply(
  channelId: string,
  data: any,
  messageType: OutGoingMessageReplyType
): Promise<void> {
  if (!pubSocket) {
    throw new Error("Reply socket not connected");
  }

  try {
    const reply: IZeromqMessage = {
      type: messageType,
      channelId,
      data,
      timestamp: new Date().toISOString(),
    };

    await pubSocket.send([channelId, JSON.stringify(reply)]);
    logger.info(`Sent ${messageType} to channel ${channelId}`);
  } catch (error) {
    logger.error(`Failed to send reply: ${(error as Error).message}`);
  }
}

/**
 * Send metrics to the integration server
 */
export async function sendMetrics(
  channelId: string,
  messageType: OutGoingMessageReplyType,
  userMessage?: string
) {
  let metrics = await functionMap[messageType as keyof typeof functionMap]();
  logger.info(`Collected metrics for ${channelId}`);
  await sendReply(channelId, { metrics, userMessage }, messageType);
}

// Send a CPU threshold alert to the integration server
export async function sendCpuAlert(
  channelId: string,
  metrics: any,
  threshold: number,
  isCritical: boolean
) {
  const severityEmoji = isCritical ? "🔥" : "⚠️";
  const severityText = isCritical ? "CRITICAL" : "WARNING";

  const alertMessage = {
    metrics,
    threshold,
    severity: isCritical ? "critical" : "warning",
    message: `${severityEmoji} ${severityText}: CPU Usage Alert ${severityEmoji}\n\nCPU usage (${metrics.cpu.usage.toFixed(
      1
    )}%) has exceeded the threshold (${threshold}%)\n\nServer: ${
      getStoreData()?.serverName || "Unknown"
    }\nCPU Cores: ${
      metrics.cpu?.cores || "N/A"
    }\nTimestamp: ${new Date().toLocaleString()}`,
  };

  await sendReply(
    channelId,
    alertMessage,
    OutGoingMessageReplyType.cpuThresholdAlert
  );
}

// Handle incoming messages from the integration server
async function handleMessages(channelId: string): Promise<void> {
  if (!subSocket) {
    throw new Error("ZeroMQ socket not connected");
  }

  try {
    for await (const [topic, messageBuffer] of subSocket) {
      try {
        const message = JSON.parse(messageBuffer.toString()) as IZeromqMessage;
        logger.info(`Received message type: ${message.type}`);

        if (topic.toString() !== channelId) {
          continue;
        }

        // Store settings if provided
        if (message.data?.settings && Array.isArray(message.data.settings)) {
          const cpuThresholdSetting = message.data.settings.find(
            (s: any) => s.label === "cpu_threshold"
          );

          if (cpuThresholdSetting) {
            const thresholdValue = Number(
              cpuThresholdSetting.value || cpuThresholdSetting.default || 80
            );

            saveStoreData({
              cpuThreshold: thresholdValue,
            });

            logger.info(`Stored CPU threshold setting: ${thresholdValue}%`);
          }

          // Store server name if available
          if (!getStoreData()?.serverName) {
            saveStoreData({
              serverName: `${os.hostname()}`,
            });
          }
        }

        // Process different types of requests
        const incomingMessageType = message.type;

        switch (incomingMessageType) {
          case IncomingMessageType.getAllMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getAllMetrics,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getCpuMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuMetrics
            );
            break;
          case IncomingMessageType.getCpuLoadAverages:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuLoadAverages
            );
            break;
          case IncomingMessageType.getCpuUsagePerCore:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuUsagePerCore
            );
            break;
          default:
            logger.warn(`Unknown message type: ${incomingMessageType}`);
            break;
        }
      } catch (error) {
        logger.error(`Error processing message: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    logger.error(`Error in message handler: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Close the ZeroMQ socket connection
 */
export function closeSocket(): void {
  if (subSocket) {
    try {
      subSocket.close();
      subSocket = null;
      logger.info("Subscriber socket closed");
    } catch (error) {
      logger.error(
        `Error closing subscriber socket: ${(error as Error).message}`
      );
    }
  }

  if (pubSocket) {
    try {
      pubSocket.close();
      pubSocket = null;
      logger.info("Publisher socket closed");
    } catch (error) {
      logger.error(
        `Error closing publisher socket: ${(error as Error).message}`
      );
    }
  }
}

async function getIntegrationServerHostAndPort(): Promise<{
  serverUrl: string;
  serverPort: number;
} | null> {
  try {
    if (isDevEnvironment) {
      return {
        serverUrl: "0.0.0.0",
        serverPort: 3002,
      };
    }

    const fallBackServerHost = "49.12.208.6";
    const fallBackServerPort = 3002;
    try {
      const response = await fetch(AppConstants.Package.GlobalConfigUrl);

      if (!response.ok) {
        logger.warn(`Failed to fetch global config: ${response.statusText}`);
        return {
          serverUrl: fallBackServerHost,
          serverPort: fallBackServerPort,
        };
      }

      const config = await response.json();
      return {
        serverUrl: config.serverUrl,
        serverPort: config.serverPort,
      };
    } catch (error) {
      logger.warn(
        `Error fetching config, using default: ${(error as Error).message}`
      );
      return {
        serverUrl: fallBackServerHost,
        serverPort: fallBackServerPort,
      };
    }
  } catch (error) {
    logger.error(`Failed to get server config: ${(error as Error).message}`);
    return null;
  }
}
