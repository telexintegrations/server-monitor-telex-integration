import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { IMetricsData } from "./collector.js";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

/**
 * Get security metrics including:
 * - Failed login attempts
 * - SSH access logs
 * - Firewall statistics
 * - Port scanning detection
 */
export async function getSecurityMetrics(): Promise<Partial<IMetricsData>> {
  try {
    // Run these operations in parallel for efficiency
    const [failedLoginData, sshAccessData, firewallStats, portScanningData] =
      await Promise.all([
        getFailedLogins(),
        getSSHAccessLogs(),
        getFirewallStatistics(),
        getPortScanningDetection(),
      ]);

    return {
      security: {
        failedLogins: failedLoginData,
        sshAccess: sshAccessData,
        firewall: firewallStats,
        portScanning: portScanningData,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error(`Failed to get security metrics: ${(error as Error).message}`);
    return {
      security: {
        failedLogins: { count: 0, recent: [] },
        sshAccess: { count: 0, recent: [] },
        firewall: { connections: 0, blocked: 0, rules: [] },
        portScanning: { detected: false, attempts: [] },
        lastUpdated: new Date().toISOString(),
        error: (error as Error).message,
      },
    };
  }
}

/**
 * Get failed login attempts from auth.log
 */
async function getFailedLogins(): Promise<{
  count: number;
  recent: Array<{
    timestamp: string;
    user: string;
    source: string;
    message: string;
  }>;
}> {
  try {
    // Try several common locations for auth logs
    const possibleLogPaths = [
      "/var/log/auth.log", // Debian/Ubuntu
      "/var/log/secure", // RHEL/CentOS
      "/var/log/system.log", // macOS
    ];

    let logContent = "";
    let logPath = "";

    // Find the first available log file
    for (const path of possibleLogPaths) {
      if (fs.existsSync(path)) {
        logPath = path;
        // Read the last 500 lines of the log file to limit memory usage
        const { stdout } = await execAsync(`tail -n 500 ${path}`);
        logContent = stdout;
        break;
      }
    }

    if (!logContent) {
      // If no standard log files found, try using the journalctl command
      try {
        const { stdout } = await execAsync(
          "journalctl -u sshd -n 100 --no-pager"
        );
        logContent = stdout;
      } catch (e) {
        // If journalctl fails, return empty results
        return { count: 0, recent: [] };
      }
    }

    // Look for failed login patterns across different systems
    const failedLoginPatterns = [
      /Failed password for (.*?) from (.*?) port/, // SSH failed password
      /Failed password for invalid user (.*?) from (.*?) port/, // SSH failed password for invalid user
      /authentication failure.*?user=(.*?) rhost=(.*?)/, // PAM authentication failure
      /FAILED LOGIN/i, // General failed login
    ];

    const failedLogins: Array<{
      timestamp: string;
      user: string;
      source: string;
      message: string;
    }> = [];
    const lines = logContent.split("\n");

    // Process each line in the log content
    for (const line of lines) {
      if (line.trim()) {
        for (const pattern of failedLoginPatterns) {
          if (pattern.test(line)) {
            const matches = line.match(pattern);
            const timestamp = extractTimestamp(line);

            let user = "unknown";
            let source = "unknown";

            if (matches && matches.length > 1) {
              user = matches[1];
              if (matches.length > 2) {
                source = matches[2];
              }
            }

            failedLogins.push({
              timestamp,
              user,
              source,
              message: line.substring(0, 150), // Limit message length
            });
            break;
          }
        }
      }
    }

    // Sort most recent first and limit to 10
    const recentFailedLogins = failedLogins
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10);

    return {
      count: failedLogins.length,
      recent: recentFailedLogins,
    };
  } catch (error) {
    logger.error(`Failed to get failed logins: ${(error as Error).message}`);
    return { count: 0, recent: [] };
  }
}

/**
 * Get SSH access logs
 */
async function getSSHAccessLogs(): Promise<{
  count: number;
  recent: Array<{
    timestamp: string;
    user: string;
    source: string;
    message: string;
  }>;
}> {
  try {
    let logContent = "";

    // Try to get SSH logs using different methods
    try {
      // Try to use the journalctl command first (modern systems)
      const { stdout } = await execAsync(
        "journalctl -u sshd -n 100 --no-pager"
      );
      logContent = stdout;
    } catch (e) {
      // Fall back to log files if journalctl fails
      const possibleLogPaths = [
        "/var/log/auth.log",
        "/var/log/secure",
        "/var/log/system.log",
      ];

      for (const path of possibleLogPaths) {
        if (fs.existsSync(path)) {
          const { stdout } = await execAsync(
            `grep "sshd" ${path} | tail -n 100`
          );
          logContent = stdout;
          break;
        }
      }
    }

    if (!logContent) {
      return { count: 0, recent: [] };
    }

    // Look for successful SSH login patterns
    const sshAccessPattern =
      /Accepted (password|publickey) for (.*?) from (.*?) port/;
    const sshAccesses: Array<{
      timestamp: string;
      user: string;
      source: string;
      message: string;
    }> = [];
    const lines = logContent.split("\n");

    for (const line of lines) {
      if (line.trim() && sshAccessPattern.test(line)) {
        const matches = line.match(sshAccessPattern);
        const timestamp = extractTimestamp(line);

        let authMethod = "unknown";
        let user = "unknown";
        let source = "unknown";

        if (matches && matches.length > 1) {
          authMethod = matches[1];
          if (matches.length > 2) {
            user = matches[2];
          }
          if (matches.length > 3) {
            source = matches[3];
          }
        }

        sshAccesses.push({
          timestamp,
          user,
          source,
          message: `Accepted ${authMethod} for ${user} from ${source}`,
        });
      }
    }

    // Sort most recent first and limit to 10
    const recentAccesses = sshAccesses
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10);

    return {
      count: sshAccesses.length,
      recent: recentAccesses,
    };
  } catch (error) {
    logger.error(`Failed to get SSH access logs: ${(error as Error).message}`);
    return { count: 0, recent: [] };
  }
}

