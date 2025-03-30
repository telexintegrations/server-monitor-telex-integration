import { logger } from "../../utils/logger.js";
import { getStoreData, saveStoreData } from "../../utils/store.js";
import { CollectorService } from "../../metrics/collector.js";
import {
  connectToIntegrationServer,
  closeSocket,
  IncomingMessageType,
  sendCpuAlert,
  sendMemoryAlert,
  sendSecurityAlert,
} from "../zeromqService.js";
import os from "os";
import { checkSecurityThresholds } from "../../metrics/security.js";

let cpuCheckInterval: NodeJS.Timeout | null = null;
let memoryCheckInterval: NodeJS.Timeout | null = null;
let securityCheckInterval: NodeJS.Timeout | null = null;
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

    // Start periodic Memory monitoring
    startMemoryMonitoring(channelId);

    // Start periodic Security monitoring
    startSecurityMonitoring(channelId);

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
 * Start periodic Memory monitoring
 */
function startMemoryMonitoring(channelId: string) {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
  }

  logger.info("Starting Memory threshold monitoring");

  // Reset alert tracking if not already initialized
  if (!lastAlertTime.memoryWarning) {
    lastAlertTime.memoryWarning = 0;
  }
  if (!lastAlertTime.memoryCritical) {
    lastAlertTime.memoryCritical = 0;
  }

  memoryCheckInterval = setInterval(async () => {
    try {
      const metrics = await CollectorService.getMetrics();
      const storeData = getStoreData();
      const threshold = storeData?.memoryThreshold || 90;
      const currentTime = Date.now();

      // Only send alerts if Memory usage is above threshold
      if (metrics.memory && metrics.memory.percentage > threshold) {
        // Determine alert severity
        const isCritical = metrics.memory.percentage > threshold + 5;

        // Only send alerts if it has been more than 5 minutes since the last alert of the same severity
        // This prevents alert flooding
        const alertKey = isCritical ? "memoryCritical" : "memoryWarning";
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in ms

        if (
          !lastAlertTime[alertKey] ||
          currentTime - lastAlertTime[alertKey] > cooldownPeriod
        ) {
          // Log and send the alert
          if (isCritical) {
            logger.error(
              `CRITICAL: Memory usage at ${metrics.memory.percentage.toFixed(
                1
              )}%, exceeding threshold of ${threshold}%`
            );
          } else {
            logger.warn(
              `WARNING: Memory usage at ${metrics.memory.percentage.toFixed(
                1
              )}%, exceeding threshold of ${threshold}%`
            );
          }

          // Send alert via ZeroMQ
          await sendMemoryAlert(channelId, metrics, threshold, isCritical);

          // Update last alert time
          lastAlertTime[alertKey] = currentTime;
        } else {
          logger.info(
            `Suppressing ${alertKey} Memory alert (${metrics.memory.percentage.toFixed(
              1
            )}%) - cooldown period active`
          );
        }
      }
    } catch (error) {
      logger.error(`Error in Memory monitoring: ${(error as Error).message}`);
    }
  }, 60000); // Check every minute

  logger.info("Memory monitoring interval started - checking every minute");
}

/**
 * Start periodic Security monitoring
 */
function startSecurityMonitoring(channelId: string) {
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }

  logger.info("Starting Security monitoring");

  // Reset alert tracking if not already initialized
  if (!lastAlertTime.securityWarning) {
    lastAlertTime.securityWarning = 0;
  }
  if (!lastAlertTime.securityCritical) {
    lastAlertTime.securityCritical = 0;
  }

  // Security checks run less frequently than CPU/memory as they're more resource-intensive
  securityCheckInterval = setInterval(async () => {
    try {
      const securityMetrics = await CollectorService.getSecurityMetrics();
      const currentTime = Date.now();
      const storeData = getStoreData();

      // Get security settings from store or use defaults
      const securitySettings = storeData?.securitySettings || {
        failedLoginThreshold: 5,
        monitorPortScanning: true,
        monitorFirewall: true,
      };

      // Only proceed if we have security metrics
      if (securityMetrics.security) {
        // Check for security issues
        const { alertRequired, isCritical, alerts } = checkSecurityThresholds(
          securityMetrics.security,
          securitySettings.failedLoginThreshold
        );

        if (alertRequired) {
          // Only send alerts if it has been more than 15 minutes since the last alert of the same severity
          // Security alerts use longer cooldown periods than CPU/memory to avoid flooding
          const alertKey = isCritical ? "securityCritical" : "securityWarning";
          const cooldownPeriod = 15 * 60 * 1000; // 15 minutes in ms

          if (
            !lastAlertTime[alertKey] ||
            currentTime - lastAlertTime[alertKey] > cooldownPeriod
          ) {
            // Log and send the alert
            if (isCritical) {
              logger.error(
                `CRITICAL: Security issues detected: ${alerts.join(", ")}`
              );
            } else {
              logger.warn(
                `WARNING: Security issues detected: ${alerts.join(", ")}`
              );
            }

            // Send alert via ZeroMQ
            await sendSecurityAlert(
              channelId,
              securityMetrics,
              alerts,
              isCritical
            );

            // Update last alert time
            lastAlertTime[alertKey] = currentTime;
          } else {
            logger.info(
              `Suppressing ${alertKey} security alert - cooldown period active`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error in Security monitoring: ${(error as Error).message}`);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes (less frequently than CPU/memory)

  logger.info(
    "Security monitoring interval started - checking every 5 minutes"
  );
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

    if (memoryCheckInterval) {
      clearInterval(memoryCheckInterval);
      memoryCheckInterval = null;
      logger.info("Memory monitoring stopped");
    }

    if (securityCheckInterval) {
      clearInterval(securityCheckInterval);
      securityCheckInterval = null;
      logger.info("Security monitoring stopped");
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
