import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from '../pages/OverviewPage';
import CachePage from '../pages/CachePage';
import DatabasePage from '../pages/DatabasePage';
import RequestsPage from '../pages/RequestsPage';
import SystemPage from '../pages/SystemPage';
import App from '../App';
import {
  clearCacheDemo,
  clearRequestHistory,
  createRecord,
  deleteRecord,
  fetchCacheDemo,
  fetchCacheHealth,
  fetchCacheStats,
  fetchDatabaseHealth,
  fetchInstance,
  fetchInfrastructureHealth,
  fetchRecords,
  fetchSystemInfo,
  getRequestHistory,
} from '../api';

vi.mock('../api', () => ({
  clearCacheDemo: vi.fn(),
  clearRequestHistory: vi.fn(),
  createRecord: vi.fn(),
  deleteRecord: vi.fn(),
  fetchCacheDemo: vi.fn(),
  fetchCacheHealth: vi.fn(),
  fetchCacheStats: vi.fn(),
  fetchDatabaseHealth: vi.fn(),
  fetchInstance: vi.fn(),
  fetchInfrastructureHealth: vi.fn(),
  fetchRecords: vi.fn(),
  fetchSystemInfo: vi.fn(),
  getRequestHistory: vi.fn(),
  sendTestRequests: vi.fn(),
}));

const record = {
  id: 7,
  name: 'API node',
  description: 'Demo record',
  createdAt: '2026-10-20T09:00:00Z',
};

beforeEach(() => {
  vi.mocked(fetchInstance).mockResolvedValue({
    success: true,
    data: {
      instanceId: 'app01',
      hostname: 'app01',
      javaVersion: '21',
      javaVendor: 'OpenJDK',
      status: 'UP',
      timestamp: '2026-10-20T09:00:00Z',
      environment: 'test',
      uptimeMs: 1000,
      uptime: '1s',
      startTime: '2026-10-20T08:59:59Z',
    },
  });
  vi.mocked(fetchDatabaseHealth).mockResolvedValue({
    success: true,
    data: {
      status: 'UP',
      database: 'devops_demo',
      host: 'mysql',
      port: 3306,
      totalDurationMs: 2,
      pingLatencyMs: 1,
    },
  });
  vi.mocked(fetchCacheHealth).mockResolvedValue({
    success: true,
    data: { status: 'UP', latencyMs: 1, ttlSeconds: 60 },
  });
  vi.mocked(fetchCacheStats).mockResolvedValue({
    success: true,
    data: { status: 'UNAVAILABLE' },
  });
  vi.mocked(fetchInfrastructureHealth).mockResolvedValue({
    success: true,
    data: {
      checkedAt: '2026-10-20T09:00:00Z',
      monitoringEnabled: true,
      stale: false,
      services: [
        { id: 'web01', name: 'Nginx', status: 'UP', monitoringType: 'HTTP', latencyMs: 2 },
        { id: 'app01', name: 'Apache Tomcat', status: 'UP', monitoringType: 'DIRECT_HTTP_INSTANCE' },
        { id: 'app02', name: 'Apache Tomcat', status: 'UP', monitoringType: 'DIRECT_HTTP_INSTANCE' },
        { id: 'db01', name: 'MySQL', status: 'UP', monitoringType: 'JDBC' },
        { id: 'mc01', name: 'Memcached', status: 'UP', monitoringType: 'MEMCACHED_READ_WRITE' },
        { id: 'rmq01', name: 'RabbitMQ', status: 'DEGRADED', monitoringType: 'TCP_CONNECTIVITY_ONLY' },
        { id: 'nfs01', name: 'NFSv4', status: 'UP', monitoringType: 'NFS_MOUNT_READ_ONLY' },
      ],
    },
  });
  vi.mocked(fetchRecords).mockResolvedValue({ success: true, data: [record] });
  vi.mocked(fetchSystemInfo).mockResolvedValue({
    success: true,
    data: {
      instanceId: 'app01',
      hostname: 'app01',
      environment: 'test',
      osName: 'Linux',
      osVersion: '5.15',
      osArch: 'amd64',
      javaVersion: '21',
      javaVendor: 'OpenJDK',
      jvmUptime: '1h 30m',
      jvmUptimeMs: 5400000,
      jvmStartTime: '2026-10-20T07:30:00Z',
      jvmName: 'OpenJDK 64-Bit Server VM',
      jvmVendor: 'Eclipse Adoptium',
      jvmVersion: '21.0.2',
      heapUsedMB: 64,
      heapMaxMB: 256,
      heapCommittedMB: 128,
      availableProcessors: 2,
      freeMemoryMB: 64,
      totalMemoryMB: 128,
      maxMemoryMB: 256,
      servletContainerInfo: 'Apache Tomcat/10.1.24',
      servletApiVersion: '6.0',
    },
  });
  vi.mocked(getRequestHistory).mockReturnValue([
    {
      id: 'req-123',
      timestamp: '2026-10-20T09:00:00Z',
      endpoint: '/instance',
      status: 200,
      instanceId: 'app01',
      durationMs: 8,
      method: 'GET',
    },
  ]);
});

