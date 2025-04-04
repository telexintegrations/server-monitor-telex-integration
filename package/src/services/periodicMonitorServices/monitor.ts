import { logger } from "../../utils/logger.js";
import "./cpuMonitor.js";
import { startCpuMonitoring } from "./cpuMonitor.js";
import { startLogMonitor } from "./logMonitor.js";
import { startMemoryMonitoring } from "./memoryMonitor.js";
import { startSecurityMonitoring } from "./securityMonitor.js";

// Track monitoring intervals
let monitoringIntervals: NodeJS.Timeout[] = [];
let isMonitoringRunning = false;

export const startAllIntervalMonitoring = async () => {
  if (isMonitoringRunning) {
    logger.warn("Monitoring processes are already running.");
    return;
  }

  logger.info("Starting all monitoring processes...");
  const cpuTimer = await startCpuMonitoring();
  const memoryTimer = await startMemoryMonitoring();
  const securityTimer = await startSecurityMonitoring();
  const logTimer = await startLogMonitor();

  monitoringIntervals.push(cpuTimer, memoryTimer, securityTimer, logTimer);
  isMonitoringRunning = true;
  logger.info("All monitoring processes started");
};

export const stopAllIntervalMonitoring = () => {
  logger.info("Stopping all monitoring processes...");
  monitoringIntervals.forEach((interval) => {
    clearInterval(interval);
  });
  monitoringIntervals = [];
  isMonitoringRunning = false;
  logger.info("All monitoring processes stopped");
};
