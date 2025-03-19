import { logger } from "../utils/logger.js";
import { getStoreData, saveStoreData } from "../utils/store.js";
import { CollectorService } from "../metrics/collector.js";
import {
  connectToIntegrationServer,
  closeSocket,
  IncomingMessageType,
  sendCpuAlert,
} from "../services/zeromqService.js";
import os from "os";

let cpuCheckInterval: NodeJS.Timeout | null = null;
// Track last alert time to prevent alert spam
let lastAlertTime: { [key: string]: number } = {};

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

    // Save hostname as server name if not already set
    if (!storeData?.serverName) {
      try {
        const hostname = os.hostname();
        saveStoreData({ serverName: hostname });
        logger.info(`Server name set to hostname: ${hostname}`);
      } catch (error) {
        logger.warn(`Could not get hostname: ${(error as Error).message}`);
        saveStoreData({ serverName: "Unknown Server" });
      }
    }

    logger.info(`Starting monitoring with channel ID: ${channelId}`);
    logger.info("Connecting to integration server to receive metric requests");

    // Connect to the integration server
    await connectToIntegrationServer(channelId);

    saveStoreData({ isMonitoringRunning: true });

    // Start periodic CPU monitoring
    startCpuMonitoring(channelId);

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
 * Start periodic CPU monitoring
 */
function startCpuMonitoring(channelId: string) {
  if (cpuCheckInterval) {
    clearInterval(cpuCheckInterval);
  }

  logger.info("Starting CPU threshold monitoring");

  // Reset alert tracking
  lastAlertTime = {};

  cpuCheckInterval = setInterval(async () => {
    try {
      const metrics = await CollectorService.getMetrics();
      const storeData = getStoreData();
      const threshold = storeData?.cpuThreshold || 80;
      const currentTime = Date.now();

      // Only send alerts if CPU usage is above threshold
      if (metrics.cpu && metrics.cpu.usage > threshold) {
        // Determine alert severity
        const isCritical = metrics.cpu.usage > threshold + 10;

        // Only send alerts if it has been more than 5 minutes since the last alert of the same severity
        // This prevents alert flooding
        const alertKey = isCritical ? "critical" : "warning";
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in ms

        if (
          !lastAlertTime[alertKey] ||
          currentTime - lastAlertTime[alertKey] > cooldownPeriod
        ) {
          // Log and send the alert
          if (isCritical) {
            logger.error(
              `CRITICAL: CPU usage at ${metrics.cpu.usage.toFixed(
                1
              )}%, exceeding threshold of ${threshold}%`
            );
          } else {
            logger.warn(
              `WARNING: CPU usage at ${metrics.cpu.usage.toFixed(
                1
              )}%, exceeding threshold of ${threshold}%`
            );
          }

          // Send alert via ZeroMQ
          await sendCpuAlert(channelId, metrics, threshold, isCritical);

          // Update last alert time
          lastAlertTime[alertKey] = currentTime;
        } else {
          logger.info(
            `Suppressing ${alertKey} CPU alert (${metrics.cpu.usage.toFixed(
              1
            )}%) - cooldown period active`
          );
        }
      }
    } catch (error) {
      logger.error(`Error in CPU monitoring: ${(error as Error).message}`);
    }
  }, 60000); // Check every minute

  logger.info("CPU monitoring interval started - checking every minute");
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
    if (cpuCheckInterval) {
      clearInterval(cpuCheckInterval);
      cpuCheckInterval = null;
      logger.info("CPU monitoring stopped");
    }

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
