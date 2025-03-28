import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

// get process metrics
async function getProcessMetrics(): Promise<Partial<IMetricsData>> {
  try {
    // Get process information
    const processes = await si.processes();

    // Get the top 10 processes by CPU usage
    const topProcessesByCpu = [...processes.list]
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 10)
      .map((proc) => ({
        pid: proc.pid,
        name: proc.name,
        cpu: proc.cpu,
        mem: proc.mem,
        priority: proc.priority,
        memVsz: proc.memVsz,
        memRss: proc.memRss,
        state: proc.state,
        user: proc.user,
        command: proc.command,
      }));

    // Process state counts
    const stateCount = {
      running: 0,
      sleeping: 0,
      blocked: 0,
      zombie: 0,
      unknown: 0,
    };

    // Count process states
    processes.list.forEach((proc) => {
      const state = proc.state.toLowerCase();
      if (state.includes("running")) {
        stateCount.running++;
      } else if (state.includes("sleep")) {
        stateCount.sleeping++;
      } else if (state.includes("blocked") || state.includes("wait")) {
        stateCount.blocked++;
      } else if (state.includes("zombie")) {
        stateCount.zombie++;
      } else {
        stateCount.unknown++;
      }
    });

    return {
      processes: {
        all: processes.all,
        running: stateCount.running,
        blocked: stateCount.blocked,
        sleeping: stateCount.sleeping,
        unknown: stateCount.unknown,
        zombie: stateCount.zombie,
        list: topProcessesByCpu,
      },
    };
  } catch (error) {
    logger.error(`Failed to get process metrics: ${(error as Error).message}`);
    throw error;
  }
}

export { getProcessMetrics };
