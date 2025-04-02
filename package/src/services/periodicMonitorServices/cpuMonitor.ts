import { getStoreData, logger } from "../../index.js";
import { CollectorService } from "../../metrics/collector.js";
import {
  connectToIntegrationServer,
  OutGoingMessageReplyType,
  sendReply,
} from "../zeromqService.js";

export async function startCpuMonitoring(): Promise<NodeJS.Timeout> {
  const storeData = getStoreData();
  const channelId = storeData?.outputChannelId;

  if (!channelId) {
    logger.error("Channel ID not found. Cannot start CPU monitoring.");
    // Return a dummy interval that we'll clear immediately
    const dummyInterval = setInterval(() => {}, 1000);
    clearInterval(dummyInterval);
    return dummyInterval;
  }

  // connect to integration server
  await connectToIntegrationServer(channelId);

  logger.info("Starting CPU threshold monitoring");

  // Reset alert tracking
  let lastAlertTime = 0;

  // start periodic monitoring
  return setInterval(async () => {
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

        if (!lastAlertTime || currentTime - lastAlertTime > cooldownPeriod) {
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
          lastAlertTime = currentTime;
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
    OutGoingMessageReplyType.cpuThresholdAlertReply
  );
}