/**
 * Get firewall statistics
 */
async function getFirewallStatistics(): Promise<{
  connections: number;
  blocked: number;
  rules: Array<{
    chain: string;
    target: string;
    protocol: string;
    source: string;
    destination: string;
  }>;
}> {
  try {
    let connections = 0;
    let blocked = 0;
    const rules: Array<{
      chain: string;
      target: string;
      protocol: string;
      source: string;
      destination: string;
    }> = [];

    // Try to get firewall stats using iptables (Linux)
    try {
      // Get existing connections
      const { stdout: connectionsOutput } = await execAsync(
        "iptables -L -n -v | grep -v '0     0'"
      );
      const connectionLines = connectionsOutput
        .split("\n")
        .filter((line) => line.trim());
      connections = connectionLines.length;

      // Count blocked connections (typically in DROP or REJECT targets)
      blocked = connectionLines.filter(
        (line) => line.includes("DROP") || line.includes("REJECT")
      ).length;

      // Get rules summary
      const { stdout: rulesOutput } = await execAsync(
        "iptables -L -n | head -n 30"
      );
      const ruleLines = rulesOutput.split("\n").filter((line) => line.trim());

      let currentChain = "";
      for (const line of ruleLines) {
        if (line.startsWith("Chain")) {
          currentChain = line.split(" ")[1];
        } else if (line.startsWith("target")) {
          // Skip headers
          continue;
        } else if (line.trim()) {
          const parts = line.split(/\s+/);
          if (parts.length >= 4) {
            rules.push({
              chain: currentChain,
              target: parts[0],
              protocol: parts[1],
              source: parts[3],
              destination: parts[4] || "any",
            });
          }
        }
      }
    } catch (e) {
      // Try to use pfctl on macOS/BSD
      try {
        const { stdout: pfInfo } = await execAsync("pfctl -s info");
        const blockedMatch = pfInfo.match(/Blocked packets: (\d+)/);
        if (blockedMatch) {
          blocked = parseInt(blockedMatch[1], 10);
        }

        const statesMatch = pfInfo.match(/Current states: (\d+)/);
        if (statesMatch) {
          connections = parseInt(statesMatch[1], 10);
        }

        // Get a sample of rules
        const { stdout: pfRules } = await execAsync(
          "pfctl -s rules | head -n 10"
        );
        const ruleLines = pfRules.split("\n").filter((line) => line.trim());

        for (const line of ruleLines) {
          if (line.includes("block") || line.includes("pass")) {
            const action = line.includes("block") ? "block" : "pass";
            const proto = line.includes("proto ")
              ? line.split("proto ")[1].split(" ")[0]
              : "any";

            rules.push({
              chain: "filter",
              target: action,
              protocol: proto,
              source: line.includes("from ")
                ? line.split("from ")[1].split(" ")[0]
                : "any",
              destination: line.includes("to ")
                ? line.split("to ")[1].split(" ")[0]
                : "any",
            });
          }
        }
      } catch (pfError) {
        // If both methods fail, leave defaults (0 connections, 0 blocked, empty rules)
      }
    }

    return {
      connections,
      blocked,
      rules: rules.slice(0, 5), // Limit to 5 rules for readability
    };
  } catch (error) {
    logger.error(
      `Failed to get firewall statistics: ${(error as Error).message}`
    );
    return {
      connections: 0,
      blocked: 0,
      rules: [],
    };
  }
}

/**
 * Detect potential port scanning activity
 */
