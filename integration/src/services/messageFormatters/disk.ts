import { MetricsData } from "../../types/metricType.js";
import { getUsageIndicator } from "../messageFormatters.js";

/**
 * Formats disk metrics if available
 */
function formatDiskMetrics(metrics: MetricsData): string {
  if (!metrics.disk || !metrics.disk.filesystems.length) {
    return "";
  }

  let output = `
┌─────────────────────────┐
     💿 DISK METRICS     
└─────────────────────────┘

== FILESYSTEMS ==`;

  // Format each filesystem
  metrics.disk.filesystems.forEach((fs) => {
    const usageIndicator = getUsageIndicator(fs.use);
    output += `
Mount: ${fs.mount}
▶ Type: ${fs.type || "Unknown"}
▶ Size: ${(fs.size / 1024 / 1024 / 1024).toFixed(2)} GB
▶ Used: ${(fs.used / 1024 / 1024 / 1024).toFixed(2)} GB
▶ Available: ${(fs.available / 1024 / 1024 / 1024).toFixed(2)} GB
▶ Usage: ${fs.use.toFixed(2)}%  ${usageIndicator}
`;
  });

  // Add IO metrics if available
  if (metrics.disk.io) {
    output += `
== DISK I/O ==
▶ Read Operations: ${metrics.disk.io.rIO}
▶ Write Operations: ${metrics.disk.io.wIO}
▶ Total Operations: ${metrics.disk.io.tIO}
▶ Reads/sec: ${metrics.disk.io.rPerSec?.toFixed(2) || "N/A"}
▶ Writes/sec: ${metrics.disk.io.wPerSec?.toFixed(2) || "N/A"}
`;
  }

  return output;
}

export { formatDiskMetrics };
