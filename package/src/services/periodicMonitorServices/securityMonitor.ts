import { logger } from "../../utils/logger.js";
import { getStoreData } from "../../utils/store.js";
import { CollectorService } from "../../metrics/collector.js";
import { checkSecurityThresholds } from "../../metrics/security.js";
import {
  connectToIntegrationServer,
  sendSecurityAlert,
} from "../zeromqService.js";

export async function startSecurityMonitoring(): Promise<NodeJS.Timeout> {
  const storeData = getStoreData();
  const channelId = storeData?.outputChannelId;

  if (!channelId) {
    logger.error("Channel ID not found. Cannot start Security monitoring.");
    // Return a dummy interval that we'll clear immediately
    const dummyInterval = setInterval(() => {}, 1000);
    clearInterval(dummyInterval);
    return dummyInterval;
  }

  await connectToIntegrationServer(channelId);

  logger.info("Starting Security monitoring");

  // Reset alert tracking
  let lastAlertTime = 0;

  return setInterval(async () => {
    try {
      const metrics = await CollectorService.getMetrics();
      if (!metrics.security) {
        return;
      }

      const storeData = getStoreData();
      const currentTime = Date.now();
      const failedLoginThreshold =
        storeData?.securitySettings?.failedLoginThreshold || 5;

      const { alertRequired, isCritical, alerts } = checkSecurityThresholds(
        metrics.security,
        failedLoginThreshold
      );

      if (alertRequired) {
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in ms
        if (!lastAlertTime || currentTime - lastAlertTime > cooldownPeriod) {
          if (isCritical) {
            logger.error(`CRITICAL: Security issues detected`);
          } else {
            logger.warn(`WARNING: Security issues detected`);
          }

          // Send alert via ZeroMQ
          await sendSecurityAlert(channelId, metrics, alerts, isCritical);

          // Update last alert time
          lastAlertTime = currentTime;
        } else {
          logger.info(`Suppressing security alert - cooldown period active`);
        }
      }
    } catch (error) {
      logger.error(`Error in Security monitoring: ${(error as Error).message}`);
    }
  }, 60000); // Check every minute
}
