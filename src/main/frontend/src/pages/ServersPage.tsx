import { useState, useEffect, useCallback } from 'react';
import { Server, Send, BarChart3 } from 'lucide-react';
import { fetchInstance, sendTestRequests, getRequestHistory } from '../api';
import { SectionHeader, StatusCard, MetricRow, Badge, SkeletonCard } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { InstanceInfo, RequestEntry } from '../types';

export default function ServersPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<RequestEntry[]>([]);
  const [lbHistory, setLbHistory] = useState<RequestEntry[]>([]);

  useEffect(() => {
    loadInstance();
  }, []);

  async function loadInstance() {
    setLoading(true);
    try {
      const res = await fetchInstance();
      if (res.success) setInstance(res.data);
    } catch (e) {
      console.error('Failed to load instance', e);
    }
    setLoading(false);
    // Update LB history from request history
    setLbHistory(getRequestHistory().filter(r => r.endpoint === '/instance'));
  }

  async function handleTestRequests() {
    setTestRunning(true);
    setTestResults([]);
    try {
      const results = await sendTestRequests(10);
      setTestResults(results);
      setLbHistory(getRequestHistory().filter(r => r.endpoint === '/instance'));
    } catch (e) {
      console.error('Test requests failed', e);
    }
    setTestRunning(false);
  }

  // Compute instance distribution chart data
  const instanceCounts: Record<string, number> = {};
  lbHistory.forEach(r => {
    instanceCounts[r.instanceId] = (instanceCounts[r.instanceId] || 0) + 1;
  });
  const chartData = Object.entries(instanceCounts).map(([name, count]) => ({ name, count }));
  const chartColors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981'];

  return (
    <div>
      <SectionHeader
        title="Application Servers"
        subtitle="Instance identification and load balancing demonstration."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Current Instance */}
        {loading ? <SkeletonCard /> : (
          <StatusCard
            title="Current Responding Instance"
            status={instance ? 'UP' : 'DOWN'}
            icon={<Server className="w-4 h-4" />}
          >
            <div className="space-y-0.5">
              <MetricRow label="Instance ID" value={<span className="font-mono text-blue-400">{instance?.instanceId}</span>} />
              <MetricRow label="Hostname" value={instance?.hostname} mono />
              <MetricRow label="Java Runtime" value={instance?.javaVersion} />
              <MetricRow label="Environment" value={instance?.environment} />
              <MetricRow label="Uptime" value={instance?.uptime} />
              <MetricRow label="Timestamp" value={instance?.timestamp ? new Date(instance.timestamp).toLocaleTimeString() : 'N/A'} />
            </div>
          </StatusCard>
        )}

        {/* Load Balancing Test */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Load Balancing Test</h3>
            </div>
            <button
              id="send-test-requests"
              onClick={handleTestRequests}
              disabled={testRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                bg-blue-500/10 text-blue-400 border border-blue-500/20
                hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testRunning ? (
                <>
                  <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  Send 10 Test Requests
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Send sequential requests to observe Nginx round-robin distribution between Tomcat instances.
          </p>

          {/* Test results */}
          {testResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {testResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-800/50 rounded-md text-xs animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="text-slate-500">#{i + 1}</span>
                  <Badge variant="blue">{r.instanceId}</Badge>
                  <span className="text-slate-400 font-mono">{r.durationMs}ms</span>
                  <span className={`${r.status === 200 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribution Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Client-Observed Instance Distribution</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Number of responses from each instance as observed by the dashboard client. Not global Nginx traffic statistics.
          </p>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={40}>
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
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent request history */}
      {lbHistory.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 mt-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Recent Instance Requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Request</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Instance</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Latency</th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {lbHistory.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 px-2 text-slate-400 font-mono">{r.id}</td>
                    <td className="py-2 px-2">
                      <Badge variant="blue">{r.instanceId}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      <span className={r.status === 200 ? 'text-emerald-400' : 'text-red-400'}>{r.status}</span>
                    </td>
                    <td className="py-2 px-2 text-slate-400 font-mono">{r.durationMs}ms</td>
                    <td className="py-2 px-2 text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
