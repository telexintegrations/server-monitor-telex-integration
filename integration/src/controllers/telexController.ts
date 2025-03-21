import { Request, Response } from "express";
import { IntegrationConstants, MessageConstant } from "../utils/constant.js";
import { TelexService } from "../services/telexRequest.js";
import { getMetricsFromPackage } from "../services/metricsService.js";
import { MetricType } from "../types/metricType.js";

// Add this helper function at the top of the file after imports
function cleanMessage(message: string): string {
  return message
    .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
    .trim(); // Remove leading/trailing whitespace
}

export async function webhook(req: Request, res: Response) {
  const { channel_id, message, settings } = req.body;
  console.log("new webhook from telex", req.body);

  // Return initial response to telex immediately
  res.status(200).json({ status: "success", message: "Message received" });

  const cleanedMessage = cleanMessage(message);

  // don't do anything if the message is from this integration
  if (cleanedMessage.includes(IntegrationConstants.App.Name)) {
    return;
  }

  // Handle setup command specifically
  if (cleanedMessage === "/setup-monitoring") {
    const installCommand =
      IntegrationConstants.Github.InstallationScriptUrl(channel_id);
    const setupInstructions = `
  🚀 Server Monitoring Setup Guide
  
  Welcome to the Server Monitoring Setup! Let's get your server up and running with our monitoring agent in just a few simple steps.
  
  1. Open Your Server's Terminal
     - Log into your server using SSH or access the terminal directly if you're on the server itself.
  
  2. Run the Installation Command
     - Copy and paste the following command into your terminal:
  \`\`\`
  ${installCommand}
  \`\`\`
     - This command will:
       - Download the installation script from our GitHub repository
       - Automatically install the monitoring agent on your server
       - Configure the agent with your unique channel ID
       - Start the monitoring service
  
  3. Wait for the Installation to Complete
     - The script will run and provide you with status updates. This might take a few minutes depending on your server's speed and internet connection.
  
  4. Verify the Installation
     - Once the script finishes, you should see a confirmation message that the agent is installed and running.
     - You can check the agent's status by running:
  \`\`\`
  systemctl status server-monitor-agent
  \`\`\`
     - If everything is set up correctly, you should see that the service is active and running.
  
  5. Start Receiving Alerts
     - That's it! Your server is now being monitored. You'll start receiving alerts and metrics reports in this Telex channel.
  
  ✨ What's Next?
  - You'll receive periodic updates on your server's health, including CPU usage, memory consumption, and more.
  - If any issues are detected, you'll get immediate notifications to take action.
  
  ❓ Need Help?
  - If you encounter any issues during setup, or if you have questions about the monitoring agent, please visit our documentation at ${IntegrationConstants.Github.Repository}
  - You can also reach out to our support team through the same link.
  
  Thank you for choosing our Server Monitoring service! We're here to help keep your servers running smoothly.
  `;

    // send the setup instructions to the channel
    TelexService.SendWebhookResponse({
      channelId: channel_id,
      message: setupInstructions,
    });

    return;
  }

  if (cleanedMessage === "/cpu") {
    const resp = await getMetricsFromPackage(
      MetricType.getCpuMetrics,
      channel_id,
      settings
    );
    if (!resp) {
      handleMetricError(channel_id);
    }
    return;
  }

  if (cleanedMessage === "/cpuAvg") {
    const resp = await getMetricsFromPackage(
      MetricType.getCpuLoadAverages,
      channel_id,
      settings
    );
    if (!resp) {
      handleMetricError(channel_id);
    }
    return;
  }
}

export async function tick(req: Request, res: Response) {
  const { channel_id, settings } = req.body;
  console.log("new tick from telex", req.body);

  // Return initial response to telex immediately
  res.status(200).json({ status: "success", message: "Message received" });

  // check if the interval metrics reporting is enabled
  const intervalMetricsReporting = settings.find(
    (setting: any) => setting.label === "enable_interval_metrics_reporting"
  );

  if (!intervalMetricsReporting) {
    return;
  }

  const result = await getMetricsFromPackage(
    MetricType.getCpuMetrics,
    channel_id,
    settings
  );

  if (!result) {
    handleMetricError(channel_id);
  }
}

async function handleMetricError(
  channelId: string,
  message = MessageConstant.UnableToGetMetrics
) {
  await TelexService.SendWebhookResponse({
    channelId,
    message,
  });
}
