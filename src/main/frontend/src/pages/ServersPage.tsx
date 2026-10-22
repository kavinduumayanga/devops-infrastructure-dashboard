import { useState, useEffect } from 'react';
import { Server, Send, BarChart3, Clock } from 'lucide-react';
import { fetchInstance, sendTestRequests, getRequestHistory } from '../api';
import { SectionHeader, StatusCard, MetricRow, Badge, SkeletonCard, InfoBadge } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getNodeById } from '../config/infrastructure';
import type { InstanceInfo, RequestEntry } from '../types';

export default function ServersPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<RequestEntry[]>([]);
  const [lbHistory, setLbHistory] = useState<RequestEntry[]>([]);

  // Configured metadata from infrastructure config
  const app01 = getNodeById('app01')!;
  const app02 = getNodeById('app02')!;

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

  // Get observations for the peer instance
  const currentId = instance?.instanceId;
  const peerId = currentId === 'app01' ? 'app02' : currentId === 'app02' ? 'app01' : undefined;
  const peerObservations = peerId
    ? getRequestHistory().filter(r => r.instanceId === peerId)
    : [];
  const lastPeerSeen = peerObservations.length > 0 ? peerObservations[0] : null;

  // Chart data
  const instanceCounts: Record<string, number> = {};
  lbHistory.forEach(r => {
    instanceCounts[r.instanceId] = (instanceCounts[r.instanceId] || 0) + 1;
  });
  const chartData = Object.entries(instanceCounts).map(([name, count]) => ({ name, count }));
  const chartColors = ['#22d3ee', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div>
      <SectionHeader
        title="Application Servers"
        subtitle="Instance identification and load balancing demonstration."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Current Responding Instance (app01 or app02) */}
        {loading ? <SkeletonCard /> : (
          <StatusCard
            title="Current Responding Instance"
            status={instance ? 'UP' : 'DOWN'}
            icon={<Server className="w-4 h-4" />}
          >
            <div className="space-y-0.5">
              <MetricRow
                label="Instance ID"
                value={<span className="font-mono text-cyan-400">{instance?.instanceId}</span>}
              />
              <MetricRow label="Hostname" value={instance?.hostname} mono />
              <MetricRow label="Configured IP" value={currentId === 'app01' ? app01.ip : currentId === 'app02' ? app02.ip : 'N/A'} mono />
              <MetricRow label="Java Runtime" value={instance?.javaVersion} />
              <MetricRow label="Environment" value={instance?.environment} />
              <MetricRow label="Uptime" value={instance?.uptime} />
              <MetricRow label="Container" value={instance?.servletContainerInfo || 'N/A'} />
              <MetricRow
                label="Last Response"
                value={instance?.timestamp ? new Date(instance.timestamp).toLocaleTimeString() : 'N/A'}
              />
            </div>
          </StatusCard>
        )}

        {/* Peer Instance */}
        <StatusCard
          title={`Peer Instance — ${peerId || 'Unknown'}`}
          status={lastPeerSeen ? (lastPeerSeen.status >= 200 && lastPeerSeen.status < 400 ? 'UP' : 'DOWN') : 'UNKNOWN'}
          icon={<Server className="w-4 h-4" />}
          action={
            <InfoBadge text={peerId
              ? 'Status is based on browser-observed responses. Not handling the current request does not mean this instance is down.'
              : 'Cannot identify peer instance.'
            } />
          }
        >
          <div className="space-y-0.5">
            {peerId ? (
              <>
                <MetricRow label="Instance ID" value={<span className="font-mono">{peerId}</span>} />
                <MetricRow label="Configured IP" value={peerId === 'app01' ? app01.ip : app02.ip} mono />
                <MetricRow label="Port" value={peerId === 'app01' ? String(app01.port) : String(app02.port)} mono />
                <MetricRow
                  label="Browser-Observed"
                  value={
                    lastPeerSeen
                      ? `Last seen ${new Date(lastPeerSeen.timestamp).toLocaleTimeString()}`
                      : 'No observations yet'
                  }
                />
                <MetricRow
                  label="Observed Requests"
                  value={peerObservations.length}
                />
              </>
            ) : (
              <p className="text-xs text-slate-500 py-2">Instance identity could not be determined from the current response.</p>
            )}
          </div>
        </StatusCard>
      </div>

      {/* Load Balancing Test */}
      <div className="surface-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Send className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Load Balancing Test</h3>
          </div>
          <button
            id="send-test-requests"
            onClick={handleTestRequests}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
              hover:bg-cyan-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testRunning ? (
              <>
                <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                Sending…
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
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/30 text-xs"
                style={{ animation: `slideUp 200ms ease-out ${i * 30}ms both` }}
              >
                <span className="text-slate-500 w-6">#{i + 1}</span>
                <Badge variant="cyan">{r.instanceId}</Badge>
                <span className="text-slate-400 font-mono">{r.durationMs}ms</span>
                <span className={`font-mono ${r.status === 200 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Distribution Chart */}
      {chartData.length > 0 && (
        <div className="surface-card p-5 mb-4">
          <div className="flex items-center gap-2.5 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Responses Observed by This Browser</h3>
          </div>
          <p className="text-[10px] text-slate-600 mb-4">
            Number of responses from each instance as observed by this browser session. Not global Nginx traffic statistics.
          </p>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={40}>
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
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent request history table */}
      {lbHistory.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Recent Instance Requests</h3>
            <Badge>{lbHistory.length} observed</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Request</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Instance</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Status</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Latency</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {lbHistory.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="py-2 px-4 text-slate-400 font-mono">{r.id}</td>
                    <td className="py-2 px-4">
                      <Badge variant="cyan">{r.instanceId}</Badge>
                    </td>
                    <td className="py-2 px-4">
                      <span className={`font-mono ${r.status === 200 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-400 font-mono">{r.durationMs}ms</td>
                    <td className="py-2 px-4 text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</td>
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