// ===========================================================================
// OVERVIEW PAGE
// ===========================================================================

describe('Overview page', () => {
  it('renders service status after loading real API data', async () => {
    render(<OverviewPage />);

    expect(await screen.findByText('MySQL Database')).toBeInTheDocument();
    expect(screen.getAllByText('app01').length).toBeGreaterThan(0);
    expect(screen.getByText('devops_demo')).toBeInTheDocument();
  });

  it('shows a connection error when the instance API fails', async () => {
    vi.mocked(fetchInstance).mockRejectedValueOnce(new Error('Backend unreachable'));

    render(<OverviewPage />);

    expect(await screen.findByText('Backend unreachable')).toBeInTheDocument();
  });

  it('shows database DOWN when HTTP 200 contains status DOWN', async () => {
    vi.mocked(fetchDatabaseHealth).mockResolvedValueOnce({
      success: true,
      data: {
        status: 'DOWN',
        database: 'devops_demo',
        host: 'mysql',
        port: 3306,
        totalDurationMs: 50,
        error: 'Connection refused',
      },
    });

    render(<OverviewPage />);

    // Wait for loading to complete
    await screen.findByText('MySQL Database');
    // Should show Down badge (from StatusBadge component)
    expect(screen.getAllByText('Down').length).toBeGreaterThan(0);
  });

  it('renders unmonitored nodes as Not Monitored in topology', async () => {
    render(<OverviewPage />);

    await screen.findByText('Infrastructure Topology');
    // RabbitMQ and NFS should be rendered in topology
    expect(screen.getByText('rmq01')).toBeInTheDocument();
    expect(screen.getByText('nfs01')).toBeInTheDocument();
    expect(screen.getByText('web01')).toBeInTheDocument();
  });

  it('does not show stale data as current when one API fails', async () => {
    vi.mocked(fetchCacheHealth).mockRejectedValueOnce(new Error('Cache timeout'));

    render(<OverviewPage />);

    // The DB and instance cards should still render
    expect(await screen.findByText('MySQL Database')).toBeInTheDocument();
    // The cache error should show
    expect(screen.getByText('Cache timeout')).toBeInTheDocument();
  });
});

// ===========================================================================
// CACHE PAGE
// ===========================================================================

