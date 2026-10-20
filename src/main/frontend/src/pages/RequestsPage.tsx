import { useState, useEffect } from 'react';
import { Activity, Trash2, BarChart3 } from 'lucide-react';
import { getRequestHistory, clearRequestHistory } from '../api';
import { SectionHeader, Badge, EmptyState } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import type { RequestEntry } from '../types';

export default function RequestsPage() {
  const [history, setHistory] = useState<RequestEntry[]>([]);

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
  }

  // Compute stats
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
  const chartColors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];

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
        subtitle="Client-observed request history and response metrics."
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-200">{totalRequests}</p>
          <p className="text-xs text-slate-500 mt-1">Total Requests</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
          <p className="text-xs text-slate-500 mt-1">Successful</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{errorCount}</p>
          <p className="text-xs text-slate-500 mt-1">Errors</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{avgLatency}ms</p>
          <p className="text-xs text-slate-500 mt-1">Avg Latency</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {instanceChartData.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Requests by Instance</h3>
            </div>
            <p className="text-[10px] text-slate-600 mb-3">Client-observed request distribution</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instanceChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a2332',
                      border: '1px solid #334155',
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
        )}

        {latencyData.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Response Latency</h3>
            </div>
            <p className="text-[10px] text-slate-600 mb-3">Client-measured response times (last 20)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="index" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a2332',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Request Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Recent Requests</h3>
          <div className="flex items-center gap-2">
            <Badge variant="default">{history.length} requests</Badge>
            {history.length > 0 && (
              <button
                id="clear-request-history"
                onClick={handleClear}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
                  text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-8">
            <EmptyState message="No requests recorded yet. Navigate the dashboard to start recording." />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Time</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Request ID</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Method</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Endpoint</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Instance</th>
                  <th className="text-right py-2.5 px-4 text-slate-500 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 px-4 text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2 px-4 text-slate-400 font-mono">{r.id}</td>
                    <td className="py-2 px-4">
                      <Badge variant={r.method === 'GET' ? 'blue' : r.method === 'POST' ? 'green' : 'red'}>
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
                      <Badge variant="blue">{r.instanceId}</Badge>
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