async function getPortScanningDetection(): Promise<{
  detected: boolean;
  attempts: Array<{
    timestamp: string;
    source: string;
    ports: string;
    message: string;
  }>;
}> {
  try {
    let logContent = "";

    // Try to check logs for port scanning signs
    const possibleLogPaths = [
      "/var/log/auth.log",
      "/var/log/secure",
      "/var/log/firewall.log",
      "/var/log/ufw.log",
    ];

    for (const path of possibleLogPaths) {
      if (fs.existsSync(path)) {
        const { stdout } = await execAsync(
          `grep -i "scan\|multiple\|port" ${path} | tail -n 100`
        );
        logContent += stdout + "\n";
      }
    }

    // Also try to use journalctl for firewall logs
    try {
      const { stdout: journalLogs } = await execAsync(
        "journalctl -k -g 'port.*scan' -n 50 --no-pager"
      );
      logContent += journalLogs;
    } catch (e) {
      // Ignore errors from journalctl
    }

    // If no logs found, try using the netstat command to detect many connections from single sources
    if (!logContent) {
      const { stdout: netstatOutput } = await execAsync(
        "netstat -tn | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -nr | head -n 10"
      );

      // Process netstat output to find potential scanners
      const lines = netstatOutput.split("\n");
      const potentialScanners = lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const count = parseInt(parts[0], 10);
            const ip = parts[1];
            // If a single IP has many connections, it might be scanning
            if (count > 10 && ip !== "*" && !ip.startsWith("127.")) {
              return {
                timestamp: new Date().toISOString(),
                source: ip,
                ports: "multiple",
                message: `${ip} has ${count} concurrent connections, possible port scanning`,
              };
            }
          }
          return null;
        })
        .filter((item) => item !== null) as Array<{
        timestamp: string;
        source: string;
        ports: string;
        message: string;
      }>;

      return {
        detected: potentialScanners.length > 0,
        attempts: potentialScanners,
      };
    }

    // Process log content for port scanning signs
    const scanPatterns = [
      /port scan/i,
      /multiple ports/i,
      /PSH flags/i,
      /multiple connections/i,
      /scan detected/i,
    ];

    const scanAttempts: Array<{
      timestamp: string;
      source: string;
      ports: string;
      message: string;
    }> = [];
    const lines = logContent.split("\n");

    for (const line of lines) {
      if (line.trim()) {
        for (const pattern of scanPatterns) {
          if (pattern.test(line)) {
            const timestamp = extractTimestamp(line);

            // Try to extract IP addresses from the line
            const ipMatch = line.match(
              /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
            );
            const source = ipMatch ? ipMatch[0] : "unknown";

            // Try to extract port information
            const portMatch =
              line.match(/port (\d+)/i) ||
              line.match(/ports? \s?(\d+[-,\d\s]*)/i);
            const ports = portMatch ? portMatch[1] : "unknown";

            scanAttempts.push({
              timestamp,
              source,
              ports,
              message: line.substring(0, 150), // Limit message length
            });
            break;
          }
        }
      }
    }

    // Sort most recent first and limit to 10
    const recentAttempts = scanAttempts
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10);

    return {
      detected: recentAttempts.length > 0,
      attempts: recentAttempts,
    };
  } catch (error) {
    logger.error(`Failed to detect port scanning: ${(error as Error).message}`);
    return {
      detected: false,
      attempts: [],
    };
  }
}

/**
 * Helper function to extract timestamp from log lines
 */
function extractTimestamp(line: string): string {
  try {
    // Try to match common timestamp patterns in logs
    const timestampPatterns = [
      /(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/, // Aug 21 07:42:26
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+[+-]\d{4})/, // ISO format
      /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/, // 2023-08-21 07:42:26
      /(\w{3}\s+\d{1,2},?\s+\d{4}\s+\d{2}:\d{2}:\d{2})/, // Aug 21, 2023 07:42:26
    ];

    for (const pattern of timestampPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If no timestamp found, return current time
    return new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

/**
 * Check for security threshold breaches
 * @param securityMetrics Security metrics data
 * @param failedLoginThreshold Maximum number of failed logins before alert (default: 5)
 * @returns Alert status and severity
 */
export function checkSecurityThresholds(
  securityMetrics: any,
  failedLoginThreshold: number = 5
): { alertRequired: boolean; isCritical: boolean; alerts: string[] } {
  const alerts: string[] = [];
  let isCritical = false;

  // Check failed logins
  if (
    securityMetrics.failedLogins &&
    securityMetrics.failedLogins.count > failedLoginThreshold
  ) {
    alerts.push(
      `Excessive failed logins: ${securityMetrics.failedLogins.count} attempts`
    );
    isCritical = securityMetrics.failedLogins.count > failedLoginThreshold * 2;
  }

  // Check for port scanning
  if (securityMetrics.portScanning && securityMetrics.portScanning.detected) {
    alerts.push(
      `Potential port scanning detected from ${securityMetrics.portScanning.attempts.length} sources`
    );
    isCritical = true; // Port scanning is always considered critical
  }

  return {
    alertRequired: alerts.length > 0,
    isCritical,
    alerts,
  };
}
