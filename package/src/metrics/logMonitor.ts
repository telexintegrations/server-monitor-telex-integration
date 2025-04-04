import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as os from "os";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export type LogMetrics = IMetricsData["logMetrics"];

class LogMonitor {
  private customLogPath: string | null = null;
  private patterns: RegExp[] = [];
  private lastCustomCheck: number = 0;

  constructor(customLogPath?: string, patterns?: string[]) {
    this.customLogPath = customLogPath || null;
    this.patterns = patterns
      ? patterns.map((p) => new RegExp(p, "i"))
      : [new RegExp("error", "i"), new RegExp("fail", "i")];
  }

  async logMetrics(): Promise<Partial<IMetricsData>> {
    const metrics: LogMetrics = {
      timestamp: Date.now(),
      systemErrors: [],
      customLogEntries: [],
    };

    await Promise.all([
      this.getSystemErrors(metrics),
      this.getCustomLogEntries(metrics),
    ]);

    return { logMetrics: metrics };
  }

  private async getSystemErrors(metrics: LogMetrics): Promise<void> {
    try {
      let errors: string[] = [];
      if (os.platform() === "win32") {
        const { stdout } = await execAsync(
          'wevtutil qe System /c:10 /rd:true /f:text | findstr "Error"'
        );
        errors = stdout
          .split("\n")
          .filter((line) => line.trim() && this.matchesPattern(line));
      } else {
        const { stdout } = await execAsync(
          'journalctl -p 3 -n 10 --since="1 hour ago"'
        );
        errors = stdout
          .split("\n")
          .filter((line) => line.trim() && this.matchesPattern(line));
      }
      metrics!.systemErrors = errors.map((line) => ({
        timestamp: this.extractTimestamp(line) || new Date().toLocaleString(),
        message: line,
      }));
    } catch (error) {
      console.warn("Failed to fetch system errors:", error);
    }
  }

  private async getCustomLogEntries(metrics: LogMetrics): Promise<void> {
    if (!this.customLogPath) return;

    try {
      const stats = await fs.stat(this.customLogPath);
      const lastModified = stats.mtimeMs;
      if (lastModified <= this.lastCustomCheck) return;

      const content = await fs.readFile(this.customLogPath, "utf8");
      const lines = content.split("\n").slice(-50); // Last 50 lines
      metrics!.customLogEntries = lines
        .filter((line) => line.trim() && this.matchesPattern(line))
        .map((line) => ({
          timestamp: this.extractTimestamp(line) || new Date().toLocaleString(),
          message: line,
        }))
        .slice(-10); // Last 10 matching lines
      this.lastCustomCheck = lastModified;
    } catch (error) {
      console.warn(
        `Failed to read custom log at ${this.customLogPath}:`,
        error
      );
    }
  }

  private matchesPattern(line: string): boolean {
    return this.patterns.some((pattern) => pattern.test(line));
  }

  private extractTimestamp(line: string): string | null {
    // Simple regex for common timestamp formats (e.g., "2025-03-28 14:30:45")
    const match = line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    return match ? match[0] : null;
  }

  // Method to update custom log path or patterns dynamically
  setCustomLogPath(path: string) {
    this.customLogPath = path;
    this.lastCustomCheck = 0; // Reset to force re-read
  }

  setPatterns(patterns: string[]) {
    this.patterns = patterns.map((p) => new RegExp(p, "i"));
  }
}

export const logMonitor = new LogMonitor();

export async function getLogMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const metrics = await logMonitor.logMetrics();
    return metrics;
  } catch (error) {
    console.error("Monitoring failed:", error);
    logger.error(`Failed to get network metrics: ${(error as Error).message}`);
    throw error;
  }
}
