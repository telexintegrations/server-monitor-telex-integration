import { AppConstants, getStoreData } from "../index.js";
import { config } from "dotenv";
config();

// NOTE: this is not used , consider removing it
export function checkIfPackageIsConfiguredAlready() {
  const storeData = getStoreData();

  if (!storeData) {
    return;
  }

  const { outputChannelId } = storeData;

  if (!outputChannelId) {
    return false;
  }

  throw new Error(
    `Package is already configured, if you want to reconfigure it, follow these steps:\n
    1. Run (${AppConstants.PackageCommands.Reset}) to reset the configuration
    2. Run (${AppConstants.PackageCommands.Setup}) to setup the configuration

    Need Help ? run this command (${AppConstants.PackageCommands.Help})
    `
  );
}

export const EnvVariables = {
  NodeEnv: process.env.NODE_ENV,
};

export const isDevEnvironment = ["staging", "dev", "development"].includes(
  EnvVariables.NodeEnv!
);
