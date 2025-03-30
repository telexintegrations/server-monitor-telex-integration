import fs from "fs";
import { logger } from "./logger.js";
import { AppConstants, ITelexMonitorSettings } from "../index.js";

export interface IStore {
  isMonitoringRunning: boolean;
  serverName: string;
  settings: ITelexMonitorSettings;
  monitorServer: boolean;
  outputFrequency: number; // this is in minutes
  outputChannelId: string;
  cpuThreshold: number; // Added CPU threshold setting
  memoryThreshold: number; // Added Memory threshold setting
  securitySettings: {
    failedLoginThreshold: number; // Maximum number of failed logins before alert
    monitorPortScanning: boolean; // Whether to monitor for port scanning
    monitorFirewall: boolean; // Whether to monitor firewall logs
  };
}

// Ensure store directory exists
function ensureStoreExists(): void {
  if (!fs.existsSync(AppConstants.Package.BaseDir)) {
    fs.mkdirSync(AppConstants.Package.BaseDir, { recursive: true });
  }
}

/**
 * Clear the entire store
 */
export function clearStore(): void {
  try {
    if (fs.existsSync(AppConstants.Package.StoreFile)) {
      fs.unlinkSync(AppConstants.Package.StoreFile);
    }
  } catch (error) {
    logger.error(`Failed to clear store: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Save data to the store
 * @param data The data to save
 */
export function saveStoreData(data: Partial<IStore>): void {
  try {
    ensureStoreExists();

    let store: IStore = {} as IStore;
    if (fs.existsSync(AppConstants.Package.StoreFile)) {
      store = JSON.parse(
        fs.readFileSync(AppConstants.Package.StoreFile, "utf-8")
      ) as IStore;
    }

    // Merge new data with existing store
    const updatedStore = { ...store, ...data };
    fs.writeFileSync(
      AppConstants.Package.StoreFile,
      JSON.stringify(updatedStore, null, 2)
    );
  } catch (error) {
    logger.error(`Failed to save store data: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get data from the store
 * @returns The stored data or undefined if the file does not exist
 */
export function getStoreData(): IStore | undefined {
  try {
    if (!fs.existsSync(AppConstants.Package.StoreFile)) {
      return undefined;
    }

    return JSON.parse(
      fs.readFileSync(AppConstants.Package.StoreFile, "utf-8")
    ) as IStore;
  } catch (error) {
    logger.error(`Failed to read store data: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Update data in the store
 * @param updater The function to update the store
 */
export function updateStoreData(
  updater: (store: IStore) => Partial<IStore>
): void {
  try {
    ensureStoreExists();

    let store: IStore = {} as IStore;
    if (fs.existsSync(AppConstants.Package.StoreFile)) {
      store = JSON.parse(
        fs.readFileSync(AppConstants.Package.StoreFile, "utf-8")
      ) as IStore;
    }

    const updatedData = updater(store);
    const updatedStore = { ...store, ...updatedData };
    fs.writeFileSync(
      AppConstants.Package.StoreFile,
      JSON.stringify(updatedStore, null, 2)
    );
  } catch (error) {
    logger.error(`Failed to update store data: ${(error as Error).message}`);
    throw error;
  }
}
