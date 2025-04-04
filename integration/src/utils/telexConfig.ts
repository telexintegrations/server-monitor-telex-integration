import { integrationEnvConfig } from "./config.js";

const url = integrationEnvConfig.hostUrl;

export const telexGeneratedConfig = {
  data: {
    date: {
      created_at: "2025-03-11",
      updated_at: "2025-03-11",
    },
    bot: true,
    integration_category: "AI & Machine Learning",
    integration_type: "interval",
    descriptions: {
      app_name: integrationEnvConfig.integrationName,
      app_description:
        "A server monitoring agent that integrates with the Telex platform to track system metrics, detect issues, and send alerts",
      app_logo:
        "https://res.cloudinary.com/devsource/image/upload/v1737510989/pngtree-no-cursing-sign-png-image_6610915_meqkww.png",
      app_url: url,
      background_color: "#4A90E2",
    },
    target_url: `${url}/webhook`,
    tick_url: `${url}/tick`,
    key_features: [
      "Authentication with Telex for secure token management",
      "Real-time system metrics monitoring (CPU, Memory, Disk)",
      "Process and service status tracking",
      "Hardware health monitoring and alerts",
      "OS-level log monitoring and analysis",
      "Real-time alerting via Telex",
      "Structured data collection for AI analysis",
      "Server uptime tracking and reporting",
      "Centralized configuration management",
    ],
    settings: [
      {
        label: "interval",
        type: "text",
        default: "* * * * *",
        description:
          "The interval at which the server will send metrics to the user. The format is a cron expression. For example, '* * * * *' means every minute.",
      },
      {
        label: "enable_interval_metrics_reporting",
        type: "checkbox",
        default: true,
        description:
          "Enable interval metrics reporting to the server. This will send metrics to the server at the specified interval.",
      },
      {
        label: "cpu_threshold",
        type: "number",
        default: 50,
        description:
          "The threshold for CPU usage. If the CPU usage exceeds this threshold, the server will send an alert to the user.",
      },
      {
        label: "memory_threshold",
        type: "number",
        default: 50,
        description:
          "The threshold for memory usage. If the memory usage exceeds this threshold, the server will send an alert to the user.",
      },
      {
        label: "custom_log_path",
        type: "text",
        default: "",
        description:
          "The path to the custom log file to monitor. If this is not set, the server will monitor the default log file.",
      },
    ],
    endpoints: [],
    is_active: true,
    author: "JC CODER",
    version: "1.0.0",
  },
};
