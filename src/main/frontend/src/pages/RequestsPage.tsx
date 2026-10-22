import { useState, useEffect } from 'react';
import { Activity, Trash2, BarChart3, Filter } from 'lucide-react';
import { getRequestHistory, clearRequestHistory } from '../api';
import { SectionHeader, Badge, EmptyState, ConfirmDialog } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import type { RequestEntry } from '../types';

export default function RequestsPage() {
  const [history, setHistory] = useState<RequestEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    refreshHistory();
    const interval = setInterval(refreshHistory, 2000);
    return () => clearInterval(interval);
  }, []);

  function refreshHistory() {
    setHistory([...getRequestHistory()]);
  }

  function handleClear() {
    clearRequestHistory();
    setHistory([]);
    setConfirmClear(false);
  }

  // Filtered history
  const filteredHistory = filter === 'all'
    ? history
    : filter === 'errors'
      ? history.filter(r => r.status >= 400 || r.status === 0)
      : history.filter(r => r.instanceId === filter);

  // Stats
  const totalRequests = history.length;
  const successCount = history.filter(r => r.status >= 200 && r.status < 400).length;
  const errorCount = history.filter(r => r.status >= 400 || r.status === 0).length;
  const avgLatency = totalRequests > 0
    ? Math.round(history.reduce((s, r) => s + r.durationMs, 0) / totalRequests)
    : 0;

  // Instance distribution
  const instanceCounts: Record<string, number> = {};
  history.forEach(r => {
    instanceCounts[r.instanceId] = (instanceCounts[r.instanceId] || 0) + 1;
  });
  const instanceChartData = Object.entries(instanceCounts).map(([name, count]) => ({ name, count }));
  const chartColors = ['#22d3ee', '#3b82f6', '#8b5cf6', '#34d399', '#fbbf24'];

  // Unique instances for filtering
  const uniqueInstances = [...new Set(history.map(r => r.instanceId))].filter(id => id !== 'unknown');

  // Latency time series (last 20)
  const latencyData = history.slice(0, 20).reverse().map((r, i) => ({
    index: i + 1,
    latency: r.durationMs,
    status: r.status >= 200 && r.status < 400 ? 'ok' : 'error',
  }));

  return (
    <div>
      <SectionHeader
        title="Request Activity"
        subtitle="Client-observed request history and response metrics from this browser session."
      />

      {/* Confirm clear dialog */}
      <ConfirmDialog
        open={confirmClear}
        title="Clear Request History"
        message="This will clear all recorded requests from this browser session. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-bold text-slate-200">{totalRequests}</p>
          <p className="text-xs text-slate-500 mt-1">Total Requests</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
          <p className="text-xs text-slate-500 mt-1">Successful</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{errorCount}</p>
          <p className="text-xs text-slate-500 mt-1">Errors</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{avgLatency}ms</p>
          <p className="text-xs text-slate-500 mt-1">Avg Latency</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {instanceChartData.length > 0 ? (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Requests by Instance</h3>
            </div>
            <p className="text-[10px] text-slate-600 mb-3">Client-observed request distribution</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instanceChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-3)',
                      border: '1px solid var(--border-hover)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {instanceChartData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="surface-card p-5 flex items-center justify-center">
            <p className="text-xs text-slate-500">No observations yet</p>
          </div>
        )}

        {latencyData.length > 0 ? (
          <div className="surface-card p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Response Latency</h3>
            </div>
            <p className="text-[10px] text-slate-600 mb-3">Client-measured response times (last 20)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
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
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={{ fill: '#22d3ee', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="surface-card p-5 flex items-center justify-center">
            <p className="text-xs text-slate-500">No latency data yet</p>
          </div>
        )}
      </div>

      {/* Request Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Recent Requests</h3>
          <div className="flex items-center gap-2">
            {/* Instance filter */}
            {uniqueInstances.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-slate-500" />
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="text-[10px] bg-[var(--surface-3)] border border-[var(--border-default)] rounded-lg px-2 py-1 text-slate-400 focus:outline-none focus:border-cyan-500/50"
                  aria-label="Filter requests by instance"
                >
                  <option value="all">All</option>
                  <option value="errors">Errors only</option>
                  {uniqueInstances.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
            )}
            <Badge>{filteredHistory.length} requests</Badge>
            {history.length > 0 && (
              <button
                id="clear-request-history"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                  text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="Clear request history"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-8">
            <EmptyState message="No requests recorded yet. Navigate the dashboard to start recording." icon={<Activity className="w-6 h-6" />} />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--surface-2)]">
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Time</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Request ID</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Method</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Endpoint</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Instance</th>
                  <th className="text-right py-2.5 px-4 text-slate-500 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/20 hover:bg-slate-800/10 transition-colors">
                    <td className="py-2 px-4 text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 px-4 text-slate-400 font-mono">{r.id}</td>
                    <td className="py-2 px-4">
                      <Badge variant={r.method === 'GET' ? 'cyan' : r.method === 'POST' ? 'green' : 'red'}>
                        {r.method}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-slate-300 font-mono">{r.endpoint}</td>
                    <td className="py-2 px-4">
                      <span className={`font-mono ${
                        r.status >= 200 && r.status < 400 ? 'text-emerald-400' :
                        r.status === 0 ? 'text-slate-500' : 'text-red-400'
                      }`}>
                        {r.status || 'ERR'}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant="cyan">{r.instanceId}</Badge>
                    </td>
                    <td className="py-2 px-4 text-right text-slate-400 font-mono">{r.durationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-600 text-center mt-3">
        All metrics shown are client-observed measurements from this browser session.
      </p>
    </div>
  );
}
