import { useState, useEffect, useMemo } from 'react';
import { Server, Database, HardDrive, ChevronRight, Activity } from 'lucide-react';
import { fetchInstance, fetchDatabaseHealth, fetchCacheHealth, getRequestHistory } from '../api';
import { StatusCard, MetricRow, SkeletonCard, ErrorState, SectionHeader, Badge } from '../components/ui';
import InfraTopology, { type NodeStatusMap } from '../components/InfraTopology';
import type { InstanceInfo, DatabaseHealth, CacheHealth, ServiceStatus, RequestEntry } from '../types';

export default function OverviewPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [instanceRequestId, setInstanceRequestId] = useState<string | undefined>();
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<CacheHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [recentRequests, setRecentRequests] = useState<RequestEntry[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const errs: Record<string, string> = {};

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

  // Build node status map for topology
  const nodeStatuses: NodeStatusMap = useMemo(() => {
    const map: NodeStatusMap = {};

    // Nginx: not monitored — we can infer it's routing if we got a response
    map['web01'] = { status: 'UNKNOWN' };

    // Current Tomcat (the one that responded)
    if (instance) {
      const responderId = instance.instanceId;
      // Try to match instance to configured app servers
      if (responderId.includes('app01') || responderId.includes('app02')) {
        map[responderId] = {
          status: instanceStatus,
          version: instance.servletContainerInfo,
          extra: {
            'Java': instance.javaVersion,
            'Environment': instance.environment,
            'Uptime': instance.uptime,
          },
        };
        // Peer: we don't know its state — it's just "not currently responding"
        const peerId = responderId === 'app01' ? 'app02' : 'app01';
        // Check request history for any observation of the peer
        const peerObservations = getRequestHistory().filter(r => r.instanceId === peerId);
        if (peerObservations.length > 0) {
          const lastPeer = peerObservations[0];
          map[peerId] = {
            status: lastPeer.status >= 200 && lastPeer.status < 400 ? 'UP' : 'UNKNOWN',
            lastSeen: lastPeer.timestamp,
          };
        } else {
          map[peerId] = { status: 'UNKNOWN' };
        }
      } else {
        // Unknown instance id — put both as unknown
        map['app01'] = { status: instanceStatus, extra: { 'Instance': responderId } };
        map['app02'] = { status: 'UNKNOWN' };
      }
    } else {
      map['app01'] = { status: instanceStatus };
      map['app02'] = { status: 'UNKNOWN' };
    }

    // MySQL
    map['db01'] = {
      status: dbStatus,
      latencyMs: dbHealth?.pingLatencyMs,
      version: dbHealth?.version,
      extra: dbHealth ? {
        'Database': dbHealth.database,
        'Host': `${dbHealth.host}:${dbHealth.port}`,
        ...(dbHealth.recordCount != null ? { 'Records': String(dbHealth.recordCount) } : {}),
      } : undefined,
    };

    // Memcached
    map['mc01'] = {
      status: cacheStatus,
      latencyMs: cacheHealth?.latencyMs,
      extra: cacheHealth ? {
        'R/W Test': cacheHealth.readWriteTest || 'N/A',
        'TTL': cacheHealth.ttlSeconds != null ? `${cacheHealth.ttlSeconds}s` : 'N/A',
        ...(cacheHealth.error ? { 'Error': cacheHealth.error } : {}),
      } : undefined,
    };

    // RabbitMQ and NFS: not monitored
    map['rmq01'] = { status: 'UNKNOWN' };
    map['nfs01'] = { status: 'UNKNOWN' };

    return map;
  }, [instance, instanceStatus, dbHealth, dbStatus, cacheHealth, cacheStatus]);

  const currentResponderId = instance?.instanceId;

  // Count monitored services
  const monitoredStatuses = [instanceStatus, dbStatus, cacheStatus];
  const healthyCount = monitoredStatuses.filter(s => s === 'UP').length;
  const loadingServices = monitoredStatuses.filter(s => s === 'LOADING').length > 0;

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
        <InfraTopology
          nodeStatuses={nodeStatuses}
          currentResponderId={
            currentResponderId?.includes('app01') || currentResponderId?.includes('app02')
              ? currentResponderId
              : undefined
          }
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
