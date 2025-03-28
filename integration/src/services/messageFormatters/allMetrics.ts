import { MetricsData } from "../../types/metricType.js";
import { getUsageIndicator } from "../messageFormatters.js";

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
  ▶ Usage: ${memoryPercentage.toFixed(2)}%  ${getUsageIndicator(memoryPercentage)}`;

    // Add swap information if available
    if (metrics.memory.swap) {
      report += `
  == SWAP MEMORY ==
  ▶ Used:  ${metrics.memory.swap.used.toFixed(2)} GB
  ▶ Total: ${metrics.memory.swap.total.toFixed(2)} GB
  ▶ Usage: ${metrics.memory.swap.percentage.toFixed(2)}%  ${getUsageIndicator(metrics.memory.swap.percentage)}`;
    }

    // Add buffer/cache usage if available
    if (metrics.memory.buffer) {
      report += `
  == BUFFER/CACHE ==
  ▶ Used:       ${metrics.memory.buffer.used.toFixed(2)} GB
  ▶ Percentage: ${metrics.memory.buffer.percentage.toFixed(2)}%`;
    }

    // Add memory pressure info if available
    if (metrics.memory.memoryPressure) {
      const mp = metrics.memory.memoryPressure;
      report += `
  == MEMORY PRESSURE ==
  ▶ Context Switches: ${mp.contextSwitches.toLocaleString()}
  ▶ Interrupts:       ${mp.interrupts.toLocaleString()}
  ▶ Active Ratio:     ${mp.activeRatio.toFixed(2)}%  ${getUsageIndicator(mp.activeRatio)}`;
    }
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

  // Add network metrics if available
  if (metrics.networkMetrics) {
    const nm = metrics.networkMetrics;
    report += `

  == NETWORK STATS ==
  ▶ Bandwidth: ↓ ${(nm.bandwidthUsage.received / 1024).toFixed(2)} KB/s, ↑ ${(nm.bandwidthUsage.sent / 1024).toFixed(2)} KB/s
  ▶ Latency: ${nm.latency === -1 ? "Measurement Failed" : `${nm.latency.toFixed(2)} ms`}
  ▶ Packet Loss: ${nm.packetLoss === -1 ? "Measurement Failed" : `${nm.packetLoss.toFixed(2)}%`}
  ▶ Active Connections: ${nm.connectionCount}
  
  == NETWORK INTERFACES ==`;

    // Show interface statistics
    for (const [ifaceName, stats] of Object.entries(nm.interfaceStats)) {
      report += `
  ▶ ${ifaceName}: RX ${(stats.rxBytes / 1024 / 1024).toFixed(2)} MB, TX ${(stats.txBytes / 1024 / 1024).toFixed(2)} MB${stats.errors > 0 ? ` ⚠️ ${stats.errors} errors` : ""}`;
    }
  }

  return report;
}
