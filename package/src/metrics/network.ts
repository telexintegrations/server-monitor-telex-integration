import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type NetworkMetrics = IMetricsData["networkMetrics"];

class NetworkMonitor {
  private lastMeasurement: {
    [key: string]: { rx: number; tx: number; time: number };
  } = {};

  async networkMetrics(): Promise<Partial<IMetricsData>> {
    try {
      const metrics: NetworkMetrics = {
        timestamp: Date.now(),
        bandwidthUsage: { received: 0, sent: 0, lastMeasurement: 0 },
        latency: 0,
        packetLoss: 0,
        interfaceStats: {},
        connectionCount: 0,
      };

      // Get all metrics concurrently
      await Promise.all([
        this.getInterfaceStats(metrics),
        this.getNetworkQuality(metrics),
        this.getConnectionCount(metrics),
      ]);

      return { networkMetrics: metrics };
    } catch (error) {
      console.error("Error collecting network metrics:", error);

      logger.error(
        `Failed to get all network metrics: ${(error as Error).message}`
      );
      throw error;
    }
  }

  private async getInterfaceStats(metrics: NetworkMetrics): Promise<void> {
    const interfacesData = await si.networkInterfaces();
    const stats = await si.networkStats();
    // Ensure interfaces is always an array
    const interfaces = Array.isArray(interfacesData)
      ? interfacesData
      : [interfacesData];

    let earliestLastTime = metrics!.timestamp;
    for (const stat of stats) {
      const iface = interfaces.find((i) => i.iface === stat.iface);
      if (!iface) continue;

      const rxBytes = stat.rx_bytes; // received bytes (download)
      const txBytes = stat.tx_bytes; // transferred bytes (upload)
      const errors = stat.rx_errors + stat.tx_errors;

      metrics!.interfaceStats[stat.iface] = {
        rxBytes,
        txBytes,
        errors,
      };

      // Calculate bandwidth
      const now = Date.now();
      const last = this.lastMeasurement[stat.iface] || {
        rx: rxBytes,
        tx: txBytes,
        time: now,
      };

      const timeDiff = (now - last.time) / 1000;
      if (timeDiff > 0) {
        metrics!.bandwidthUsage.received += (rxBytes - last.rx) / timeDiff;
        metrics!.bandwidthUsage.sent += (txBytes - last.tx) / timeDiff;

        // Track the earliest last measurement time across all interfaces
        earliestLastTime = Math.min(earliestLastTime, last.time);
      }

      this.lastMeasurement[stat.iface] = {
        rx: rxBytes,
        tx: txBytes,
        time: now,
      };
    }
    // Set the last measurement timestamp for bandwidth
    metrics!.bandwidthUsage.lastMeasurement =
      earliestLastTime === metrics!.timestamp ? 0 : earliestLastTime;
  }

  private async getNetworkQuality(metrics: NetworkMetrics): Promise<void> {
    try {
      // Use ping for precise packet loss and latency measurement
      const { stdout } = await execAsync("ping -c 10 -i 0.2 8.8.8.8"); // 10 pings, 0.2s interval
      const lines = stdout.split("\n");
      // Extract latency (average from ping)
      const timeLine = lines.find((line) => line.includes("rtt min/avg/max"));
      if (timeLine) {
        const match = timeLine.match(/\/(\d+\.\d+)\//);
        if (match) metrics!.latency = parseFloat(match[1]);
      }

      // Extract packet loss
      const lossLine = lines.find((line) => line.includes("packet loss"));
      if (lossLine) {
        const match = lossLine.match(/(\d+\.\d+|\d+)% packet loss/);
        if (match) metrics!.packetLoss = parseFloat(match[1]);
      }
    } catch (error) {
      console.warn("Failed to measure network quality:", error);
      metrics!.packetLoss = -1; // Indicate failure
      metrics!.latency = -1;
      logger.error(
        `Failed to measure network quality: ${(error as Error).message}`
      );
    }
  }

  private async getConnectionCount(metrics: NetworkMetrics): Promise<void> {
    const connections = await si.networkConnections();
    metrics!.connectionCount = connections.filter(
      (conn) => conn.state === "ESTABLISHED" || conn.state === "LISTENING"
    ).length;
  }
}

const monitor = new NetworkMonitor();

async function getNetworkMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const metrics = await monitor.networkMetrics();
    return metrics;
  } catch (error) {
    console.error("Monitoring failed:", error);
    logger.error(`Failed to get network metrics: ${(error as Error).message}`);
    throw error;
  }
}

export { getNetworkMetrics };
