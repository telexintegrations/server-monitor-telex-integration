import si from "systeminformation";
import { exec } from "child_process";
import { promisify } from "util";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

interface InodeStat {
  fs: string;
  inodes: number;
  inodesUsed: number;
  inodesFree: number;
  inodesUsage: number;
}

// Function to get inode stats using df -i command
async function getInodeStats(): Promise<Array<InodeStat>> {
  try {
    const { stdout } = await execAsync("df -i");
    const lines = stdout.split("\n").slice(1); // Ignore the header line

    const inodeStats = lines
      .map((line) => line.split(/\s+/))
      .filter((columns) => columns.length >= 6) // Ensure valid data
      .map((columns) => ({
        fs: columns[0],
        inodes: parseInt(columns[1], 10) || 0,
        inodesUsed: parseInt(columns[2], 10) || 0,
        inodesFree: parseInt(columns[3], 10) || 0,
        inodesUsage: parseFloat(columns[4]) || 0,
      }));

    return inodeStats;
  } catch (error) {
    logger.error(`Failed to get inode stats: ${(error as Error).message}`);
    return [];
  }
}

// Get disk metrics
async function getDiskMetrics(): Promise<Partial<IMetricsData>> {
  try {
    const [fsSize, diskIO, inodeStats] = await Promise.all([
      si.fsSize(),
      si.disksIO(),
      getInodeStats(),
    ]);

    // Merge inode stats with filesystem stats
    const filesystems = fsSize.map((fs) => {
      const inodeStat = inodeStats.find((inode) => inode.fs === fs.fs);

      return {
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount,
        inodes: inodeStat?.inodes || 0,
        inodesUsed: inodeStat?.inodesUsed || 0,
        inodesFree: inodeStat?.inodesFree || 0,
        inodesUsage: inodeStat?.inodesUsage || 0,
      };
    });

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

export { getDiskMetrics };
