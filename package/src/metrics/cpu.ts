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

    let contextSwitches = 0;
    let interrupts = 0;

    // Cross-platform way to get statistics
    if (process.platform === "linux") {
      // Linux-specific code using /proc/stat
      try {
        const statData = await fs.readFile("/proc/stat", "utf8");
        const lines = statData.split("\n");

        for (const line of lines) {
          if (line.startsWith("intr")) {
            interrupts = parseInt(line.split(/\s+/)[1], 10);
          } else if (line.startsWith("ctxt")) {
            contextSwitches = parseInt(line.split(/\s+/)[1], 10);
          }
        }
      } catch (error) {
        logger.warn("Could not read /proc/stat, using fallback values");
      }
    } else {
      // For non-Linux systems (macOS, Windows)
      // Use systeminformation's alternative methods or set to 0 if unavailable
      const stats = await si.currentLoad();
      contextSwitches = stats.currentLoad || 0; // This is an approximation
      interrupts = 0; // Not directly available on macOS
    }

    // Process queue length is best estimated by the 1-minute load average
    const processQueueLength = loadAverages[0];

    return {
      cpu: {
        usage: currentLoad.currentLoad,
        cores: cpuInfo.cores,
        load_avg: [currentLoad.avgLoad],
        process_queue_length: processQueueLength,
        context_switches: contextSwitches,
        interrupts: interrupts,
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
