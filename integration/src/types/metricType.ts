export enum MetricReplyType {
  getAllMetrics = "getAllMetricsReply",
  getCpuMetrics = "getCpuMetricsReply",
  getCpuLoadAverages = "getCpuLoadAveragesReply",
  getCpuUsagePerCore = "getCpuUsagePerCoreReply",
  getMemoryStats = "getMemoryStatsReply",
  cpuThresholdAlert = "cpuThresholdAlertReply",
  memoryThresholdAlert = "memoryThresholdAlertReply",
  securityAlert = "securityAlertReply",
  getDiskMetrics = "getDiskMetricsReply",
  getProcessMetrics = "getProcessMetricsReply",
  getNetworkMetrics = "getNetworkMetricsReply",
  getSecurityMetrics = "getSecurityMetricsReply",
  getServicesReply = "getServicesReply",
  logMetricReply = "LogMetricReply",
}

export interface MetricsData {
  cpu?: {
    usage: number;
    cores?: number;
    load_avg?: number[];
    process_queue_length?: number;
    context_switches?: number;
    interrupts?: number;
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
    // Extended memory metrics
    swap?: {
      used: number;
      total: number;
      percentage: number;
    };
    buffer?: {
      used: number;
      percentage: number;
    };
    pageFaults?: {
      pageFaults: number;
      majorPageFaults: number;
      minorPageFaults: number;
    };
    memoryPressure?: {
      contextSwitches: number;
      interrupts: number;
      activeRatio: number;
    };
  };
  disk?: {
    filesystems: Array<{
      fs: string; // file system
      type: string; // type of file system
      size: number; // size in bytes
      used: number; // used in bytes
      available: number; // available in bytes
      use: number; // used in %
      mount: string; // mount point
      inodes: number;
      inodesUsed: number;
      inodesFree: number;
      inodesUsage: number;
    }>;
    io?: {
      rIO: number; // read I/O operations
      wIO: number; // write I/O operations
      tIO: number; // total I/O operations
      rWaitTime: number; // read wait time in ms
      wWaitTime: number; // write wait time in ms
      tWaitTime: number; // total wait time in ms
      rPerSec: number; // reads per second
      wPerSec: number; // writes per second
    };
  };
  processes?: {
    all: number; // total process count
    running: number; // number of running processes
    blocked: number; // number of blocked processes
    sleeping: number; // number of sleeping processes
    unknown: number; // number of processes in unknown state
    zombie: number; // number of zombie processes
    list: Array<{
      pid: number; // process ID
      name: string; // process name
      cpu: number; // process CPU usage percentage
      mem: number; // process memory usage percentage
      priority: number; // process priority
      memVsz: number; // virtual memory size
      memRss: number; // resident set size (RAM)
      state: string; // process state (running, sleeping, etc.)
      user: string; // user who owns the process
      command: string; // command used to start the process
    }>;
  };
  networkMetrics?: {
    timestamp: number;
    bandwidthUsage: {
      received: number; // bytes per second
      sent: number; // bytes per second
      lastMeasurement: number;
    };
    latency: number; // milliseconds
    packetLoss: number; // percentage
    interfaceStats: {
      [interfaceName: string]: {
        rxBytes: number;
        txBytes: number;
        errors: number;
      };
    };
    connectionCount: number;
  };
  serverName?: string;
  security?: {
    failedLogins: {
      count: number;
      recent: Array<{
        timestamp: string;
        user: string;
        source: string;
        message: string;
      }>;
    };
    sshAccess: {
      count: number;
      recent: Array<{
        timestamp: string;
        user: string;
        source: string;
        message: string;
      }>;
    };
    firewall: {
      connections: number;
      blocked: number;
      rules: Array<{
        chain: string;
        target: string;
        protocol: string;
        source: string;
        destination: string;
      }>;
    };
    portScanning: {
      detected: boolean;
      attempts: Array<{
        timestamp: string;
        source: string;
        ports: string;
        message: string;
      }>;
    };
    lastUpdated: string;
    error?: string;
  };
  services?: {
    all: number;
    running: number;
    stopped: number;
    failed: number;
    list: Array<{
      name: string;
      status: string;
      pid?: number;
      memory?: number;
      cpu?: number;
      uptime: number;
      dependencies: string[];
      description?: string;
      startTime?: string;
    }>;
    lastUpdated: string;
  };
  logMetrics?: {
    timestamp: number;
    systemErrors: {
      timestamp: string;
      message: string;
    }[];
    customLogEntries: {
      timestamp: string;
      message: string;
    }[];
  };
}

export enum MetricType {
  getAllMetrics = "getAllMetrics",
  getCpuMetrics = "getCpuMetrics",
  getCpuLoadAverages = "getCpuLoadAverages",
  getCpuUsagePerCore = "getCpuUsagePerCore",
  getMemoryStats = "getMemoryStats",
  getDiskMetrics = "getDiskMetrics",
  getProcessMetrics = "getProcessMetrics",
  getNetworkMetrics = "getNetworkMetrics",
  getSecurityMetrics = "getSecurityMetrics",
  getServices = "getServices",
}

export interface IFormatMetricResponseOptions {
  isCritical: boolean;
  cpuThreshold: number;
  diskThreshold?: number;
  memoryThreshold?: number;
  securityAlerts?: string[];
}
