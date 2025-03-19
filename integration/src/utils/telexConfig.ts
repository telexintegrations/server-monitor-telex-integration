import { integrationEnvConfig } from "./config.js";

const url = integrationEnvConfig.hostUrl;

export const telexGeneratedConfig = {
  data: {
    date: {
      created_at: "2025-03-11",
      updated_at: "2025-03-11",
    },
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
        required: true,
        default: "* * * * *",
      },
      {
        label: "cpu_threshold",
        type: "number",
        required: true,
        default: 80,
      },
    ],
    endpoints: [],
    is_active: true,
    author: "JC CODER",
    version: "1.0.0",
  },
};
