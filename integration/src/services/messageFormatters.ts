function formatMetricsMessage(metrics: any): string {
  try {
    const { cpu } = metrics;
    return (
      `📊 Current Server Metrics\n\n` +
      `🔸 CPU Usage: ${cpu?.usage?.toFixed(2)}%\n` +
      `🔸 CPU Cores: ${cpu?.cores || "N/A"}\n` +
      `🔸 Load Average: ${cpu?.load_avg?.[0]?.toFixed(2) || "N/A"}`
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

export { formatMetricsMessage, getFormattedLoadAverages };