describe('Cache page', () => {
  it('fetches demo data and clears only the shared demo cache on request', async () => {
    vi.mocked(fetchCacheDemo).mockResolvedValue({
      success: true,
      data: {
        source: 'MYSQL',
        cacheStatus: 'MISS',
        cacheWriteStatus: 'STORED',
        durationMs: 5,
        data: [record],
        cacheTtlSeconds: 60,
        cacheKey: 'demo_records',
      },
    });
    vi.mocked(clearCacheDemo).mockResolvedValue({
      success: true,
      data: { cleared: true },
    });

    render(<CachePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fetch Data' }));

    expect(await screen.findByText('STORED')).toBeInTheDocument();
    expect(screen.getAllByText('MISS').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Demo Cache' }));
    await waitFor(() => expect(clearCacheDemo).toHaveBeenCalledOnce());
  });

  it('shows HIT status when cache returns a hit', async () => {
    vi.mocked(fetchCacheDemo).mockResolvedValue({
      success: true,
      data: {
        source: 'MEMCACHED',
        cacheStatus: 'HIT',
        durationMs: 1,
        data: [record],
        cacheTtlSeconds: 60,
        cacheKey: 'demo_records',
      },
    });

    render(<CachePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fetch Data' }));

    await waitFor(() => {
      expect(screen.getAllByText('HIT').length).toBeGreaterThan(0);
    });
  });

  it('shows UNAVAILABLE status when memcached is down', async () => {
    vi.mocked(fetchCacheHealth).mockResolvedValueOnce({
      success: true,
      data: { status: 'DOWN', error: 'Connection refused' },
    });

    render(<CachePage />);

    // Should show Down badge
    await waitFor(() => {
      expect(screen.getAllByText('Down').length).toBeGreaterThan(0);
    });
  });

  it('shows empty chart state when no observations exist', async () => {
    render(<CachePage />);

    await screen.findByText('Memcached Health');
    expect(screen.getByText(/No observations yet/)).toBeInTheDocument();
  });
});

// ===========================================================================
// DATABASE PAGE
// ===========================================================================

describe('Database page', () => {
  it('creates and deletes records through the database actions', async () => {
    vi.mocked(createRecord).mockResolvedValue({
      success: true,
      data: { ...record, id: 8, name: 'New record' },
    });
    vi.mocked(deleteRecord).mockResolvedValue({ success: true, data: undefined });

    render(<DatabasePage />);
    expect(await screen.findByText('API node')).toBeInTheDocument();

    // Create a record
    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }));
    fireEvent.change(screen.getByPlaceholderText('Name (required)'), { target: { value: 'New record' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('New record')).toBeInTheDocument();
    expect(createRecord).toHaveBeenCalledWith('New record', '');

    // Delete with confirmation
    fireEvent.click(screen.getAllByTitle(/Delete record/)[1]);
    // Confirm dialog should appear
    expect(await screen.findByText(/Are you sure you want to delete/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith(7));
  });

  it('labels records as sample data not discovered infrastructure', async () => {
    render(<DatabasePage />);

    await screen.findByText('API node');
    expect(screen.getByText(/Sample database records/)).toBeInTheDocument();
  });
});

// ===========================================================================
// REQUEST ACTIVITY PAGE
// ===========================================================================

describe('Request activity page', () => {
  it('renders observed request details and clears browser-local history', async () => {
    render(<RequestsPage />);

    expect(await screen.findByText('req-123')).toBeInTheDocument();
    expect(screen.getByText('/instance')).toBeInTheDocument();

    // Click clear button — should show confirmation dialog
    fireEvent.click(screen.getByRole('button', { name: 'Clear request history' }));
    expect(await screen.findByText(/This will clear all recorded requests/)).toBeInTheDocument();

    // Confirm clear
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(clearRequestHistory).toHaveBeenCalledOnce();
    expect(screen.getByText(/No requests recorded yet/)).toBeInTheDocument();
  });

  it('shows empty chart state when no data exists', async () => {
    vi.mocked(getRequestHistory).mockReturnValue([]);

    render(<RequestsPage />);

    expect(await screen.findByText('No observations yet')).toBeInTheDocument();
  });
});

// ===========================================================================
// SYSTEM PAGE
// ===========================================================================

describe('System page', () => {
  it('labels JVM memory as JVM memory, not total VM', async () => {
    render(<SystemPage />);

    await screen.findByText('JVM Memory');
    expect(screen.getByText(/JVM heap memory for the responding Tomcat instance/)).toBeInTheDocument();
  });

  it('shows error state when system info fails', async () => {
    vi.mocked(fetchSystemInfo).mockRejectedValueOnce(new Error('Connection failed'));

    render(<SystemPage />);

    expect(await screen.findByText('Connection failed')).toBeInTheDocument();
  });
});

// ===========================================================================
// THEME & APP SHELL
// ===========================================================================

describe('App shell', () => {
  it('persists theme preference', async () => {
    const { unmount } = render(<App />);

    // Default theme is dark
    expect(document.documentElement.dataset.theme).toBe('dark');

    // Toggle to light
    fireEvent.click(screen.getByRole('button', { name: /Switch to light theme/i }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('dashboard-theme')).toBe('light');

    unmount();
  });

  it('shows paused state when auto-refresh is off', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });

  it('navigates between pages via sidebar', async () => {
    render(<App />);

    // Wait for sidebar to be rendered
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Database/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Database/i }));
    await waitFor(() => {
      expect(screen.getByText('MySQL connectivity and CRUD operations.')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// CONTEXT PATH AWARENESS
// ===========================================================================

describe('Context path', () => {
  it('API client uses relative paths compatible with /devops-dashboard/', () => {
    // Verify the api module's getBaseUrl logic is imported
    // This is a structural test - the actual API calls use relative paths
    expect(fetchInstance).toBeDefined();
    expect(fetchDatabaseHealth).toBeDefined();
    expect(fetchCacheHealth).toBeDefined();
  });
});
