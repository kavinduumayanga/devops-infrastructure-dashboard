import { useState, useEffect } from 'react';
import { Monitor, Cpu, MemoryStick, Server, RefreshCw } from 'lucide-react';
import { fetchSystemInfo } from '../api';
import { SectionHeader, SkeletonCard, ErrorState, MetricRow, ProgressBar } from '../components/ui';
import type { SystemInfo } from '../types';

export default function SystemPage() {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  async function loadSystemInfo() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSystemInfo();
      if (res.success) setSysInfo(res.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load system info');
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div>
        <SectionHeader title="System Information" subtitle="Runtime environment and JVM details for the responding instance." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || !sysInfo) {
    return (
      <div>
        <SectionHeader title="System Information" subtitle="Runtime environment and JVM details for the responding instance." />
        <ErrorState message={error || 'No data available'} onRetry={loadSystemInfo} />
      </div>
    );
  }

  const heapPercent = sysInfo.heapMaxMB > 0
    ? Math.round((sysInfo.heapUsedMB / sysInfo.heapMaxMB) * 100)
    : 0;

  const heapColor: 'emerald' | 'amber' | 'red' =
    heapPercent > 80 ? 'red' : heapPercent > 60 ? 'amber' : 'emerald';

  return (
    <div>
      <SectionHeader
        title="System Information"
        subtitle="Runtime environment and JVM details for the responding instance."
        action={
          <button
            onClick={loadSystemInfo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-slate-700/30 text-slate-300 border border-slate-600/50
              hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instance Identity */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Server className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Instance Identity</h3>
          </div>
          <div className="space-y-0.5">
            <MetricRow label="Hostname" value={sysInfo.hostname} mono />
            <MetricRow label="Instance ID" value={sysInfo.instanceId} mono />
            <MetricRow label="Environment" value={sysInfo.environment} />
            <MetricRow label="Servlet Container" value={sysInfo.servletContainerInfo || 'N/A'} />
            <MetricRow label="Servlet API" value={sysInfo.servletApiVersion || 'N/A'} />
          </div>
        </div>

        {/* Operating System */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Monitor className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Operating System</h3>
          </div>
          <div className="space-y-0.5">
            <MetricRow label="OS" value={sysInfo.osName} />
            <MetricRow label="Version" value={sysInfo.osVersion} />
            <MetricRow label="Architecture" value={sysInfo.osArch} />
            <MetricRow label="Processors" value={`${sysInfo.availableProcessors} cores`} />
          </div>
        </div>

        {/* Java Runtime */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-200">Java Runtime</h3>
          </div>
          <div className="space-y-0.5">
            <MetricRow label="Java Version" value={sysInfo.javaVersion} />
            <MetricRow label="Java Vendor" value={sysInfo.javaVendor} />
            <MetricRow label="JVM Name" value={sysInfo.jvmName} />
            <MetricRow label="JVM Version" value={sysInfo.jvmVersion} />
            <MetricRow label="JVM Uptime" value={sysInfo.jvmUptime} />
            <MetricRow label="JVM Start" value={sysInfo.jvmStartTime ? new Date(sysInfo.jvmStartTime).toLocaleString() : 'N/A'} />
          </div>
        </div>

        {/* JVM Memory */}
        <div className="surface-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <MemoryStick className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">JVM Memory</h3>
          </div>

          {/* Memory bar */}
          <div className="mb-4">
            <ProgressBar
              value={sysInfo.heapUsedMB}
              max={sysInfo.heapMaxMB}
              label="Heap Usage"
              color={heapColor}
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>{sysInfo.heapUsedMB} MB used</span>
              <span>{sysInfo.heapMaxMB} MB max</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <MetricRow label="Committed" value={`${sysInfo.heapCommittedMB} MB`} mono />
            <MetricRow label="Free Memory" value={`${sysInfo.freeMemoryMB} MB`} mono />
            <MetricRow label="Total Memory" value={`${sysInfo.totalMemoryMB} MB`} mono />
            <MetricRow label="Max Memory" value={`${sysInfo.maxMemoryMB} MB`} mono />
          </div>

          <p className="text-[10px] text-slate-600 mt-3 border-t border-slate-800/30 pt-2">
            JVM heap memory for the responding Tomcat instance — not total VM or cluster memory.
          </p>
        </div>
      </div>
    </div>
  );
}
