function formatMetricsMessage(metrics: any): string {
  try {
    const { cpu, memory } = metrics;
    const formatMem = `🖥️ Memory Usage: ${memory.used.toFixed(2)} GB / ${memory.total.toFixed(2)} GB (${memory.percentage.toFixed(2)}% ${getCpuUsageStatus(memory.percentage)})`;
    return (
      `📊 Current Server Metrics\n\n` +
      `🔸 CPU Usage: ${cpu?.usage?.toFixed(2)}%\n` +
      `🔸 CPU Cores: ${cpu?.cores || "N/A"}\n` +
      `🔸 Load Average: ${cpu?.load_avg?.[0]?.toFixed(2) || "N/A"}\n\n` +
      formatMem
    );
  } catch (error) {
    console.error(
      `Error formatting metrics message: ${(error as Error).message}`
    );
    return "Error formatting metrics data";
  }
}

function getFormattedLoadAverages(metrics: any): string {
  try {
    const { loadAvgs } = metrics;
    if (!loadAvgs) return "Error: Could not retrieve CPU load averages";
    const minute_1 = loadAvgs["1min"];
    const minutes_5 = loadAvgs["5mins"];
    const minutes_15 = loadAvgs["15mins"];
    return `
    📊 Current load average Metrics\n\n
    🕒 1-Min Ago
    📊 CPU Load: ${minute_1.toFixed(2)}%
    ${cpuLoadStatus(minute_1)}\n
    🕒 5-Min Ago
    📊 CPU Load: ${minutes_5.toFixed(2)}%
    ${cpuLoadStatus(minutes_5)}\n
    🕒 15-Min Ago
    📊 CPU Load: ${minutes_15.toFixed(2)}%
    ${cpuLoadStatus(minutes_15)}
    `;
  } catch (error) {
    console.error(
      `Error formatting load avgs message: ${(error as Error).message}`
    );
    return "Error formatting load avgs data";
  }
}

function cpuLoadStatus(percent: number): string {
  if (percent >= 250)
    return "🔥Status: Critical overload! Expect major slowdowns.";
  if (percent >= 200)
    return "⚠️Status: CPU is overloaded! Processes are waiting.";
  if (percent >= 150)
    return "⚠️Status: High CPU usage! Performance may degrade.";
  if (percent >= 100) return "⚠️Status: CPU is fully utilized.";
  return "✅Status: System is running smoothly.";
}

/**
 * Format a CPU threshold alert message
 * @param metrics The metrics data
 * @param threshold The threshold that was exceeded
 * @param isCritical Whether this is a critical alert
 */
function formatCpuAlertMessage(
  metrics: any,
  threshold: number,
  isCritical = false
): string {
  try {
    const { cpu } = metrics;
    const serverName = metrics.serverName || "Your Server";

    // Emojis and styling based on severity
    const severityEmoji = isCritical ? "🔥" : "⚠️";
    const severityText = isCritical ? "CRITICAL" : "WARNING";
    const borderChar = isCritical ? "═" : "─";

    // Build a border for the message
    const border = borderChar.repeat(40);

    // Format the timestamp
    const timestamp = new Date().toLocaleString();

    // Determine the performance impact
    let impactText = "No impact expected";
    if (cpu?.usage >= 95) {
      impactText = "Severe performance degradation likely";
    } else if (cpu?.usage >= 90) {
      impactText = "Significant performance impact possible";
    } else if (cpu?.usage >= 80) {
      impactText = "Some performance impact may occur";
    }

    return `${severityEmoji} ${severityText} CPU ALERT ${severityEmoji}\n${border}\n
CPU usage has exceeded the configured threshold!

🖥️ Server: ${serverName}
📈 Current Usage: ${cpu?.usage?.toFixed(1)}%
🔍 Threshold: ${threshold}%
⏱️ Cores: ${cpu?.cores || "N/A"}
🕒 Detected at: ${timestamp}

📊 Performance Impact: ${impactText}

${border}

${isCritical ? "👉 Immediate action recommended!" : "👉 Please investigate when possible."}
`;
  } catch (error) {
    console.error(`Error formatting CPU alert: ${(error as Error).message}`);
    return `CPU Usage Alert: CPU usage has exceeded the ${threshold}% threshold.`;
  }
}

function formatCpuUsagePerCoreMetrics(metrics: any) {
  const { coresLoad } = metrics;
  const numCores = coresLoad.length;
  const avg =
    coresLoad.reduce((curr: number, acc: number) => curr + acc, 0) / numCores;

  const formattedCores = coresLoad
    .map((load: number, index: number) => {
      const usage = load.toFixed(1);
      const status = getCpuUsageStatus(load);
      return `  ⚡ Core ${index + 1}: ${usage}% ${status}\n`;
    })
    .join("\n");

  return `
📊 CPU Usage Per Core

🖥️  Total Cores: ${numCores}

${formattedCores}

📊 Average Usage: ${avg.toFixed(1)}%
`;
}

function getCpuUsageStatus(percentage: number) {
  if (percentage >= 80) return "🔴(High usage)";
  if (percentage >= 50) return "🟠(Moderate usage)";
  return "🟢(Low usage)";
}

export {
  formatMetricsMessage,
  getFormattedLoadAverages,
  formatCpuAlertMessage,
  formatCpuUsagePerCoreMetrics,
};
