#!/usr/bin/env node

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import fs from "fs";
import {
  AppConstants,
  clearStore,
  saveStoreData,
  startAllIntervalMonitoring,
  stopAllIntervalMonitoring,
} from "../index.js";
import chalk from "chalk";
import ora from "ora";

// Add this new utility function
function displayIntegrationHeader() {
  const art = `
  ████████╗███████╗██╗     ███████╗██╗  ██╗
  ╚══██╔══╝██╔════╝██║     ██╔════╝╚██╗██╔╝
     ██║   █████╗  ██║     █████╗   ╚███╔╝ 
     ██║   ██╔══╝  ██║     ██╔══╝   ██╔██╗ 
     ██║   ███████╗███████╗███████╗██╔╝ ██╗
     ╚═╝   ╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
  `;

  console.log(chalk.blueBright(art));
  console.log(
    chalk.whiteBright.bold(
      `  Telex Server Monitor ${AppConstants.Package.Version}\n`
    )
  );
}

// Create the CLI program
const program = new Command();

// Modify the preAction hook to use async/await
program.hook("preAction", async (thisCommand) => {
  displayIntegrationHeader();
  const spinner = ora({
    text: `Initializing ${chalk.blueBright("Telex Server Monitor")}\n`,
    spinner: "dots",
    color: "blue",
  }).start();

  // Wait for 1 second using a Promise
  await new Promise((resolve) => setTimeout(resolve, 1000));
  spinner.succeed("Ready!\n");
});

// Set up program metadata
program
  .name("telex-server-monitor")
  .description("Server monitoring agent that integrates with Telex platform")
  .version(AppConstants.Package.Version);

// Setup command
program
  .command("setup")
  .description("Set up the Telex Server Monitor")
  .option(
    "--channel-id <id>",
    "Channel ID to use for monitoring communications"
  )
  .action(async (options: { channelId?: string }) => {
    try {
      // Create the base directory if it doesn't exist
      if (!fs.existsSync(AppConstants.Package.BaseDir)) {
        fs.mkdirSync(AppConstants.Package.BaseDir, { recursive: true });
      }

      // Create the logs directory if it doesn't exist
      if (!fs.existsSync(AppConstants.Package.LogsDir)) {
        fs.mkdirSync(AppConstants.Package.LogsDir, { recursive: true });
      }

      // Save the channel ID if provided
      if (options.channelId) {
        saveStoreData({
          outputChannelId: options.channelId,
        });
        logger.info(`Channel ID set to: ${options.channelId}`);
      }

      logger.info("Setup successful!.");
      logger.info(
        "You can now start monitoring with: telex-server-monitor start"
      );
    } catch (error) {
      logger.error(`Setup failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Start command
program
  .command("start")
  .description("Start the monitoring service to listen for commands")
  .action(async () => {
    try {
      logger.info("Starting Telex Server Monitor...");

      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        logger.info("\nReceived SIGINT (Ctrl+C). Cleaning up...");
        stopAllIntervalMonitoring();
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        logger.info("Received SIGTERM. Cleaning up...");
        stopAllIntervalMonitoring();
        process.exit(0);
      });

      // Start all monitoring processes
      startAllIntervalMonitoring();
      logger.info("Monitoring started successfully. Press Ctrl+C to stop.");
    } catch (error) {
      logger.error(`Failed to start monitoring: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Stop command
program
  .command("stop")
  .description("Stop the monitoring service")
  .action(async () => {
    try {
      logger.info("Stopping Telex Server Monitor...");
      stopAllIntervalMonitoring();
      logger.info("Monitoring stopped successfully.");
    } catch (error) {
      logger.error(`Failed to stop monitoring: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description(
    "Check the status of the monitoring service and show CPU metrics"
  )
  .action(async () => {
    try {
      logger.info("Monitoring is currently running");
    } catch (error) {
      logger.error(`Failed to check status: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Reset command
program
  .command("reset")
  .description("Reset all configuration and stop monitoring")
  .action(async () => {
    try {
      clearStore();
      logger.info("All configuration has been reset");
    } catch (error) {
      logger.error(
        `Failed to reset configuration: ${(error as Error).message}`
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
