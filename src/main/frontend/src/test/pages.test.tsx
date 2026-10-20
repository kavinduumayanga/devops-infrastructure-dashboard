import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OverviewPage from '../pages/OverviewPage';
import CachePage from '../pages/CachePage';
import DatabasePage from '../pages/DatabasePage';
import RequestsPage from '../pages/RequestsPage';
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
  fetchRecords,
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
  fetchRecords: vi.fn(),
  getRequestHistory: vi.fn(),
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
  vi.mocked(fetchRecords).mockResolvedValue({ success: true, data: [record] });
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
});

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
});

describe('Database page', () => {
  it('creates and deletes records through the database actions', async () => {
    vi.mocked(createRecord).mockResolvedValue({
      success: true,
      data: { ...record, id: 8, name: 'New record' },
    });
    vi.mocked(deleteRecord).mockResolvedValue({ success: true, data: undefined });

    render(<DatabasePage />);
    expect(await screen.findByText('API node')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Record' }));
    fireEvent.change(screen.getByPlaceholderText('Name (required)'), { target: { value: 'New record' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('New record')).toBeInTheDocument();
    expect(createRecord).toHaveBeenCalledWith('New record', '');

    fireEvent.click(screen.getAllByTitle('Delete record')[1]);
    await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith(7));
  });
});

describe('Request activity page', () => {
  it('renders observed request details and clears browser-local history', async () => {
    render(<RequestsPage />);

    expect(await screen.findByText('req-123')).toBeInTheDocument();
    expect(screen.getByText('/instance')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(clearRequestHistory).toHaveBeenCalledOnce();
    expect(screen.getByText(/No requests recorded yet/)).toBeInTheDocument();
  });
});
