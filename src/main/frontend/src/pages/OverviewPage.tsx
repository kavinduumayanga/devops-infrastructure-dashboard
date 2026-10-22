import { useState, useEffect, useMemo } from 'react';
import { Server, Database, HardDrive, ChevronRight, Activity } from 'lucide-react';
import { fetchInstance, fetchDatabaseHealth, fetchCacheHealth, fetchInfrastructureHealth, getRequestHistory } from '../api';
import { StatusCard, MetricRow, SkeletonCard, ErrorState, SectionHeader, Badge } from '../components/ui';
import InfraTopology, { type NodeStatusMap } from '../components/InfraTopology';
import type { InstanceInfo, DatabaseHealth, CacheHealth, InfrastructureHealth, ServiceStatus, RequestEntry } from '../types';

export default function OverviewPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [instanceRequestId, setInstanceRequestId] = useState<string | undefined>();
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<CacheHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recentRequests, setRecentRequests] = useState<RequestEntry[]>([]);
  const [infrastructureHealth, setInfrastructureHealth] = useState<InfrastructureHealth | null>(null);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    const poll = window.setInterval(loadInfrastructure, 15_000);
    return () => window.clearInterval(poll);
  }, []);

  async function loadInfrastructure() {
    try {
      const response = await fetchInfrastructureHealth();
      if (response.success) {
        setInfrastructureHealth(response.data);
        setMonitoringError(null);
      } else {
        setMonitoringError(response.error || 'Infrastructure monitoring request failed');
      }
    } catch (error: any) {
      setMonitoringError(error.message || 'Infrastructure monitoring request failed');
    }
  }

  async function loadAll() {
    setLoading(true);
    const errs: Record<string, string> = {};
    void loadInfrastructure();

    try {
      const res = await fetchInstance();
      if (res.success) {
        setInstance(res.data);
        setInstanceRequestId(res.requestId);
      }
    } catch (e: any) {
      errs.instance = e.message || 'Failed to connect';
    }

    try {
      const res = await fetchDatabaseHealth();
      if (res.success) setDbHealth(res.data);
    } catch (e: any) {
      errs.database = e.message || 'Failed to connect';
    }

    try {
      const res = await fetchCacheHealth();
      if (res.success) setCacheHealth(res.data);
    } catch (e: any) {
      errs.cache = e.message || 'Failed to connect';
    }

    setErrors(errs);
    setLoading(false);
    setRecentRequests(getRequestHistory().slice(0, 5));
  }

  // Derive statuses honestly
  const instanceStatus: ServiceStatus = errors.instance ? 'DOWN' : instance ? 'UP' : 'LOADING';
  const dbStatus: ServiceStatus = errors.database
    ? 'DOWN'
    : dbHealth?.status === 'UP'
      ? 'UP'
      : dbHealth
        ? 'DOWN'
        : 'LOADING';
  const cacheStatus: ServiceStatus = errors.cache
    ? 'DOWN'
    : cacheHealth?.status === 'UP'
      ? 'UP'
      : cacheHealth
        ? 'DOWN'
        : 'LOADING';

  // Build the topology only from the unified monitoring API. Browser-observed
  // responder identity remains a separate routing observation.
  const nodeStatuses: NodeStatusMap = useMemo(() => {
    const map: NodeStatusMap = {};
    infrastructureHealth?.services.forEach(service => {
      const details = Object.fromEntries(Object.entries(service.details || {}).map(([key, value]) => [
        key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      ]));
      map[service.id] = {
        status: service.status,
        lastCheckedAt: service.lastCheckedAt,
        lastSuccessfulAt: service.lastSuccessfulAt,
        latencyMs: service.latencyMs,
        monitoringType: service.monitoringType,
        error: service.error,
        extra: details,
      };
    });
    if (!infrastructureHealth) {
      ['web01', 'app01', 'app02', 'db01', 'mc01', 'rmq01', 'nfs01'].forEach(id => {
        map[id] = { status: monitoringError ? 'UNKNOWN' : 'CHECKING' };
      });
    }
    return map;
  }, [infrastructureHealth, monitoringError]);

  const currentResponderId = instance?.instanceId?.includes('app01')
    ? 'app01'
    : instance?.instanceId?.includes('app02')
      ? 'app02'
      : undefined;

  if (loading) {
    return (
      <div>
        <SectionHeader
          title="Overview"
          subtitle="Real-time visibility into a multi-tier Java application."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Overview"
        subtitle="Real-time visibility into a multi-tier Java application."
      />

      {/* Status summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {/* Application Instance */}
        {errors.instance ? (
          <ErrorState message={errors.instance} onRetry={loadAll} />
        ) : (
          <StatusCard
            title="Application Instance"
            status={instanceStatus}
            icon={<Server className="w-4 h-4" />}
          >
            <div className="space-y-0.5">
              <MetricRow label="Instance ID" value={<span className="font-mono text-cyan-400">{instance?.instanceId}</span>} />
              <MetricRow label="Hostname" value={instance?.hostname} mono />
              <MetricRow label="Container" value={instance?.servletContainerInfo || 'N/A'} />
              <MetricRow label="Environment" value={instance?.environment} />
              <MetricRow label="Uptime" value={instance?.uptime} />
            </div>
          </StatusCard>
        )}

        {/* MySQL Database */}
        {errors.database ? (
          <ErrorState message={errors.database} onRetry={loadAll} />
        ) : (
          <StatusCard
            title="MySQL Database"
            status={dbStatus}
            icon={<Database className="w-4 h-4" />}
          >
            <div className="space-y-0.5">
              <MetricRow label="Ping Latency" value={dbHealth?.pingLatencyMs != null ? `${dbHealth.pingLatencyMs}ms` : 'N/A'} mono />
              <MetricRow label="Database" value={dbHealth?.database} mono />
              <MetricRow label="Version" value={dbHealth?.version || 'N/A'} />
              <MetricRow
                label="Pool"
                value={
                  dbHealth?.connectionPool?.status === 'AVAILABLE'
                    ? `${dbHealth.connectionPool.activeConnections}/${dbHealth.connectionPool.totalConnections} active`
                    : 'Unavailable'
                }
                mono
              />
              {dbHealth?.recordCount != null && (
                <MetricRow label="Records" value={dbHealth.recordCount} />
              )}
            </div>
          </StatusCard>
        )}

        {/* Memcached */}
        {errors.cache ? (
          <ErrorState message={errors.cache} onRetry={loadAll} />
        ) : (
          <StatusCard
            title="Memcached"
            status={cacheStatus}
            icon={<HardDrive className="w-4 h-4" />}
          >
            <div className="space-y-0.5">
              <MetricRow label="Latency" value={cacheHealth?.latencyMs != null ? `${cacheHealth.latencyMs}ms` : 'N/A'} mono />
              <MetricRow label="Read/Write Test" value={cacheHealth?.readWriteTest || 'N/A'} />
              <MetricRow label="TTL" value={cacheHealth?.ttlSeconds != null ? `${cacheHealth.ttlSeconds}s` : 'N/A'} />
              <MetricRow label="Servers" value={cacheHealth?.availableServers ?? 'N/A'} />
              {cacheHealth?.error && (
                <MetricRow label="Error" value={<span className="text-red-400">{cacheHealth.error}</span>} />
              )}
            </div>
          </StatusCard>
        )}
      </div>

      {/* Infrastructure Topology — full width, prominent */}
      <div className="mb-6">
        {monitoringError && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-300" role="alert">
            Monitoring refresh failed: {monitoringError}. Existing node observations are preserved when available.
          </div>
        )}
        <InfraTopology
          nodeStatuses={nodeStatuses}
          currentResponderId={currentResponderId}
        />
      </div>

      {/* Recent activity summary */}
      {recentRequests.length > 0 && (
        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recent Activity</h3>
            </div>
            <span className="text-[10px] text-slate-600">Client-observed requests</span>
          </div>
          <div className="space-y-1.5">
            {recentRequests.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/20 text-xs">
                <span className="text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</span>
                <span className="font-mono text-slate-400">{r.endpoint}</span>
                <Badge variant="blue">{r.instanceId}</Badge>
                <span className={`font-mono ${r.status >= 200 && r.status < 400 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.status || 'ERR'}
                </span>
                <span className="text-slate-500 font-mono">{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
