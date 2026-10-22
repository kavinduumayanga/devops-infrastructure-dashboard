import { useState, useEffect } from 'react';
import { HardDrive, Download, Trash2, RotateCcw, BarChart3, Info } from 'lucide-react';
import { fetchCacheHealth, fetchCacheDemo, clearCacheDemo, fetchCacheStats } from '../api';
import {
  SectionHeader, StatusCard, MetricRow, SkeletonCard, ErrorState, Badge, Toast,
} from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CacheHealth, CacheDemoResponse, CacheStats, CacheEvent } from '../types';

export default function CachePage() {
  const [cacheHealth, setCacheHealth] = useState<CacheHealth | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [lastDemo, setLastDemo] = useState<CacheDemoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Local hit/miss tracking
  const [cacheEvents, setCacheEvents] = useState<CacheEvent[]>([]);
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetchCacheHealth(),
        fetchCacheStats(),
      ]);
      if (healthRes.success) setCacheHealth(healthRes.data);
      if (statsRes.success) setCacheStats(statsRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to connect to backend');
    }
    setLoading(false);
  }

  async function handleFetchData() {
    setDemoLoading(true);
    try {
      const res = await fetchCacheDemo();
      if (res.success) {
        const demo = res.data;
        setLastDemo(demo);

        const event: CacheEvent = {
          timestamp: new Date().toISOString(),
          type: demo.cacheStatus === 'HIT' ? 'HIT' : demo.cacheStatus === 'MISS' ? 'MISS' : 'ERROR',
          source: demo.source,
          durationMs: demo.durationMs,
        };
        setCacheEvents(prev => [event, ...prev].slice(0, 50));

        if (demo.cacheStatus === 'HIT') {
          setHitCount(c => c + 1);
        } else if (demo.cacheStatus === 'MISS') {
          setMissCount(c => c + 1);
        }

        showNotif(
          demo.cacheStatus === 'UNAVAILABLE'
            ? `Memcached unavailable — data served from ${demo.source} in ${demo.durationMs}ms`
            : `Cache ${demo.cacheStatus}: Data from ${demo.source} in ${demo.durationMs}ms`,
          demo.cacheStatus === 'UNAVAILABLE' || demo.cacheStatus === 'ERROR' ? 'error' : 'success',
        );
      } else {
        showNotif(res.error || 'Cache demo failed', 'error');
      }
    } catch (e) {
      showNotif(e instanceof Error ? e.message : 'Cache demo failed', 'error');
    }
    setDemoLoading(false);
  }

  async function handleClearCache() {
    try {
      const res = await clearCacheDemo();
      if (res.success) {
        showNotif('Demo cache cleared', 'success');
      } else {
        showNotif(res.error || 'Failed to clear cache', 'error');
      }
    } catch {
      showNotif('Failed to clear cache', 'error');
    }
  }

  function handleResetStats() {
    setHitCount(0);
    setMissCount(0);
    setCacheEvents([]);
    setLastDemo(null);
    showNotif('Local statistics reset', 'info');
  }

  function showNotif(msg: string, type: 'success' | 'error' | 'info') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  // Chart data
  const eventChartData = cacheEvents.slice(0, 20).reverse().map((e, i) => ({
    index: i + 1,
    duration: e.durationMs,
    type: e.type,
  }));

  if (loading) {
    return (
      <div>
        <SectionHeader title="Cache" subtitle="Memcached integration and cache-aside pattern demonstration." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Cache" subtitle="Memcached integration and cache-aside pattern demonstration." />
        <ErrorState message={error} onRetry={loadAll} />
      </div>
    );
  }

  const cacheStatus = cacheHealth?.status === 'UP' ? 'UP' as const : 'DOWN' as const;

  return (
    <div>
      <SectionHeader title="Cache" subtitle="Memcached integration and cache-aside pattern demonstration." />

      {/* Toast */}
      {notification && (
        <div className="mb-4">
          <Toast message={notification.msg} type={notification.type} onDismiss={() => setNotification(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Cache Health */}
        <StatusCard
          title="Memcached Health"
          status={cacheStatus}
          icon={<HardDrive className="w-4 h-4" />}
        >
          <div className="space-y-0.5">
            <MetricRow label="Status" value={cacheHealth?.status} />
            <MetricRow label="Latency" value={cacheHealth?.latencyMs != null ? `${cacheHealth.latencyMs}ms` : 'N/A'} mono />
            <MetricRow label="R/W Test" value={cacheHealth?.readWriteTest || 'N/A'} />
            <MetricRow label="TTL" value={cacheHealth?.ttlSeconds != null ? `${cacheHealth.ttlSeconds}s` : 'N/A'} />
            <MetricRow label="Servers" value={cacheHealth?.availableServers ?? 'N/A'} />
            {cacheHealth?.error && (
              <MetricRow label="Error" value={<span className="text-red-400">{cacheHealth.error}</span>} />
            )}
          </div>
        </StatusCard>

        {/* Cache Demo Panel */}
        <div className="xl:col-span-2 surface-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Cache-Aside Pattern Demo</h3>
          <div className="flex items-start gap-1.5 mb-4">
            <Info className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">
              The application uses a cache-aside pattern: on a request, it checks Memcached first.
              On a <Badge variant="amber">MISS</Badge>, it queries MySQL, returns the data, and writes
              it to Memcached. Subsequent requests get a <Badge variant="green">HIT</Badge> from cache
              until the TTL expires or the cache is cleared. Memcached does not query MySQL itself.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              id="fetch-cache-data"
              onClick={handleFetchData}
              disabled={demoLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
                hover:bg-cyan-500/15 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {demoLoading ? 'Fetching…' : 'Fetch Data'}
            </button>
            <button
              id="clear-demo-cache"
              onClick={handleClearCache}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-amber-500/10 text-amber-400 border border-amber-500/20
                hover:bg-amber-500/15 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Demo Cache
            </button>
            <button
              id="reset-cache-stats"
              onClick={handleResetStats}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-slate-700/30 text-slate-300 border border-slate-600/50
                hover:bg-slate-700/50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Local Statistics
            </button>
          </div>

          {/* Last demo result */}
          {lastDemo && (
            <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-3)]" style={{ animation: 'slideUp 200ms ease-out' }}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Data Source</span>
                  <p className="text-xs font-medium mt-0.5">
                    <Badge variant={lastDemo.source === 'MEMCACHED' ? 'green' : 'blue'}>
                      {lastDemo.source}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Cache Result</span>
                  <p className="text-xs font-medium mt-0.5">
                    <Badge
                      variant={
                        lastDemo.cacheStatus === 'HIT' ? 'green'
                          : lastDemo.cacheStatus === 'MISS' ? 'amber'
                            : 'red'
                      }
                    >
                      {lastDemo.cacheStatus}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Cache Write</span>
                  <p className="text-xs font-medium mt-0.5 text-slate-300">
                    {lastDemo.cacheWriteStatus || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Duration</span>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">{lastDemo.durationMs}ms</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">TTL</span>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">{lastDemo.cacheTtlSeconds}s</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Hit/Miss Distribution */}
        {(hitCount > 0 || missCount > 0) ? (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Hit/Miss Distribution</h3>
            </div>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{hitCount}</p>
                <p className="text-xs text-slate-500">Cache Hits</p>
              </div>
              <div className="h-16 w-px bg-[var(--border-default)]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{missCount}</p>
                <p className="text-xs text-slate-500">Cache Misses</p>
              </div>
              <div className="h-16 w-px bg-[var(--border-default)]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-300">
                  {hitCount + missCount > 0 ? Math.round((hitCount / (hitCount + missCount)) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-500">Hit Rate</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 text-center mt-3">
              Client-observed statistics for this browser session
            </p>
          </div>
        ) : (
          <div className="surface-card p-5 flex items-center justify-center">
            <p className="text-xs text-slate-500">No observations yet. Click "Fetch Data" to start.</p>
          </div>
        )}

        {/* Response Time Chart */}
        {eventChartData.length > 0 ? (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Response Latency</h3>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChartData} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="index" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-3)',
                      border: '1px solid var(--border-hover)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="duration" radius={[2, 2, 0, 0]}>
                    {eventChartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.type === 'HIT' ? '#34d399' : entry.type === 'ERROR' ? '#f87171' : '#fbbf24'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Hit
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Miss
              </span>
              {cacheEvents.some(event => event.type === 'ERROR') && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Unavailable
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="surface-card p-5 flex items-center justify-center">
            <p className="text-xs text-slate-500">No latency data yet</p>
          </div>
        )}
      </div>

      {/* Cache Server Stats */}
      {cacheStats && cacheStats.status === 'AVAILABLE' && (
        <div className="surface-card p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Memcached Server Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Version</span>
              <p className="text-xs font-mono text-slate-300 mt-0.5">{cacheStats.version}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Current Items</span>
              <p className="text-xs font-mono text-slate-300 mt-0.5">{cacheStats.currentItems}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Server Hits</span>
              <p className="text-xs font-mono text-emerald-400 mt-0.5">{cacheStats.getHits}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Server Misses</span>
              <p className="text-xs font-mono text-amber-400 mt-0.5">{cacheStats.getMisses}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cache Events Log */}
      {cacheEvents.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Cache Events Log</h3>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {cacheEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/15 text-xs">
                <span className="text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <Badge variant={e.type === 'HIT' ? 'green' : e.type === 'ERROR' ? 'red' : 'amber'}>{e.type}</Badge>
                <span className="text-slate-400">{e.source}</span>
                <span className="text-slate-400 font-mono">{e.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
