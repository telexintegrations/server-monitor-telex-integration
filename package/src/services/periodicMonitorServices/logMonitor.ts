import {
  getLogMetrics,
  LogMetrics,
  logMonitor,
} from "../../metrics/logMonitor.js";
import { AppConstants } from "../../utils/constant.js";
import { logger } from "../../utils/logger.js";
import { getStoreData } from "../../utils/store.js";
import {
  connectToIntegrationServer,
  OutGoingMessageReplyType,
  sendReply,
} from "../zeromqService.js";

export async function startLogMonitor(): Promise<NodeJS.Timeout> {
  const storedData = getStoreData();
  const channelId = storedData?.outputChannelId;

  if (!channelId) {
    logger.error("Channel ID not found. Cannot start log monitoring.");
    // Return a dummy interval that we'll clear immediately
    const dummyInterval = setInterval(() => {}, 1000);
    clearInterval(dummyInterval);
    return dummyInterval;
  }
  // connect to integration server
  await connectToIntegrationServer(channelId);
  logger.info("Starting log monitoring");

  // Reset alert tracking
  let lastAlertTime = 0;

  // start periodic monitoring
  const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in ms

  return setInterval(async () => {
    try {
      const metrics = await getLogMetrics();
      const storedData = getStoreData();
      const customLogPath =
        storedData?.customLogPath ||
        `${AppConstants.Package.LogsDir}/error.log`;
      const currentTime = Date.now();
      if (customLogPath) {
        logMonitor.setCustomLogPath(customLogPath);
      }

      if (metrics.logMetrics) {
        if (!lastAlertTime || currentTime - lastAlertTime > cooldownPeriod) {
          await sendLogMetrics(metrics.logMetrics, channelId);

          lastAlertTime = currentTime;
        }
      }
    } catch (error) {
      logger.error("Error in log monitoring:", error);
    }
  }, 60000); // 1 minute interval
}

// send log metics to the integration server
async function sendLogMetrics(metrics: LogMetrics, channelId: string) {
  if (!metrics) return;
  let output = `
┌─────────────────────────┐
     ⚠️ LOG METRICS     
└─────────────────────────┘
`;

  // System Errors
  if (metrics.systemErrors.length) {
    output += `
== SYSTEM ERRORS ==
Last Check: ${new Date(metrics.timestamp).toLocaleString()}
`;
    metrics.systemErrors.forEach((entry, i) => {
      output += `
${i + 1}. [${entry.timestamp}] ${entry.message.substring(0, 80)}${
        entry.message.length > 80 ? "..." : ""
      }
`;
    });
  } else {
    output += `
== SYSTEM ERRORS ==
No recent errors detected
`;
  }

  // Custom Log Entries
  if (metrics.customLogEntries.length) {
    output += `
== CUSTOM LOG ENTRIES ==
Last Check: ${new Date(metrics.timestamp).toLocaleString()}
`;
    metrics.customLogEntries.forEach((entry, i) => {
      output += `
${i + 1}. [${entry.timestamp}] ${entry.message.substring(0, 80)}${
        entry.message.length > 80 ? "..." : ""
      }
`;
    });
  } else if (metrics.customLogEntries.length === 0 && metrics.timestamp > 0) {
    output += `
== CUSTOM LOG ENTRIES ==
No matching entries found
`;
  }

  await sendReply(
    channelId,
    { message: output },
    OutGoingMessageReplyType.logMetricReply
  );
}
