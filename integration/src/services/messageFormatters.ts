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

/**
 * Formats process metrics if available
 */
function formatProcessMetrics(metrics: MetricsData): string {
  if (!metrics.processes) {
    return "";
  }

  const { processes } = metrics;

  let output = `
┌─────────────────────────┐
     🔄 PROCESS METRICS     
└─────────────────────────┘

== PROCESS SUMMARY ==
▶ Total Processes: ${processes.all}
▶ Running: ${processes.running}
▶ Sleeping: ${processes.sleeping}
▶ Blocked: ${processes.blocked}
▶ Zombie: ${processes.zombie || 0}${processes.zombie > 0 ? " ⚠️" : ""}
▶ Unknown: ${processes.unknown}

== TOP PROCESSES BY CPU USAGE ==`;

  // Format top processes
  if (processes.list && processes.list.length > 0) {
    processes.list.forEach((proc, index) => {
      output += `
${index + 1}. ${proc.name.substring(0, 15).padEnd(15)} [PID: ${proc.pid}]
   CPU: ${proc.cpu.toFixed(1).padStart(5)}%  MEM: ${proc.mem.toFixed(1).padStart(5)}%  User: ${proc.user || "unknown"}
   State: ${proc.state || "unknown"}  Command: ${(proc.command || "").substring(0, 40)}${proc.command && proc.command.length > 40 ? "..." : ""}`;
    });
  } else {
    output += `\n▶ No process data available`;
  }

  return output;
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
    case MetricReplyType.getDiskMetrics:
      return formatDiskMetrics(metrics);
    case MetricReplyType.getProcessMetrics:
      return formatProcessMetrics(metrics);
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

  // Add disk stats if available
  if (metrics.disk && metrics.disk.filesystems.length) {
    report += `
== DISK USAGE ==`;

    // Only show first 2 filesystems in the summary to avoid cluttering
    const topFilesystems = metrics.disk.filesystems.slice(0, 2);
    topFilesystems.forEach((fs) => {
      report += `
▶ ${fs.mount}: ${fs.use.toFixed(2)}% of ${(fs.size / 1024 / 1024 / 1024).toFixed(2)} GB  ${getUsageIndicator(fs.use)}`;
    });

    if (metrics.disk.filesystems.length > 2) {
      report += `
▶ And ${metrics.disk.filesystems.length - 2} more filesystems`;
    }
  }

  // Add process stats if available
  if (metrics.processes) {
    report += `
== PROCESS STATS ==
▶ Total: ${metrics.processes.all} processes (${metrics.processes.running} running, ${metrics.processes.zombie || 0} zombie${metrics.processes.zombie > 0 ? " ⚠️" : ""})
`;

    // Add top 3 CPU-consuming processes if available
    if (metrics.processes.list && metrics.processes.list.length > 0) {
      report += `▶ Top CPU: `;

      for (let i = 0; i < Math.min(3, metrics.processes.list.length); i++) {
        const proc = metrics.processes.list[i];
        if (i > 0) report += ", ";
        report += `${proc.name} (${proc.cpu.toFixed(1)}%)`;
      }
    }
  }

  return report;
}
