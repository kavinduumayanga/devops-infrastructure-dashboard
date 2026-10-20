import type {
  ApiResponse,
  InstanceInfo,
  SystemInfo,
  DatabaseHealth,
  DemoRecord,
  CacheHealth,
  CacheDemoResponse,
  CacheStats,
  RequestEntry,
} from './types';

/**
 * Resolves the API base URL, handling WAR context path.
 * In dev mode, Vite proxy handles /api → Tomcat.
 * In production, the frontend is served from the WAR, so we use relative URLs.
 */
function getBaseUrl(): string {
  // If served from Tomcat (production), use relative path
  // The Vite build uses ./ as base, so API calls should be relative
  if (import.meta.env.DEV) {
    return '';
  }
  // In production WAR deployment, determine context path from current URL
  const path = window.location.pathname;
  // Find the context path: everything before /index.html or /assets/ or root
  const match = path.match(/^(\/[^/]+)\//);
  if (match) {
    return match[1];
  }
  return '';
}

const BASE_URL = getBaseUrl();

// Request history (bounded to last 50)
const MAX_HISTORY = 50;
let requestHistory: RequestEntry[] = [];
let instanceRequest: Promise<ApiResponse<InstanceInfo>> | null = null;

function addToHistory(entry: RequestEntry) {
  requestHistory = [entry, ...requestHistory].slice(0, MAX_HISTORY);
}

export function getRequestHistory(): RequestEntry[] {
  return requestHistory;
}

export function clearRequestHistory(): void {
  requestHistory = [];
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}/api${endpoint}`;
  const start = performance.now();
  let status = 0;

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    status = response.status;
    const data = await response.json();
    const durationMs = Math.round(performance.now() - start);

    // Track request
    addToHistory({
      id: data.requestId || crypto.randomUUID().substring(0, 8),
      timestamp: new Date().toISOString(),
      endpoint,
      status,
      instanceId: data.instanceId || response.headers.get('X-App-Instance') || 'unknown',
      durationMs,
      method: options.method || 'GET',
    });

    return data;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);

    addToHistory({
      id: crypto.randomUUID().substring(0, 8),
      timestamp: new Date().toISOString(),
      endpoint,
      status: status || 0,
      instanceId: 'unknown',
      durationMs,
      method: options.method || 'GET',
    });

    throw error;
  }
}

// === Instance APIs ===

export async function fetchInstance(): Promise<ApiResponse<InstanceInfo>> {
  if (!instanceRequest) {
    instanceRequest = apiCall<InstanceInfo>('/instance').finally(() => {
      instanceRequest = null;
    });
  }
  return instanceRequest;
}

export async function fetchSystemInfo(): Promise<ApiResponse<SystemInfo>> {
  return apiCall<SystemInfo>('/system');
}

// === Database APIs ===

export async function fetchDatabaseHealth(): Promise<ApiResponse<DatabaseHealth>> {
  return apiCall<DatabaseHealth>('/database/health');
}

export async function fetchRecords(): Promise<ApiResponse<DemoRecord[]>> {
  return apiCall<DemoRecord[]>('/records');
}

export async function createRecord(name: string, description: string): Promise<ApiResponse<DemoRecord>> {
  return apiCall<DemoRecord>('/records', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteRecord(id: number): Promise<ApiResponse<void>> {
  return apiCall<void>(`/records/${id}`, {
    method: 'DELETE',
  });
}

// === Cache APIs ===

export async function fetchCacheHealth(): Promise<ApiResponse<CacheHealth>> {
  return apiCall<CacheHealth>('/cache/health');
}

export async function fetchCacheDemo(): Promise<ApiResponse<CacheDemoResponse>> {
  return apiCall<CacheDemoResponse>('/cache/demo');
}

export async function clearCacheDemo(): Promise<ApiResponse<{ cleared: boolean }>> {
  return apiCall<{ cleared: boolean }>('/cache/demo', {
    method: 'DELETE',
  });
}

export async function fetchCacheStats(): Promise<ApiResponse<CacheStats>> {
  return apiCall<CacheStats>('/cache/stats');
}

// === Load Balancing Test ===

export async function sendTestRequests(count: number): Promise<RequestEntry[]> {
  const results: RequestEntry[] = [];
  const boundedCount = Math.max(0, Math.min(Math.floor(count), 10));
  for (let i = 0; i < boundedCount; i++) {
    try {
      const response = await fetchInstance();
      const lastEntry = requestHistory[0];
      if (lastEntry) {
        results.push(lastEntry);
      }
    } catch {
      // Still track failures
      const lastEntry = requestHistory[0];
      if (lastEntry) {
        results.push(lastEntry);
      }
    }
    // Small delay to avoid overwhelming
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return results;
}
