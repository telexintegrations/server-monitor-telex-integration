import {
  MetricsData,
  MetricReplyType,
  IFormatMetricResponseOptions,
} from "../types/metricType.js";
import {
  formatAllMetrics,
  formatCpuAlertMessage,
  formatMemoryAlertMessage,
  formatSecurityAlertMessage,
  formatCpuUsagePerCoreMetrics,
  formatDiskMetrics,
  formatLoadAverages,
  formatMemoryMetrics,
  formatMetricsMessage,
  formatNetworkMetrics,
  formatProcessMetrics,
  formatSecurityMetrics, // From dev
} from "./messageFormatters/index.js";

/**
 * Returns a visual indicator based on usage percentage
 */
export function getUsageIndicator(usage: number): string {
  if (usage >= 90) return "🔴 High";
  if (usage >= 70) return "🟠 Moderate";
  return "🟢 Normal";
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
      return formatLoadAverages(metrics);
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
    case MetricReplyType.getNetworkMetrics:
      return formatNetworkMetrics(metrics);
    case MetricReplyType.getSecurityMetrics:
      return formatSecurityMetrics(metrics);
    case MetricReplyType.cpuThresholdAlert:
      return formatCpuAlertMessage(
        metrics,
        options.cpuThreshold,
        options.isCritical
      );
    case MetricReplyType.memoryThresholdAlert:
      return formatMemoryAlertMessage(
        metrics,
        options.memoryThreshold || 90,
        options.isCritical
      );
    case MetricReplyType.securityAlert:
      return formatSecurityAlertMessage(
        metrics,
        options.securityAlerts || ["Security issue detected"],
        options.isCritical
      );

    default:
      return formatMetricsMessage(metrics);
  }
}
