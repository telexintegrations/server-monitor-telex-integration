import os from "os";
import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";
import { promises as fs } from "fs";

// Get CPU and memory metrics along with system load metrics
async function getCpuMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const [currentLoad, cpuInfo, processCount] = await Promise.all([
      si.currentLoad(),
      si.cpu(),
      si.processes(),
    ]);

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

    // Read context switches and interrupts from /proc/stat
    const statData = await fs.readFile("/proc/stat", "utf8");
    const lines = statData.split("\n");
    const cpuLine = lines[0].split(" "); // The first line contains CPU stats
    const contextSwitches = cpuLine[3]; // 4th value in the line (index 3)
    const interrupts = cpuLine[4]; // 5th value in the line (index 4)

    const processQueueLength = processCount.all;

    return {
      cpu: {
        usage: currentLoad.currentLoad,
        cores: cpuInfo.cores,
        load_avg: [currentLoad.avgLoad],
      },
      cpuLoadAvgs: normalizedLoad,
      memory: memData,
      cpuLoadMetrics: {
        process_queue_length: processQueueLength,
        context_switches: parseInt(contextSwitches, 10),
        interrupts: parseInt(interrupts, 10),
      },
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
