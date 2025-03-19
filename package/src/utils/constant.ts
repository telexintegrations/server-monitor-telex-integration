import path from "path";
import os from "os";
import { ITelexMonitorSettingsFromTelexApp } from "./interface.js";

const TELEX_API_URL = "https://api.telex.im/api/v1";
const TELEX_MONITOR_DIR = path.join(os.homedir(), ".telex-monitor");
const PACKAGE_NAME = "telex-server-monitor";

export const AppConstants = {
  Package: {
    Version: "v1.1.0",
    BaseDir: TELEX_MONITOR_DIR,
    StoreFile: path.join(TELEX_MONITOR_DIR, "store.json"),
    LogsDir: path.join(TELEX_MONITOR_DIR, "logs"),
    GlobalConfigUrl:
      "https://raw.githubusercontent.com/telexintegrations/server-monitor-telex-integration/refs/heads/dev/global.json",
  },
  Telex: {
    BaseUrl: TELEX_API_URL,
    WebhookUrl: "https://ping.telex.im/v1/webhooks",
    LoginUrl: `${TELEX_API_URL}/auth/login`,
    GetOrganisationIntegrationsUrl: (organisationId: string) => {
      return `${TELEX_API_URL}/organisations/${organisationId}/integrations/custom`;
    },
    GetIntegrationSettingsUrl: (
      organisationId: string,
      integrationId: string
    ) => {
      return `${TELEX_API_URL}/organisations/${organisationId}/integrations/custom/${integrationId}/settings`;
    },
  },
  Timers: {
    AuthTokenExpiryInDays: 2,
  },
  PackageCommands: {
    Setup: `${PACKAGE_NAME} setup`,
    Start: `${PACKAGE_NAME} start`,
    Stop: `${PACKAGE_NAME} stop`,
    Reset: `${PACKAGE_NAME} reset`,
    Help: `${PACKAGE_NAME} help`,
  },
  TelexIntegration: {
    name: "Telex Server Monitor",
    id: "01921436-94ae-7a42-a1ea-37dd98a314f8",
    setupGuide: "https://telex.im/docs/integrations/custom-integrations", // TODO: UPDATE THIS
  },
};

export const TelexMonitorSettingsFromTelexApp: ITelexMonitorSettingsFromTelexApp =
  {
    monitorServer: true,
    outputFrequency: 1,
    outputChannelIds: "01950eec-97c4-7f92-bda8-62c7264209b3",
  };
