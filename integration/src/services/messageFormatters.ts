import {
  MetricsData,
  MetricReplyType,
  IFormatMetricResponseOptions,
} from "../types/metricType.js";

/**
 * Formats CPU metrics for display
 */
export function formatMetricsMessage(metrics: MetricsData): string {
  if (!metrics.cpu) {
    return "No CPU metrics available";
  }

  return `
┌─────────────────────────┐
     📊 CPU METRICS     
└─────────────────────────┘

▶ Usage:        ${metrics.cpu.usage.toFixed(2)}%  ${getUsageIndicator(metrics.cpu.usage)}
▶ Cores:        ${metrics.cpu.cores || "N/A"}
▶ Load Average: ${metrics.cpu.load_avg?.[0]?.toFixed(2) || "N/A"}`;
}

/**
 * Returns a visual indicator based on usage percentage
 */
function getUsageIndicator(usage: number): string {
  if (usage >= 90) return "🔴 High";
  if (usage >= 70) return "🟠 Moderate";
  return "🟢 Normal";
}

/**
 * Formats memory metrics if available
 */
function formatMemoryMetrics(metrics: MetricsData): string {
  if (!metrics.memory) {
    return "";
  }

  const memoryPercentage = metrics.memory.percentage;
  const memoryIndicator = getUsageIndicator(memoryPercentage);

  return `
┌─────────────────────────┐
     💾 MEMORY STATS     
└─────────────────────────┘

▶ Used:  ${metrics.memory.used.toFixed(2)} GB
▶ Total: ${metrics.memory.total.toFixed(2)} GB
▶ Usage: ${memoryPercentage.toFixed(2)}%  ${memoryIndicator}`;
}

/**
 * Formats CPU load averages
 */
export function getFormattedLoadAverages(metrics: MetricsData): string {
  if (!metrics.cpuLoadAvgs) {
    return "CPU load average data not available";
  }

  const load1min = metrics.cpuLoadAvgs["1min"];
  const load5min = metrics.cpuLoadAvgs["5mins"];
  const load15min = metrics.cpuLoadAvgs["15mins"];

  return `
┌─────────────────────────┐
   ⏱️ CPU LOAD AVERAGES   
└─────────────────────────┘

▶ 1 minute:   ${load1min.toFixed(2)}%  ${getUsageIndicator(load1min)}
▶ 5 minutes:  ${load5min.toFixed(2)}%  ${getUsageIndicator(load5min)}
▶ 15 minutes: ${load15min.toFixed(2)}%  ${getUsageIndicator(load15min)}`;
}

/**
 * Formats CPU usage per core metrics
 */
export function formatCpuUsagePerCoreMetrics(metrics: MetricsData): string {
  if (!metrics.cpuUsagePerCore || metrics.cpuUsagePerCore.length === 0) {
    return "CPU per-core metrics not available";
  }

  const coresInfo = metrics.cpuUsagePerCore
    .map(
      (usage: number, index: number) =>
        `▶ Core ${index.toString().padEnd(2)}: ${usage.toFixed(2).padEnd(5)}% ${getUsageIndicator(usage)}`
    )
    .join("\n");

  return `
┌─────────────────────────┐
   ⚡ CPU USAGE PER CORE  
└─────────────────────────┘

${coresInfo}`;
}

/**
 * Formats CPU alert messages
 */
export function formatCpuAlertMessage(
  metrics: MetricsData,
  threshold: number,
  isCritical: boolean
): string {
  const severityEmoji = isCritical ? "🔥" : "⚠️";
  const severityText = isCritical ? "CRITICAL" : "WARNING";

  if (!metrics.cpu) {
    return `${severityEmoji} ${severityText}: CPU usage data not available`;
  }

  return `
┌─────────────────────────┐
 ${severityEmoji} ${severityText} CPU ALERT 
└─────────────────────────┘

CPU usage (${metrics.cpu.usage.toFixed(1)}%) has exceeded the threshold (${threshold}%)

▶ Cores:     ${metrics.cpu.cores || "N/A"}
▶ Timestamp: ${new Date().toLocaleString()}

${isCritical ? "IMMEDIATE ACTION REQUIRED!" : "Please investigate when possible."}`;
}

/**
 * Universal formatter that determines the appropriate format based on metric type
 */
