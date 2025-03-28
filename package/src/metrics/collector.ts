import os from "os";
import si from "systeminformation";
import { logger } from "../utils/logger.js";
import { getProcessMetrics } from "./processes.js";
import { getDiskMetrics } from "./disk.js";
import { getCpuMetrics, getCpuUsagePerCoreMetrics } from "./cpu.js";
import { getNetworkMetrics } from "./network.js";

// Define the metrics data structure
export interface IMetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
  };
  cpuLoadMetrics?: {
    process_queue_length?: number;
    context_switches?: number;
    interrupts?: number;
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
  processes?: {
    all: number; // total process count
    running: number; // number of running processes
    blocked: number; // number of blocked processes
    sleeping: number; // number of sleeping processes
    unknown: number; // number of processes in unknown state
    zombie: number; // number of zombie processes
    list: Array<{
      pid: number; // process ID
      name: string; // process name
      cpu: number; // process CPU usage percentage
      mem: number; // process memory usage percentage
      priority: number; // process priority
      memVsz: number; // virtual memory size
      memRss: number; // resident set size (RAM)
      state: string; // process state (running, sleeping, etc.)
      user: string; // user who owns the process
      command: string; // command used to start the process
    }>;
  };
  networkMetrics?: {
    timestamp: number;
    bandwidthUsage: {
      received: number; // bytes per second
      sent: number; // bytes per second
      lastMeasurement: number;
    };
    latency: number; // milliseconds
    packetLoss: number; // percentage
    interfaceStats: {
      [interfaceName: string]: {
        rxBytes: number;
        txBytes: number;
        errors: number;
      };
    };
    connectionCount: number;
  };
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
  const { processes } = await getProcessMetrics();
  const { networkMetrics } = await getNetworkMetrics();

  const allMetrics = {
    cpu,
    cpuLoadAvgs,
    memory,
    cpuUsagePerCore,
    disk,
    processes,
    networkMetrics,
  };
  return allMetrics;
};

export const CollectorService = {
  getMetrics,
  getFormattedCpuMetrics,
  getCpuUsagePerCoreMetrics,
  getDiskMetrics,
  getProcessMetrics,
  getNetworkMetrics,
};
