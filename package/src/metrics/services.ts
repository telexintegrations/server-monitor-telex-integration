import { exec } from "child_process";
import { promisify } from "util";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";
import si from "systeminformation";

const execAsync = promisify(exec);

interface ServiceInfo {
  name: string;
  status: string;
  pid?: number;
  memory?: number;
  cpu?: number;
  uptime: number;
  dependencies: string[];
  description?: string;
  startTime?: string;
}

/**
 * Get service metrics including status, resource usage, and dependencies
 */
export async function getServiceMetrics(): Promise<Partial<IMetricsData>> {
  try {
    // Initialize counters
    let running = 0;
    let stopped = 0;
    let failed = 0;
    const serviceList: ServiceInfo[] = [];

    // Get list of all services based on OS
    if (process.platform === "linux") {
      // Use systemctl for Linux systems
      const { stdout: serviceData } = await execAsync(
        "systemctl list-units --type=service --all --no-pager"
      );
      const services = serviceData
        .split("\n")
        .filter((line) => line.includes(".service"))
        .map((line) => line.trim().split(/\s+/));

      for (const service of services) {
        const name = service[0].replace(".service", "");
        const status = service[3].toLowerCase();

        // Get detailed service info
        try {
          const { stdout: details } = await execAsync(
            `systemctl show ${name} --property=MainPID,ExecStart,Description,FragmentPath,ActiveState,SubState,ActiveEnterTimestamp,Documentation,Requires`
          );
          const info = details.split("\n").reduce((acc, line) => {
            const [key, value] = line.split("=");
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);

          // Get process info if service is running
          let pid: number | undefined;
          let memory: number | undefined;
          let cpu: number | undefined;
          let uptime = 0;

          if (info.MainPID && info.MainPID !== "0") {
            pid = parseInt(info.MainPID);
            try {
              const processInfo = await si.processLoad(pid.toString());
              if (processInfo && processInfo.length > 0) {
                cpu = processInfo[0].cpu;

                // Use process.memoryUsage() as fallback since processMemory isn't available
                try {
                  const procListData = await si.processes();
                  const procInfo = procListData.list.find((p) => p.pid === pid);
                  if (procInfo) {
                    memory = procInfo.memRss;
                  }
                } catch (memError) {
                  logger.error(
                    `Failed to get memory for process ${pid}: ${memError}`
                  );
                }
              }
            } catch (procError) {
              logger.error(
                `Failed to get process info for ${pid}: ${procError}`
              );
            }

            // Calculate uptime from ActiveEnterTimestamp
            if (info.ActiveEnterTimestamp) {
              const startTime = new Date(info.ActiveEnterTimestamp).getTime();
              uptime = Math.floor((Date.now() - startTime) / 1000);
            }
          }

          // Parse dependencies
          const dependencies = info.Requires
            ? info.Requires.split(" ").map((dep) => dep.replace(".service", ""))
            : [];

          serviceList.push({
            name,
            status: info.ActiveState || status,
            pid,
            memory,
            cpu,
            uptime,
            dependencies,
            description: info.Description,
            startTime: info.ActiveEnterTimestamp,
          });

          // Update counters
          if (info.ActiveState === "active") running++;
          else if (info.ActiveState === "failed") failed++;
          else stopped++;
        } catch (error) {
          logger.error(`Failed to get details for service ${name}: ${error}`);
          // Add basic service info even if detailed info fails
          serviceList.push({
            name,
            status,
            uptime: 0,
            dependencies: [],
          });
        }
      }
    } else if (process.platform === "darwin") {
      // Use launchctl for macOS systems - improve the detection to get more services
      try {
        // Get system services
        const { stdout: systemServiceData } = await execAsync("launchctl list");

        // Parse the system services output
        const systemServices = systemServiceData
          .split("\n")
          .slice(1) // Skip header
          .filter(Boolean)
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            // Format is: PID Status Label
            const pid = parts[0];
            const exitStatus = parts[1];
            // The label/name can have spaces, so join the rest
            const name = parts.slice(2).join(" ");

            return { pid, exitStatus, name };
          })
          .filter((s) => s.name && !s.name.includes("anonymous")); // Filter out anonymous entries

        // Also get user services from different domains
        const userDomains = ["gui/501", "user/501"];
        let userServices: { pid: string; exitStatus: string; name: string }[] =
          [];

        for (const domain of userDomains) {
          try {
            const { stdout: domainServiceData } = await execAsync(
              `launchctl list ${domain}`
            );
            const domainServices = domainServiceData
              .split("\n")
              .slice(1) // Skip header
              .filter(Boolean)
              .map((line) => {
                const parts = line.trim().split(/\s+/);
                const pid = parts[0];
                const exitStatus = parts[1];
                const name = parts.slice(2).join(" ");
                return { pid, exitStatus, name };
              })
              .filter((s) => s.name && !s.name.includes("anonymous"));

            userServices = [...userServices, ...domainServices];
          } catch (domainError) {
            // Just log and continue if a domain fails
            logger.error(
              `Failed to get services for domain ${domain}: ${domainError}`
            );
          }
        }

        // Combine all services
        const allServices = [...systemServices, ...userServices];

        // Get plist files to extract more info
        try {
          const { stdout: plists } = await execAsync(
            'find /Library/LaunchDaemons /Library/LaunchAgents ~/Library/LaunchAgents -name "*.plist" 2>/dev/null || true'
          );

          const plistFiles = plists.split("\n").filter(Boolean);
          const plistInfoMap: Record<
            string,
            { description?: string; dependencies?: string[] }
          > = {};

          // Get basic info from plist files
          for (const plistFile of plistFiles) {
            try {
              const { stdout: plistInfo } = await execAsync(
                `plutil -p "${plistFile}"`
              );
              const label = plistInfo.match(/"Label"\s*=>\s*"([^"]+)"/)?.[1];
              const description = plistInfo.match(
                /"ProgramArguments"\s*=>\s*Array\s*{([^}]+)}/
              )?.[1];

              if (label) {
                plistInfoMap[label] = {
                  description: description
                    ? description.replace(/^\s+\d+\s*=>\s*"|"\s*$/gm, "").trim()
                    : undefined,
                  dependencies: [],
                };
              }
            } catch (plistError) {
              // Just log and continue if a plist fails
              logger.debug(`Failed to read plist ${plistFile}: ${plistError}`);
            }
          }

          // Process each service
          for (const service of allServices) {
            if (!service.name) continue;

            const status =
              service.pid === "-"
                ? "stopped"
                : parseInt(service.exitStatus) !== 0
                ? "failed"
                : "running";

            // Get process info if service is running
            let pidNum: number | undefined;
            let memory: number | undefined;
            let cpu: number | undefined;
            let uptime = 0;

            if (service.pid !== "-") {
              pidNum = parseInt(service.pid);

              try {
                const processInfo = await si.processLoad(pidNum.toString());
                if (processInfo && processInfo.length > 0) {
                  cpu = processInfo[0].cpu;

                  // Get memory info
                  try {
                    const procListData = await si.processes();
                    const procInfo = procListData.list.find(
                      (p) => p.pid === pidNum
                    );
                    if (procInfo) {
                      memory = procInfo.memRss;
                    }
                  } catch (memError) {
                    logger.error(
                      `Failed to get memory for process ${pidNum}: ${memError}`
                    );
                  }
                }
              } catch (procError) {
                // Just log and continue
                logger.debug(
                  `Failed to get process info for ${pidNum}: ${procError}`
                );
              }

              // Estimate uptime from process start time
              try {
                const { stdout: psInfo } = await execAsync(
                  `ps -o lstart= -p ${pidNum}`
                );
                if (psInfo) {
                  const startTime = new Date(psInfo.trim()).getTime();
                  uptime = Math.floor((Date.now() - startTime) / 1000);
                }
              } catch (uptimeError) {
                logger.debug(
                  `Failed to get uptime for process ${pidNum}: ${uptimeError}`
                );
              }
            }

            // Get additional info from plist if available
            const plistInfo = plistInfoMap[service.name] || {};

            serviceList.push({
              name: service.name,
              status,
              pid: pidNum,
              memory,
              cpu,
              uptime,
              dependencies: plistInfo.dependencies || [],
              description: plistInfo.description,
            });

            // Update counters
            if (status === "running") running++;
            else if (status === "failed") failed++;
            else stopped++;
          }
        } catch (plistError) {
          logger.error(`Failed to process plist files: ${plistError}`);
        }
      } catch (macError) {
        logger.error(`Failed to get macOS services: ${macError}`);
      }
    } else if (process.platform === "win32") {
      // Use Windows Service Controller for Windows systems
      const { stdout: serviceData } = await execAsync("sc query state= all");
      const services = serviceData
        .split("\n\n")
        .filter((block) => block.includes("SERVICE_NAME"))
        .map((block) => {
          const lines = block.split("\n").map((line) => line.trim());
          return {
            name: lines
              .find((l) => l.startsWith("SERVICE_NAME"))
              ?.split(":")[1]
              ?.trim(),
            status: lines
              .find((l) => l.startsWith("STATE"))
              ?.split(":")[1]
              ?.trim(),
          };
        });

      for (const service of services) {
        if (!service.name) continue;

        // Get detailed service info
        try {
          const { stdout: details } = await execAsync(
            `sc qc "${service.name}"`
          );
          const info = details.split("\n").reduce((acc, line) => {
            const [key, ...value] = line.trim().split(":");
            acc[key.trim()] = value.join(":").trim();
            return acc;
          }, {} as Record<string, string>);

          const status = service.status?.toLowerCase() || "unknown";
          let pid: number | undefined;
          let memory: number | undefined;
          let cpu: number | undefined;
          let uptime = 0;

          // Get process info if service is running
          if (status.includes("running")) {
            const { stdout: taskData } = await execAsync(
              `tasklist /FI "SERVICES eq ${service.name}" /FO CSV /NH`
            );
            const taskInfo = taskData.split(",");
            if (taskInfo.length > 1) {
              pid = parseInt(taskInfo[1].replace(/"/g, ""));
              if (pid) {
                try {
                  const processInfo = await si.processLoad(pid.toString());
                  if (processInfo && processInfo.length > 0) {
                    cpu = processInfo[0].cpu;

                    // Get memory info
                    try {
                      const procListData = await si.processes();
                      const procInfo = procListData.list.find(
                        (p) => p.pid === pid
                      );
                      if (procInfo) {
                        memory = procInfo.memRss;
                      }
                    } catch (memError) {
                      logger.error(
                        `Failed to get memory for process ${pid}: ${memError}`
                      );
                    }
                  }
                } catch (procError) {
                  logger.debug(
                    `Failed to get process info for ${pid}: ${procError}`
                  );
                }
              }
            }
          }

          serviceList.push({
            name: service.name,
            status,
            pid,
            memory,
            cpu,
            uptime,
            dependencies: info["DEPENDENCIES"]
              ? info["DEPENDENCIES"].split("/").filter(Boolean)
              : [],
            description: info["DISPLAY_NAME"],
          });

          // Update counters
          if (status.includes("running")) running++;
          else if (status.includes("stopped")) stopped++;
          else failed++;
        } catch (error) {
          logger.error(
            `Failed to get details for service ${service.name}: ${error}`
          );
          serviceList.push({
            name: service.name,
            status: "unknown",
            uptime: 0,
            dependencies: [],
          });
        }
      }
    }

    // Sort services by status (running first) and name
    serviceList.sort((a: ServiceInfo, b: ServiceInfo) => {
      if (a.status === b.status) {
        return a.name.localeCompare(b.name);
      }
      return a.status === "running" ? -1 : 1;
    });

    return {
      services: {
        all: serviceList.length,
        running,
        stopped,
        failed,
        list: serviceList,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error(`Failed to get service metrics: ${(error as Error).message}`);
    return {
      services: {
        all: 0,
        running: 0,
        stopped: 0,
        failed: 0,
        list: [],
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}
