import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

/**
 * Get detailed memory metrics including swap, page faults, buffer/cache and memory pressure
 */
export async function getMemoryMetrics(): Promise<Partial<IMetricsData>> {
  try {
    // Get basic memory information
    const memData = await si.mem();

    // Get memory swap information
    const swapData = await si.memLayout();

    // Get process data to calculate pressure
    const processData = await si.processes();

    // Calculate memory percentage
    const usedGB = memData.used / 1024 ** 3; // Convert to GB
    const totalGB = memData.total / 1024 ** 3;
    const percentUsed = (memData.used / memData.total) * 100;

    // Calculate swap metrics
    const swapUsedGB = memData.swapused / 1024 ** 3; // Convert to GB
    const swapTotalGB = memData.swaptotal / 1024 ** 3;
    const swapPercentUsed =
      memData.swaptotal > 0 ? (memData.swapused / memData.swaptotal) * 100 : 0;

    // Calculate buffer/cache usage
    const bufferUsedGB = memData.buffcache / 1024 ** 3;
    const bufferPercentUsed = (memData.buffcache / memData.total) * 100;

    // Calculate memory pressure metrics using alternative metrics
    const memoryPressure = {
      // Use process count as proxy for context switches
      contextSwitches: processData.all || 0,
      // Use running processes as proxy for interrupts
      interrupts: processData.running || 0,
      // Active vs available memory ratio (higher is worse)
      activeRatio: (memData.active / memData.available) * 100,
    };

    // Build expanded memory metrics
    const expandedMemData = {
      used: usedGB,
      total: totalGB,
      percentage: percentUsed,
      // Extended metrics
      swap: {
        used: swapUsedGB,
        total: swapTotalGB,
        percentage: swapPercentUsed,
      },
      buffer: {
        used: bufferUsedGB,
        percentage: bufferPercentUsed,
      },
      pageFaults: {
        // These values would need a custom listener to track over time
        // This is a placeholder for implementation
        pageFaults: -1, // will be implemented via monitoring over time
        majorPageFaults: -1,
        minorPageFaults: -1,
      },
      memoryPressure: memoryPressure,
    };

    return {
      memory: expandedMemData,
    };
  } catch (error) {
    logger.error(
      `Failed to get enhanced memory metrics: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Check if memory usage exceeds the custom threshold
 * @param memoryPercentage Current memory usage percentage
 * @param threshold Custom threshold percentage (default: 90)
 * @returns Object with exceeded flag and severity level
 */
export function checkMemoryThreshold(
  memoryPercentage: number,
  threshold: number = 90
): { exceeded: boolean; isCritical: boolean } {
  const warningThreshold = threshold * 0.8; // 80% of threshold is warning level

  return {
    exceeded: memoryPercentage >= warningThreshold,
    isCritical: memoryPercentage >= threshold,
  };
}
