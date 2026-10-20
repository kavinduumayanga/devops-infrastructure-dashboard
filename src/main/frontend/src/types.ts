// API Response types

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  instanceId?: string;
  requestId?: string;
  timestamp?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

export interface InstanceInfo {
  instanceId: string;
  hostname: string;
  javaVersion: string;
  javaVendor: string;
  status: string;
  timestamp: string;
  environment: string;
  servletContainerInfo?: string;
  uptimeMs: number;
  uptime: string;
  startTime: string;
}

export interface SystemInfo {
  instanceId: string;
  hostname: string;
  environment: string;
  osName: string;
  osVersion: string;
  osArch: string;
  javaVersion: string;
  javaVendor: string;
  jvmUptime: string;
  jvmUptimeMs: number;
  jvmStartTime: string;
  jvmName: string;
  jvmVendor: string;
  jvmVersion: string;
  heapUsedMB: number;
  heapMaxMB: number;
  heapCommittedMB: number;
  availableProcessors: number;
  freeMemoryMB: number;
  totalMemoryMB: number;
  maxMemoryMB: number;
  servletContainerInfo: string;
  servletApiVersion: string;
}

export interface DatabaseHealth {
  status: string;
  pingLatencyMs?: number;
  version?: string;
  database: string;
  host: string;
  port: number;
  totalDurationMs: number;
  recordCount?: number;
  connectionPool?: {
    status: string;
    activeConnections?: number;
    idleConnections?: number;
    totalConnections?: number;
    threadsAwaitingConnection?: number;
  };
  error?: string;
}

export interface DemoRecord {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

export interface CacheHealth {
  status: string;
  latencyMs?: number;
  readWriteTest?: string;
  availableServers?: number;
  ttlSeconds?: number;
  error?: string;
}

export interface CacheDemoResponse {
  source: string;
  cacheStatus: string;
  cacheWriteStatus?: string;
  durationMs: number;
  data: DemoRecord[];
  cacheTtlSeconds: number;
  cacheKey: string;
}

export interface CacheStats {
  status: string;
  currentItems?: string;
  totalItems?: string;
  getHits?: string;
  getMisses?: string;
  bytesUsed?: string;
  maxBytes?: string;
  uptime?: string;
  version?: string;
  error?: string;
}

// UI State types

export interface RequestEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  status: number;
  instanceId: string;
  durationMs: number;
  method: string;
}

export interface CacheEvent {
  timestamp: string;
  type: 'HIT' | 'MISS' | 'ERROR';
  source: string;
  durationMs: number;
}

export type ServiceStatus = 'UP' | 'DOWN' | 'UNKNOWN' | 'LOADING';

export type PageId = 'overview' | 'servers' | 'database' | 'cache' | 'requests' | 'system';
