import { MetricsData } from "../../types/metricType.js";

/**
 * Formats service metrics if available
 */
function formatServiceMetrics(metrics: MetricsData): string {
  if (!metrics.services) {
    return "";
  }

  const services = metrics.services;
  const statusIndicator = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
      case "active":
        return "🟢";
      case "failed":
        return "🔴";
      case "stopped":
        return "⚫";
      default:
        return "⚪";
    }
  };

  let output = `
┌─────────────────────────┐
     🔧 SERVICE METRICS     
└─────────────────────────┘

== SERVICE SUMMARY ==
▶ Total Services: ${services.all}
▶ Running: ${services.running}
▶ Stopped: ${services.stopped}
▶ Failed: ${services.failed}${services.failed > 0 ? " ⚠️" : ""}

== SERVICE DETAILS ==`;

  // Show service details
  services.list.forEach((service) => {
    const memoryStr = service.memory
      ? ` | Memory: ${(service.memory / 1024 / 1024).toFixed(2)} MB`
      : "";
    const cpuStr = service.cpu ? ` | CPU: ${service.cpu.toFixed(1)}%` : "";
    const uptimeStr = service.uptime
      ? ` | Uptime: ${formatUptime(service.uptime)}`
      : "";

    output += `
${statusIndicator(service.status)} ${service.name}
   Status: ${service.status}${memoryStr}${cpuStr}${uptimeStr}`;

    // Add description if available
    if (service.description) {
      output += `
   Description: ${service.description}`;
    }

    // Add dependencies if any
    if (service.dependencies && service.dependencies.length > 0) {
      output += `
   Dependencies: ${service.dependencies.join(", ")}`;
    }
  });

  // Add last updated time
  output += `

Last updated: ${new Date(services.lastUpdated).toLocaleString()}`;

  return output;
}

/**
 * Format uptime duration in a human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

export { formatServiceMetrics };