export function formatMetricResponse(
  type: string,
  metrics: MetricsData,
  options: IFormatMetricResponseOptions = {
    isCritical: false,
    cpuThreshold: 80,
  }
): string {
  switch (type) {
    case MetricReplyType.getCpuMetrics:
      return formatMetricsMessage(metrics);
    case MetricReplyType.getCpuLoadAverages:
      return getFormattedLoadAverages(metrics);
    case MetricReplyType.getCpuUsagePerCore:
      return formatCpuUsagePerCoreMetrics(metrics);
    case MetricReplyType.getMemoryStats:
      return formatMemoryMetrics(metrics);
    case MetricReplyType.getAllMetrics:
      // Format all available metrics in a comprehensive view
      return formatAllMetrics(metrics);
    case MetricReplyType.cpuThresholdAlert:
      return formatCpuAlertMessage(
        metrics,
        options.cpuThreshold,
        options.isCritical
      );
    default:
      return formatMetricsMessage(metrics);
  }
}

/**
 * Formats all available metrics into a single comprehensive report
 */
export function formatAllMetrics(metrics: MetricsData): string {
  let report = `
┌─────────────────────────┐
    📊 SERVER METRICS     
└─────────────────────────┘

`;

  // Add CPU metrics if available
  if (metrics.cpu) {
    report += `
== CPU USAGE ==
▶ Overall Usage: ${metrics.cpu.usage.toFixed(2)}%  ${getUsageIndicator(metrics.cpu.usage)}
▶ Cores:         ${metrics.cpu.cores || "N/A"}
`;
  }

  // Add CPU load averages if available
  if (metrics.cpuLoadAvgs) {
    report += `
== LOAD AVERAGES ==
▶ 1 minute:   ${metrics.cpuLoadAvgs["1min"].toFixed(2)}%  ${getUsageIndicator(metrics.cpuLoadAvgs["1min"])}
▶ 5 minutes:  ${metrics.cpuLoadAvgs["5mins"].toFixed(2)}%  ${getUsageIndicator(metrics.cpuLoadAvgs["5mins"])}
▶ 15 minutes: ${metrics.cpuLoadAvgs["15mins"].toFixed(2)}%  ${getUsageIndicator(metrics.cpuLoadAvgs["15mins"])}
`;
  }

  // Add memory stats if available
  if (metrics.memory) {
    const memoryPercentage = metrics.memory.percentage;
    report += `
== MEMORY USAGE ==
▶ Used:  ${metrics.memory.used.toFixed(2)} GB
▶ Total: ${metrics.memory.total.toFixed(2)} GB
▶ Usage: ${memoryPercentage.toFixed(2)}%  ${getUsageIndicator(memoryPercentage)}
`;
  }

  // Add per-core usage if available
  if (metrics.cpuUsagePerCore && metrics.cpuUsagePerCore.length > 0) {
    report += `\n== PER-CORE CPU USAGE ==\n`;

    // Create a compact multi-column layout for many cores
    const cores = metrics.cpuUsagePerCore;
    const coreCount = cores.length;

    if (coreCount <= 8) {
      // For fewer cores, show them all in a single column
      cores.forEach((usage, index) => {
        report += `▶ Core ${index.toString().padEnd(2)}: ${usage.toFixed(2).padEnd(5)}% ${getUsageIndicator(usage)}\n`;
      });
    } else {
      // For many cores, use a two-column layout
      const halfLength = Math.ceil(coreCount / 2);
      for (let i = 0; i < halfLength; i++) {
        const leftCore = `Core ${i.toString().padEnd(2)}: ${cores[i].toFixed(2).padEnd(5)}% ${getUsageIndicator(cores[i])}`;

        let rightCore = "";
        if (i + halfLength < coreCount) {
          rightCore = `Core ${(i + halfLength).toString().padEnd(2)}: ${cores[i + halfLength].toFixed(2).padEnd(5)}% ${getUsageIndicator(cores[i + halfLength])}`;
        }

        if (rightCore) {
          report += `▶ ${leftCore.padEnd(30)} ▶ ${rightCore}\n`;
        } else {
          report += `▶ ${leftCore}\n`;
        }
      }
    }
  }

  // Server name if available
  if (metrics.serverName) {
    report += `\n== SERVER INFO ==\n▶ Server Name: ${metrics.serverName}\n`;
  }

  // Add timestamp
  report += `\n▶ Updated at: ${new Date().toLocaleString()}\n`;

  return report;
}
