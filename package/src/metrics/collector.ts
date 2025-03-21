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
  cpuLoadAvgs?: {
    "1min": number;
    "5mins": number;
    "15mins": number;
  };
  cpuUsagePerCore?: number[]; // array of cores usage in percentage
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Get all CPU metrics
async function getCpuMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const [currentLoad, cpuInfo] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
    ]);

    const load = await si.currentLoad();

    // CPU Load average
    const loadAverages = os.loadavg();
    const numCores = cpuInfo.cores;

    const normalizedLoad = {
      "1min": (loadAverages[0] / numCores) * 100,
      "5mins": (loadAverages[1] / numCores) * 100,
      "15mins": (loadAverages[2] / numCores) * 100,
    };

    // CPU memory
    const mem = await si.mem();
    const usedGB = mem.used / 1024 ** 3; // Convert to GB
    const totalGB = mem.total / 1024 ** 3;
    const percentUsed = (mem.used / mem.total) * 100;

    const memData = {
      used: usedGB,
      total: totalGB,
      percentage: percentUsed,
    };

    return {
      cpu: {
        usage: currentLoad.currentLoad,
        cores: cpuInfo.cores,
        load_avg: [load.avgLoad],
      },
      cpuLoadAvgs: normalizedLoad,
      memory: memData,
    };
  } catch (error) {
    logger.error(`Failed to get CPU metrics: ${(error as Error).message}`);
    throw error;
  }
}

async function getCpuUsagePerCoreMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const cl = await si.currentLoad();
    const cpus = cl.cpus;
    const coresLoad = cpus.map((cpu) => cpu.load);
    return { cpuUsagePerCore: coresLoad };
  } catch (error) {
    logger.error(
      `Failed to get CPU usage per core: ${(error as Error).message}`
    );
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
  const { cpu, cpuLoadAvgs, memory } = await getCpuMetrics();
  const { cpuUsagePerCore } = await getCpuUsagePerCoreMetrics();

  return {
    cpu,
    cpuLoadAvgs,
    memory,
    cpuUsagePerCore,
  };
};

export const CollectorService = {
  getMetrics,
  getFormattedCpuMetrics,
  getCpuUsagePerCoreMetrics,
};
