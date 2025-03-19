export interface MetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
  };
  loadAvgs?: {
    "1min": number;
    "5mins": number;
    "15mins": number;
  };
}

export enum MetricType {
  getCpuMetrics = "getCpuMetrics",
  getCpuLoadAverages = "getCpuLoadAverages",
}

export enum MetricReplyType {
  getCpuMetrics = "getCpuMetricsReply",
  getCpuLoadAverages = "getCpuLoadAveragesReply",
  cpuThresholdAlert = "cpuThresholdAlert",
}
