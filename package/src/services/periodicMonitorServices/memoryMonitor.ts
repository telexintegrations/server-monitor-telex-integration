import { logger } from "../../utils/logger.js";
import { getStoreData } from "../../utils/store.js";
import { CollectorService } from "../../metrics/collector.js";
import {
  sendReply,
  OutGoingMessageReplyType,
  connectToIntegrationServer,
} from "../zeromqService.js";

export async function startMemoryMonitoring(): Promise<NodeJS.Timeout> {
  const storeData = getStoreData();
  const channelId = storeData?.outputChannelId;

  if (!channelId) {
    logger.error("Channel ID not found. Cannot start Memory monitoring.");
    // Return a dummy interval that we'll clear immediately
    const dummyInterval = setInterval(() => {}, 1000);
    clearInterval(dummyInterval);
    return dummyInterval;
  }

  // connect to integration server
  await connectToIntegrationServer(channelId);

  logger.info("Starting Memory threshold monitoring");

  // Reset alert tracking
  let lastAlertTime = 0;

  return setInterval(async () => {
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

        if (!lastAlertTime || currentTime - lastAlertTime > cooldownPeriod) {
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
          lastAlertTime = currentTime;
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
}

// Send a Memory threshold alert to the integration server
export async function sendMemoryAlert(
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
    message: `${severityEmoji} ${severityText}: Memory Usage Alert ${severityEmoji}\n\nMemory usage (${metrics.memory.percentage.toFixed(
      1
    )}%) has exceeded the threshold (${threshold}%)\n\nServer: ${
      getStoreData()?.serverName || "Unknown"
    }\nTotal Memory: ${metrics.memory.total.toFixed(
      2
    )} GB\nUsed Memory: ${metrics.memory.used.toFixed(2)} GB${
      metrics.memory.swap
        ? `\nSwap Usage: ${metrics.memory.swap.percentage.toFixed(1)}%`
        : ""
    }\nTimestamp: ${new Date().toLocaleString()}`,
  };

  await sendReply(
    channelId,
    alertMessage,
    OutGoingMessageReplyType.memoryThresholdAlertReply
  );
}
