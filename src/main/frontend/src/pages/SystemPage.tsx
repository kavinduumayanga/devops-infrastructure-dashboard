import { useState, useEffect } from 'react';
import { Monitor, Cpu, MemoryStick, Server } from 'lucide-react';
import { fetchSystemInfo } from '../api';
import { SectionHeader, SkeletonCard, ErrorState, MetricRow } from '../components/ui';
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
        <SectionHeader title="System Information" subtitle="Runtime environment and JVM details." />
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
        <SectionHeader title="System Information" subtitle="Runtime environment and JVM details." />
        <ErrorState message={error || 'No data available'} onRetry={loadSystemInfo} />
      </div>
    );
  }

  const heapPercent = sysInfo.heapMaxMB > 0
    ? Math.round((sysInfo.heapUsedMB / sysInfo.heapMaxMB) * 100)
    : 0;

  return (
    <div>
      <SectionHeader title="System Information" subtitle="Runtime environment and JVM details." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instance Identity */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Server className="w-4 h-4 text-blue-400" />
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
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Operating System</h3>
          </div>
          <div className="space-y-0.5">
            <MetricRow label="OS" value={sysInfo.osName} />
            <MetricRow label="Version" value={sysInfo.osVersion} />
            <MetricRow label="Architecture" value={sysInfo.osArch} />
            <MetricRow label="Processors" value={sysInfo.availableProcessors} />
          </div>
        </div>

        {/* Java Runtime */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
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

        {/* Memory */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <MemoryStick className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">JVM Memory</h3>
          </div>

          {/* Memory bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500">Heap Usage</span>
              <span className="text-slate-300 font-mono">{sysInfo.heapUsedMB}MB / {sysInfo.heapMaxMB}MB</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  heapPercent > 80 ? 'bg-red-400' :
                  heapPercent > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${heapPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">{heapPercent}% utilized</p>
          </div>

          <div className="space-y-0.5">
            <MetricRow label="Committed" value={`${sysInfo.heapCommittedMB} MB`} mono />
            <MetricRow label="Free Memory" value={`${sysInfo.freeMemoryMB} MB`} mono />
            <MetricRow label="Total Memory" value={`${sysInfo.totalMemoryMB} MB`} mono />
            <MetricRow label="Max Memory" value={`${sysInfo.maxMemoryMB} MB`} mono />
          </div>
        </div>
      </div>
    </div>
  );
}
