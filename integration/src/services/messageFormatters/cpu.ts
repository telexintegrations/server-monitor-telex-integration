import { MetricsData } from "../../types/metricType.js";
import { getUsageIndicator } from "../messageFormatters.js";

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
  
  ▶ Usage:            ${metrics.cpu.usage.toFixed(2)}%  ${getUsageIndicator(
    metrics.cpu.usage
  )}
  ▶ Cores:            ${metrics.cpu.cores || "N/A"}
  ▶ Load Average:     ${metrics.cpu.load_avg?.[0]?.toFixed(2) || "N/A"}
  ▶ Processes:        ${metrics.cpu.process_queue_length || "N/A"}
  ▶ Context switches: ${metrics.cpu.context_switches || "N/A"}
  ▶ Interrupts:       ${metrics.cpu.interrupts || "N/A"}`;
}

/**
 * Formats memory metrics if available
 */
export function formatMemoryMetrics(metrics: MetricsData): string {
  if (!metrics.memory) {
    return "";
  }

  const memoryPercentage = metrics.memory.percentage;
  const memoryIndicator = getUsageIndicator(memoryPercentage);

  // Build basic memory stats
  let memoryStats = `
  ┌─────────────────────────┐
       💾 MEMORY STATS     
  └─────────────────────────┘
  
  ▶ Used:  ${metrics.memory.used.toFixed(2)} GB
  ▶ Total: ${metrics.memory.total.toFixed(2)} GB
  ▶ Usage: ${memoryPercentage.toFixed(2)}%  ${memoryIndicator}`;

  // Add swap information if available
  if (metrics.memory.swap) {
    const swapPercentage = metrics.memory.swap.percentage;
    memoryStats += `\n
  ┌─────────────────────────┐
       🔄 SWAP MEMORY     
  └─────────────────────────┘
  
  ▶ Used:  ${metrics.memory.swap.used.toFixed(2)} GB
  ▶ Total: ${metrics.memory.swap.total.toFixed(2)} GB
  ▶ Usage: ${swapPercentage.toFixed(2)}%  ${getUsageIndicator(swapPercentage)}`;
  }

  // Add buffer/cache information if available
  if (metrics.memory.buffer) {
    memoryStats += `\n
  ┌─────────────────────────┐
       📦 BUFFER/CACHE     
  └─────────────────────────┘
  
  ▶ Used:       ${metrics.memory.buffer.used.toFixed(2)} GB
  ▶ Percentage: ${metrics.memory.buffer.percentage.toFixed(2)}%`;
  }

  // Add memory pressure information if available
  if (metrics.memory.memoryPressure) {
    const mp = metrics.memory.memoryPressure;
    memoryStats += `\n
  ┌─────────────────────────┐
       🔥 MEMORY PRESSURE     
  └─────────────────────────┘
  
  ▶ Context Switches: ${mp.contextSwitches.toLocaleString()}
  ▶ Interrupts:       ${mp.interrupts.toLocaleString()}
  ▶ Active Ratio:     ${mp.activeRatio.toFixed(2)}%  ${getUsageIndicator(
      mp.activeRatio
    )}`;
  }

  return memoryStats;
}

/**
 * Formats CPU load averages
 */
export function formatLoadAverages(metrics: MetricsData): string {
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
        `▶ Core ${index.toString().padEnd(2)}: ${usage
          .toFixed(2)
          .padEnd(5)}% ${getUsageIndicator(usage)}`
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
  
  CPU usage (${metrics.cpu.usage.toFixed(
    1
  )}%) has exceeded the threshold (${threshold}%)
  
  ▶ Cores:     ${metrics.cpu.cores || "N/A"}
  ▶ Timestamp: ${new Date().toLocaleString()}
  
  ${
    isCritical
      ? "IMMEDIATE ACTION REQUIRED!"
      : "Please investigate when possible."
  }`;
}

/**
 * Formats memory alert messages
 */
export function formatMemoryAlertMessage(
  metrics: MetricsData,
  threshold: number,
  isCritical: boolean
): string {
  const severityEmoji = isCritical ? "🔥" : "⚠️";
  const severityText = isCritical ? "CRITICAL" : "WARNING";

  if (!metrics.memory) {
    return `${severityEmoji} ${severityText}: Memory usage data not available`;
  }

  return `
  ┌─────────────────────────┐
   ${severityEmoji} ${severityText} MEMORY ALERT 
  └─────────────────────────┘
  
  Memory usage (${metrics.memory.percentage.toFixed(
    1
  )}%) has exceeded the threshold (${threshold}%)
  
  ▶ Total:     ${metrics.memory.total.toFixed(2)} GB
  ▶ Used:      ${metrics.memory.used.toFixed(2)} GB
  ${
    metrics.memory.swap
      ? `▶ Swap Used:  ${metrics.memory.swap.used.toFixed(
          2
        )} GB (${metrics.memory.swap.percentage.toFixed(1)}%)`
      : ""
  }
  ▶ Timestamp: ${new Date().toLocaleString()}
  
  ${
    isCritical
      ? "IMMEDIATE ACTION REQUIRED!"
      : "Please investigate when possible."
  }`;
}
