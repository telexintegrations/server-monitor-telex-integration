import os from "os";
import si from "systeminformation";
import { logger } from "../utils/logger.js";

// Define the metrics data structure
export interface IMetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
  };
  loadAvgs?: {
    "1min": number;
    "5mins": number;
    "15mins": number;
  };
}

/**
 * Get all CPU metrics
 * @returns Promise that resolves to complete CPU metrics
 */
async function getCpuMetrics(): Promise<IMetricsData> {
  try {
    const [currentLoad, cpuInfo] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
    ]);

    const load = await si.currentLoad();
    const loadAverages = os.loadavg();
    const numCores = cpuInfo.cores;
    const normalizedLoad = {
      "1min": (loadAverages[0] / numCores) * 100,
      "5mins": (loadAverages[1] / numCores) * 100,
      "15mins": (loadAverages[2] / numCores) * 100,
    };

    return {
      cpu: {
        usage: currentLoad.currentLoad,
        cores: cpuInfo.cores,
        load_avg: [load.avgLoad],
      },
      loadAvgs: normalizedLoad,
    };
  } catch (error) {
    logger.error(`Failed to get CPU metrics: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get formatted CPU metrics for display
 */
async function getFormattedCpuMetrics(): Promise<string> {
  try {
    const { cpu: cpuMetrics } = await getCpuMetrics();

    if (!cpuMetrics) {
      return "Error: Could not retrieve CPU metrics";
    }

    return `
CPU Usage: ${cpuMetrics.usage.toFixed(2)}%
CPU Cores: ${cpuMetrics.cores || "N/A"}
Load Average: ${cpuMetrics.load_avg?.[0]?.toFixed(2) || "N/A"}
    `.trim();
  } catch (error) {
    logger.error(`Failed to format CPU metrics: ${(error as Error).message}`);
    return "Error fetching CPU metrics";
  }
}

const getMetrics = async (): Promise<IMetricsData> => {
  const { cpu, loadAvgs } = await getCpuMetrics();

  return {
    cpu,
    loadAvgs,
  };
};

export const CollectorService = {
  getMetrics,
  getFormattedCpuMetrics,
};
