import { logger } from "../utils/logger.js";
import { getStoreData, saveStoreData } from "../utils/store.js";
import {
  connectToIntegrationServer,
  closeSocket,
} from "../services/zeromqService.js";
import { CollectorService } from "../metrics/collector.js";
import { AppConstants } from "../utils/constant.js";
import axios from "axios";

let monitoringInterval: NodeJS.Timeout;
const DEFAULT_CHECK_INTERVAL = 5000;

/**
 * Start the monitoring process
 */
export async function startMonitoring(): Promise<void> {
  try {
    if (getStoreData()?.isMonitoringRunning) {
      logger.warn("Monitoring is already running");
      return;
    }

    const storeData = getStoreData();
    const channelId = storeData?.outputChannelId;

    if (!channelId) {
      throw new Error("No channel ID found. Please run setup first.");
    }

    logger.info(`Starting monitoring with channel ID: ${channelId}`);
    logger.info("Connecting to integration server to receive metric requests");

    // Get integration server details from environment or config
    const integrationHost = process.env.INTEGRATION_HOST || "localhost";
    const integrationPort = parseInt(
      process.env.INTEGRATION_PORT || "5000",
      10
    );

    // Connect to the integration server
    await connectToIntegrationServer(channelId);

    monitoringInterval = setInterval(async () => {
      const { cpu } = await CollectorService.getMetrics();
      const { cpuUsageThreshold, lastAlertSentAt, serverName } = storeData;
      const now = new Date().getTime();

      if ((cpu?.usage || 0) > cpuUsageThreshold) {
        if (now - (lastAlertSentAt || 0) >= 300000) {
          // If it has been more than 5 minutes since the last alert, send the alert

          const message = `⚠️ Your server, ${serverName}, has exceeded the set usage threshold of ${cpuUsageThreshold}.`;

          const data = {
            message: message + "\n\n_🔍 Sent by Server Monitor Agent_",
            username: "Server Monitor Agent",
            event_name: "Server Monitor Agent",
            status: "success",
          };

          await axios.post(AppConstants.Telex.ReturnUrl(channelId), data, {
            headers: {
              "Content-Type": "application/json",
            },
          });

          saveStoreData({ lastAlertSentAt: now });
        }
      }
    }, DEFAULT_CHECK_INTERVAL);

    saveStoreData({ isMonitoringRunning: true });

    // Keep the process running
    process.on("SIGINT", async () => {
      await stopMonitoring();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await stopMonitoring();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Failed to start monitoring: ${(error as Error).message}`);
    saveStoreData({ isMonitoringRunning: false });
    closeSocket();
    throw error;
  }
}

/**
 * Stop the monitoring process
 */
export async function stopMonitoring(): Promise<void> {
  if (!getStoreData()?.isMonitoringRunning) {
    logger.warn("Monitoring is not running");
    return;
  }

  try {
    clearInterval(monitoringInterval);
    closeSocket();
    saveStoreData({ isMonitoringRunning: false });
    logger.info("Monitoring stopped successfully");
  } catch (error) {
    logger.error(`Failed to stop monitoring: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Check if monitoring is currently running
 */
export function isMonitoringRunning(): boolean {
  return getStoreData()?.isMonitoringRunning || false;
}
