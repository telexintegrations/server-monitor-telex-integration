import { MetricsData } from "../../types/metricType.js";

/**
 * Formats network metrics if available
 */
function formatNetworkMetrics(metrics: MetricsData): string {
  const nm = metrics.networkMetrics;
  if (!nm) return "";

  const timestamp = new Date(nm.timestamp).toLocaleString();
  const bandwidthLast =
    nm.bandwidthUsage.lastMeasurement === 0
      ? "N/A (First Measurement)"
      : new Date(nm.bandwidthUsage.lastMeasurement).toLocaleString();

  const packetLossDisplay =
    nm.packetLoss === -1
      ? "Measurement Failed"
      : `${nm.packetLoss.toFixed(2)}%`;
  const latencyDisplay =
    nm.latency === -1 ? "Measurement Failed" : `${nm.latency.toFixed(2)} ms`;
  let output = `
  ┌─────────────────────────┐
       🌐 NETWORK METRICS     
  └─────────────────────────┘
  
  == NETWORK SUMMARY ==
  ▶ Last Measurement: ${timestamp}
  ▶ Bandwidth Last Measured: ${bandwidthLast}
  ▶ Bandwidth Received: ${(nm.bandwidthUsage.received / 1024).toFixed(2)} KB/s
  ▶ Bandwidth Sent: ${(nm.bandwidthUsage.sent / 1024).toFixed(2)} KB/s
  ▶ Latency: ${latencyDisplay}
  ▶ Packet Loss: ${packetLossDisplay}%
  ▶ Active Connections: ${nm.connectionCount}
  
  == INTERFACE STATISTICS ==`;

  // Format each network interface
  for (const [ifaceName, stats] of Object.entries(nm.interfaceStats)) {
    output += `
  Interface: ${ifaceName}
  ▶ RX Bytes: ${(stats.rxBytes / 1024 / 1024).toFixed(2)} MB
  ▶ TX Bytes: ${(stats.txBytes / 1024 / 1024).toFixed(2)} MB
  ▶ Errors: ${stats.errors}${stats.errors > 0 ? " ⚠️" : ""}
  `;
  }

  return output;
}

export { formatNetworkMetrics };
