import si from "systeminformation";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

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

export { getDiskMetrics };
