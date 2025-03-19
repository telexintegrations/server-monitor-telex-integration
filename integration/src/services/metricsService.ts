import { MetricType } from "../types/metricType.js";
import { zeromqServer } from "./zeromqServer.js";

export const getMetricsFromPackage = async (
  type: MetricType,
  channelId: string,
  settings: any
) => {
  try {
    await zeromqServer.publish(channelId, {
      type: type,
      channelId,
      data: { settings },
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Failed to request CPU threshold check: ", error);
    return false;
  }
};
