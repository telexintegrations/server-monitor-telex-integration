import { MetricType } from "../types/metricType.js";
import {
  IntegrationConstants,
  MessageConstant,
  SetupInstruction,
} from "../utils/constant.js";
import { TelexService } from "./telexRequest.js";
import { zeromqServer } from "./zeromqServer.js";

// publish the metrics request to the zeromq server
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

// process the metrics request based on the agent response, used in the telex controller
export async function metricReq(
  channel_id: string,
  agentResp: string,
  settings: any,
  userMessage?: string
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
        settings,
        userMessage
      );
      break;
    case "cpuLoadAvg":
      await getMetricsFromPackage(
        MetricType.getCpuLoadAverages,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "perCoreUsage":
      await getMetricsFromPackage(
        MetricType.getCpuUsagePerCore,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "memoryStats":
      await getMetricsFromPackage(
        MetricType.getMemoryStats,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "diskMetrics":
      await getMetricsFromPackage(
        MetricType.getDiskMetrics,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "processMetrics":
      await getMetricsFromPackage(
        MetricType.getProcessMetrics,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "networkMetrics":
      await getMetricsFromPackage(
        MetricType.getNetworkMetrics,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "securityMetrics":
      await getMetricsFromPackage(
        MetricType.getSecurityMetrics,
        channel_id,
        settings,
        userMessage
      );
      break;
    case MetricType.getServices:
      await getMetricsFromPackage(
        MetricType.getServices,
        channel_id,
        settings,
        userMessage
      );
      break;
    case "getAllMetrics":
      await getMetricsFromPackage(
        MetricType.getAllMetrics,
        channel_id,
        settings,
        userMessage
      );
      break;
    default:
      // send a processing message to the channel
      await TelexService.SendWebhookResponse({
        channelId: channel_id,
        message:
          "I'm sorry, I don't understand that request. Can you please rephrase your request?",
      });
  }

  return;
}
