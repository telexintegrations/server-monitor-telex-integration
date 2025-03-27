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
  disk?: {
    filesystems: Array<{
      fs: string; // file system
      type: string; // type of file system
      size: number; // size in bytes
      used: number; // used in bytes
      available: number; // available in bytes
      use: number; // used in %
      mount: string; // mount point
    }>;
    io?: {
      rIO: number; // read I/O operations
      wIO: number; // write I/O operations
      tIO: number; // total I/O operations
      rWaitTime: number; // read wait time in ms
      wWaitTime: number; // write wait time in ms
      tWaitTime: number; // total wait time in ms
      rPerSec: number; // reads per second
      wPerSec: number; // writes per second
    };
  };
}

// get cpu and memory metrics
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

// get the cpu usage per core
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

// get disk metrics
async function getDiskMetrics(): Promise<Partial<IMetricsData>> {
  try {
    // Get file system information
    const fsSize = await si.fsSize();

    // Get disk I/O information
    const diskIO = await si.disksIO();

    // Format the disk information
    const filesystems = fsSize.map((fs) => ({
      fs: fs.fs,
      type: fs.type,
      size: fs.size,
      used: fs.used,
      available: fs.available,
      use: fs.use,
      mount: fs.mount,
    }));

    // Format the I/O information
    // Note: diskIO returns data for all disks combined
    const io = {
      rIO: diskIO.rIO || 0,
      wIO: diskIO.wIO || 0,
      tIO: diskIO.tIO || 0,
      rWaitTime: diskIO.rWaitTime || 0,
      wWaitTime: diskIO.wWaitTime || 0,
      tWaitTime: diskIO.tWaitTime || 0,
      rPerSec: diskIO.rIO_sec || 0,
      wPerSec: diskIO.wIO_sec || 0,
    };

    return {
      disk: {
        filesystems,
        io,
      },
    };
  } catch (error) {
    logger.error(`Failed to get disk metrics: ${(error as Error).message}`);
    throw error;
  }
}

// get the formatted cpu metrics
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

// get all metrics
const getMetrics = async (): Promise<IMetricsData> => {
  const { cpu, cpuLoadAvgs, memory } = await getCpuMetrics();
  const { cpuUsagePerCore } = await getCpuUsagePerCoreMetrics();
  const { disk } = await getDiskMetrics();

  const allMetrics = {
    cpu,
    cpuLoadAvgs,
    memory,
    cpuUsagePerCore,
    disk,
  };
  return allMetrics;
};

export const CollectorService = {
  getMetrics,
  getFormattedCpuMetrics,
  getCpuUsagePerCoreMetrics,
  getDiskMetrics,
};
