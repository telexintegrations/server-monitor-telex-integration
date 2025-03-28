import { MetricsData } from "../../types/metricType.js";

/**
 * Formats process metrics if available
 */
function formatProcessMetrics(metrics: MetricsData): string {
  if (!metrics.processes) {
    return "";
  }

  const { processes } = metrics;

  let output = `
  ┌─────────────────────────┐
       🔄 PROCESS METRICS     
  └─────────────────────────┘
  
  == PROCESS SUMMARY ==
  ▶ Total Processes: ${processes.all}
  ▶ Running: ${processes.running}
  ▶ Sleeping: ${processes.sleeping}
  ▶ Blocked: ${processes.blocked}
  ▶ Zombie: ${processes.zombie || 0}${processes.zombie > 0 ? " ⚠️" : ""}
  ▶ Unknown: ${processes.unknown}
  
  == TOP PROCESSES BY CPU USAGE ==`;

  // Format top processes
  if (processes.list && processes.list.length > 0) {
    processes.list.forEach((proc, index) => {
      output += `
  ${index + 1}. ${proc.name.substring(0, 15).padEnd(15)} [PID: ${proc.pid}]
     CPU: ${proc.cpu.toFixed(1).padStart(5)}%  MEM: ${proc.mem.toFixed(1).padStart(5)}%  User: ${proc.user || "unknown"}
     State: ${proc.state || "unknown"}  Command: ${(proc.command || "").substring(0, 40)}${proc.command && proc.command.length > 40 ? "..." : ""}`;
    });
  } else {
    output += `\n▶ No process data available`;
  }

  return output;
}

export { formatProcessMetrics };
