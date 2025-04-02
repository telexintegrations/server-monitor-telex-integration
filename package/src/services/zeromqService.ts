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
  getMemoryStats = "getMemoryStats",
  getDiskMetrics = "getDiskMetrics",
  getProcessMetrics = "getProcessMetrics",
  getNetworkMetrics = "getNetworkMetrics",
  getSecurityMetrics = "getSecurityMetrics",
  ping = "ping",
}

export enum OutGoingMessageReplyType {
  getAllMetricsReply = "getAllMetricsReply",
  getCpuMetricsReply = "getCpuMetricsReply",
  getCpuLoadAveragesReply = "getCpuLoadAveragesReply",
  getCpuUsagePerCoreReply = "getCpuUsagePerCoreReply",
  getMemoryStatsReply = "getMemoryStatsReply",
  getDiskMetricsReply = "getDiskMetricsReply",
  getProcessMetricsReply = "getProcessMetricsReply",
  getNetworkMetricsReply = "getNetworkMetricsReply",
  getSecurityMetricsReply = "getSecurityMetricsReply",
  pingReply = "pingReply",
  cpuThresholdAlertReply = "cpuThresholdAlertReply",
  memoryThresholdAlertReply = "memoryThresholdAlertReply",
  securityAlertReply = "securityAlertReply",
}

// Create a mapping of functions for metrics collection
const functionMap = {
  getAllMetricsReply: CollectorService.getMetrics,
  getCpuMetricsReply: CollectorService.getMetrics,
  getCpuLoadAveragesReply: CollectorService.getMetrics,
  getCpuUsagePerCoreReply: CollectorService.getCpuUsagePerCoreMetrics,
  getMemoryStatsReply: CollectorService.getMetrics,
  getDiskMetricsReply: CollectorService.getDiskMetrics,
  getProcessMetricsReply: CollectorService.getProcessMetrics,
  getNetworkMetricsReply: CollectorService.getNetworkMetrics,
  getSecurityMetricsReply: CollectorService.getSecurityMetrics,
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

// Send a Security alert to the integration server
export async function sendSecurityAlert(
  channelId: string,
  metrics: any,
  alerts: string[],
  isCritical: boolean
) {
  const severityEmoji = isCritical ? "🔥" : "⚠️";
  const severityText = isCritical ? "CRITICAL" : "WARNING";

  const alertMessage = {
    metrics,
    severity: isCritical ? "critical" : "warning",
    message: `${severityEmoji} ${severityText}: Security Alert ${severityEmoji}\n\n${alerts.join(
      "\n"
    )}\n\nServer: ${
      getStoreData()?.serverName || "Unknown"
    }\nTimestamp: ${new Date().toLocaleString()}`,
  };

  await sendReply(
    channelId,
    alertMessage,
    OutGoingMessageReplyType.securityAlertReply
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

          // Handle memory threshold settings
          const memoryThresholdSetting = message.data.settings.find(
            (s: any) => s.label === "memory_threshold"
          );

          if (memoryThresholdSetting) {
            const memThresholdValue = Number(
              memoryThresholdSetting.value ||
                memoryThresholdSetting.default ||
                90
            );

            saveStoreData({
              memoryThreshold: memThresholdValue,
            });

            logger.info(
              `Stored Memory threshold setting: ${memThresholdValue}%`
            );
          }

          // Handle security settings
          const securitySettings = {
            failedLoginThreshold: 5, // Default value
            monitorPortScanning: true,
            monitorFirewall: true,
          };

          // Failed login threshold
          const failedLoginSetting = message.data.settings.find(
            (s: any) => s.label === "failed_login_threshold"
          );

          if (failedLoginSetting) {
            securitySettings.failedLoginThreshold = Number(
              failedLoginSetting.value || failedLoginSetting.default || 5
            );
          }

          // Port scanning monitoring
          const portScanSetting = message.data.settings.find(
            (s: any) => s.label === "monitor_port_scanning"
          );

          if (portScanSetting) {
            securitySettings.monitorPortScanning =
              portScanSetting.value === "true" ||
              portScanSetting.value === true ||
              portScanSetting.default === "true" ||
              portScanSetting.default === true;
          }

          // Firewall monitoring
          const firewallSetting = message.data.settings.find(
            (s: any) => s.label === "monitor_firewall"
          );

          if (firewallSetting) {
            securitySettings.monitorFirewall =
              firewallSetting.value === "true" ||
              firewallSetting.value === true ||
              firewallSetting.default === "true" ||
              firewallSetting.default === true;
          }

          // Save all security settings at once
          saveStoreData({ securitySettings });
          logger.info(
            `Stored security settings: ${JSON.stringify(securitySettings)}`
          );

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
              OutGoingMessageReplyType.getAllMetricsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getCpuMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuMetricsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getCpuLoadAverages:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuLoadAveragesReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getCpuUsagePerCore:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getCpuUsagePerCoreReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getMemoryStats:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getMemoryStatsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getDiskMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getDiskMetricsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getProcessMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getProcessMetricsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getNetworkMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getNetworkMetricsReply,
              message.data?.userMessage
            );
            break;
          case IncomingMessageType.getSecurityMetrics:
            await sendMetrics(
              channelId,
              OutGoingMessageReplyType.getSecurityMetricsReply,
              message.data?.userMessage
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
    const fallBackServerPort = 18010;
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
