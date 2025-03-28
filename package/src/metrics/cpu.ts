import os from "os";
import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";
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

export { getCpuMetrics, getCpuUsagePerCoreMetrics };
