import { MetricType } from "../types/metricType.js";
import {
  IntegrationConstants,
  MessageConstant,
  SetupInstruction,
} from "../utils/constant.js";
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

export async function metricReq(
  channel_id: string,
  agentResp: string,
  settings: any
) {
  switch (agentResp) {
    case "setup-monitoring":
      const installCommand =
        IntegrationConstants.Github.InstallationScriptUrl(channel_id);

      // send the setup instructions to the channel
      TelexService.SendWebhookResponse({
        channelId: channel_id,
        message: SetupInstruction(installCommand),
      });
      break;
    case "cpu":
      await getMetricsFromPackage(
        MetricType.getCpuMetrics,
        channel_id,
        settings
      );
      break;
    case "cpuLoadAvg":
      await getMetricsFromPackage(
        MetricType.getCpuLoadAverages,
        channel_id,
        settings
      );
      break;
    case "perCoreUsage":
      await getMetricsFromPackage(
        MetricType.getCpuUsagePerCore,
        channel_id,
        settings
      );
      break;
    case "memoryStats":
      await getMetricsFromPackage(
        MetricType.getMemoryStats,
        channel_id,
        settings
      );
      break;
    default:
      await processMessage(channel_id, agentResp);
  }
  return;
}

async function processMessage(channel_id: string, message = "Processing...") {
  await TelexService.SendWebhookResponse({
    channelId: channel_id,
    message,
  });
}
