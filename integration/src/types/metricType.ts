export enum MetricReplyType {
  getAllMetrics = "getAllMetricsReply",
  getCpuMetrics = "getCpuMetricsReply",
  getCpuLoadAverages = "getCpuLoadAveragesReply",
  getCpuUsagePerCore = "getCpuUsagePerCoreReply",
  getMemoryStats = "getMemoryStatsReply",
  cpuThresholdAlert = "cpuThresholdAlertReply",
}

export interface MetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
  };
  cpuLoadAvgs?: {
    "1min": number;
    "5mins": number;
    "15mins": number;
  };
  cpuUsagePerCore?: number[]; // array of cores usage in percentage
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  serverName?: string;
}

export enum MetricType {
  getAllMetrics = "getAllMetrics",
  getCpuMetrics = "getCpuMetrics",
  getCpuLoadAverages = "getCpuLoadAverages",
  getCpuUsagePerCore = "getCpuUsagePerCore",
  getMemoryStats = "getMemoryStats",
}

export interface IFormatMetricResponseOptions {
  isCritical: boolean;
  cpuThreshold: number;
}
