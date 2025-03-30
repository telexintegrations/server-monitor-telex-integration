import { MetricsData } from "../../types/metricType.js";
import { getUsageIndicator } from "../messageFormatters.js";

/**
 * Formats security metrics for display
 */
export function formatSecurityMetrics(metrics: MetricsData): string {
  if (!metrics.security) {
    return "No security metrics available";
  }

  const security = metrics.security;

  // Start with a header
  let output = `
  ┌─────────────────────────┐
       🔒 SECURITY METRICS     
  └─────────────────────────┘
  `;

  // Add failed login information
  if (security.failedLogins) {
    const severity =
      security.failedLogins.count > 10
        ? "🔴"
        : security.failedLogins.count > 5
          ? "🟠"
          : "🟢";

    output += `
  == FAILED LOGINS ==
  ▶ Count: ${security.failedLogins.count} ${severity}
  `;

    if (
      security.failedLogins.recent &&
      security.failedLogins.recent.length > 0
    ) {
      output += `\n  Recent attempts:`;
      security.failedLogins.recent.slice(0, 3).forEach((attempt) => {
        output += `\n  - ${attempt.timestamp}: User "${attempt.user}" from ${attempt.source}`;
      });

      if (security.failedLogins.recent.length > 3) {
        output += `\n  ... and ${security.failedLogins.recent.length - 3} more`;
      }
    }
  }

  // Add SSH access information
  if (security.sshAccess) {
    output += `
  
  == SSH ACCESS ==
  ▶ Successful logins: ${security.sshAccess.count}
  `;

    if (security.sshAccess.recent && security.sshAccess.recent.length > 0) {
      output += `\n  Recent logins:`;
      security.sshAccess.recent.slice(0, 3).forEach((access) => {
        output += `\n  - ${access.timestamp}: User "${access.user}" from ${access.source}`;
      });

      if (security.sshAccess.recent.length > 3) {
        output += `\n  ... and ${security.sshAccess.recent.length - 3} more`;
      }
    }
  }

  // Add firewall information
  if (security.firewall) {
    output += `
  
  == FIREWALL ==
  ▶ Active connections: ${security.firewall.connections}
  ▶ Blocked connections: ${security.firewall.blocked}
  `;

    if (security.firewall.rules && security.firewall.rules.length > 0) {
      output += `\n  Sample rules:`;
      security.firewall.rules.slice(0, 3).forEach((rule) => {
        output += `\n  - ${rule.chain}/${rule.target}: ${rule.protocol} from ${rule.source} to ${rule.destination}`;
      });

      if (security.firewall.rules.length > 3) {
        output += `\n  ... and ${security.firewall.rules.length - 3} more`;
      }
    }
  }

  // Add port scanning information
  if (security.portScanning) {
    const scanStatus = security.portScanning.detected
      ? "🔴 DETECTED"
      : "🟢 None detected";

    output += `
  
  == PORT SCANNING ==
  ▶ Status: ${scanStatus}
  `;

    if (
      security.portScanning.detected &&
      security.portScanning.attempts &&
      security.portScanning.attempts.length > 0
    ) {
      output += `\n  Detected attempts:`;
      security.portScanning.attempts.slice(0, 3).forEach((attempt) => {
        output += `\n  - ${attempt.timestamp}: ${attempt.source} targeting port(s) ${attempt.ports}`;
      });

      if (security.portScanning.attempts.length > 3) {
        output += `\n  ... and ${security.portScanning.attempts.length - 3} more`;
      }
    }
  }

  // Add last updated time
  if (security.lastUpdated) {
    output += `
  
  Last updated: ${new Date(security.lastUpdated).toLocaleString()}`;
  }

  return output;
}

/**
 * Format security alert message
 */
export function formatSecurityAlertMessage(
  metrics: MetricsData,
  alerts: string[],
  isCritical: boolean
): string {
  const severityEmoji = isCritical ? "🔥" : "⚠️";
  const severityText = isCritical ? "CRITICAL" : "WARNING";

  if (!metrics.security) {
    return `${severityEmoji} ${severityText}: Security metrics not available`;
  }

  // Build alert message
  let alertMessage = `
  ┌─────────────────────────┐
   ${severityEmoji} ${severityText} SECURITY ALERT 
  └─────────────────────────┘
  
  ${alerts.map((alert) => `▶ ${alert}`).join("\n  ")}
  
  `;

  // Add details based on what triggered the alert
  const security = metrics.security;

  // Add failed login details if that triggered the alert
  if (alerts.some((a) => a.includes("failed login"))) {
    alertMessage += `\n  -- Failed Login Details --`;
    if (
      security.failedLogins &&
      security.failedLogins.recent &&
      security.failedLogins.recent.length > 0
    ) {
      security.failedLogins.recent.slice(0, 5).forEach((attempt) => {
        alertMessage += `\n  - ${attempt.timestamp}: User "${attempt.user}" from ${attempt.source}`;
      });
    }
  }

  // Add port scanning details if that triggered the alert
  if (alerts.some((a) => a.includes("port scanning"))) {
    alertMessage += `\n\n  -- Port Scanning Details --`;
    if (
      security.portScanning &&
      security.portScanning.attempts &&
      security.portScanning.attempts.length > 0
    ) {
      security.portScanning.attempts.slice(0, 5).forEach((attempt) => {
        alertMessage += `\n  - ${attempt.timestamp}: ${attempt.source} targeting port(s) ${attempt.ports}`;
      });
    }
  }

  // Add timestamp
  alertMessage += `\n\n  Timestamp: ${new Date().toLocaleString()}`;

  // Add recommended actions based on severity
  if (isCritical) {
    alertMessage += `\n\n  IMMEDIATE ACTION RECOMMENDED:
  - Review system logs for unauthorized access
  - Consider temporarily blocking suspicious IP addresses
  - Check for unusual processes or network connections`;
  } else {
    alertMessage += `\n\n  RECOMMENDED ACTION:
  - Monitor the situation
  - Review recent login activity
  - Verify firewall rules are properly configured`;
  }

  return alertMessage;
}
