import { MetricType } from "../types/metricType.js";
import { MessageConstant } from "../utils/constant.js";
import { TelexService } from "./telexRequest.js";
import { zeromqServer } from "./zeromqServer.js";

export const getMetricsFromPackage = async (
  type: MetricType,
  channelId: string,
  settings: any,
  userMessage?: string
) => {
  try {
    await zeromqServer.publish(channelId, {
      type: type,
      channelId,
      data: { settings, userMessage },
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Failed to request CPU threshold check: ", error);
    await TelexService.SendWebhookResponse({
      channelId,
      message: MessageConstant.UnableToGetMetrics,
    });
    return false;
  }
};
