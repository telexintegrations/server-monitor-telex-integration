import { zeromqServer } from "./zeromqServer.js";

export interface MetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
  };
  loadAvgs?: {
    "1min": number;
    "5mins": number;
    "15mins": number;
  };
}

export const getMetricsFromPackage = async (
  channelId: string,
  settings: any
) => {
  try {
    await zeromqServer.publish(channelId, {
      type: "getMetrics",
      channelId,
      data: { settings },
      timestamp: dateToISO(),
    });
    return true;
  } catch (error) {
    console.error("Failed to request CPU threshold check: ", error);
    return false;
  }
};

export const getLoadAveragesFromPackage = async (
  channelId: string,
  settings: any
) => {
  try {
    await zeromqServer.publish(channelId, {
      type: "getLoadAverages",
      channelId,
      data: { settings },
      timestamp: dateToISO(),
    });
    return true;
  } catch (error) {
    console.error("Failed to request CPU load average check: ", error);
    return false;
  }
};

function dateToISO() {
  return new Date().toISOString();
}
