import { useState, useEffect } from 'react';
import { Server, Database, HardDrive, Activity } from 'lucide-react';
import { fetchInstance, fetchDatabaseHealth, fetchCacheHealth } from '../api';
import { StatusCard, MetricRow, SkeletonCard, ErrorState, SectionHeader } from '../components/ui';
import InfraTopology from '../components/InfraTopology';
import type { InstanceInfo, DatabaseHealth, CacheHealth, ServiceStatus } from '../types';

export default function OverviewPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [instanceRequestId, setInstanceRequestId] = useState<string | undefined>();
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<CacheHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
  }

  const instanceStatus: ServiceStatus = errors.instance ? 'DOWN' : instance ? 'UP' : 'LOADING';
  const dbStatus: ServiceStatus = errors.database ? 'DOWN' : dbHealth?.status === 'UP' ? 'UP' : dbHealth ? 'DOWN' : 'LOADING';
  const cacheStatus: ServiceStatus = errors.cache ? 'DOWN' : cacheHealth?.status === 'UP' ? 'UP' : cacheHealth ? 'DOWN' : 'LOADING';

  if (loading) {
    return (
      <div>
        <SectionHeader
          title="DevOps Infrastructure Dashboard"
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
        title="DevOps Infrastructure Dashboard"
        subtitle="Real-time visibility into a multi-tier Java application."
      />

      {/* Status cards */}
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
              <MetricRow label="Hostname" value={instance?.hostname} mono />
              <MetricRow label="Instance ID" value={instance?.instanceId} mono />
              <MetricRow label="Java Version" value={instance?.javaVersion} />
              <MetricRow label="Container" value={instance?.servletContainerInfo || 'N/A'} />
              <MetricRow label="Request ID" value={instanceRequestId || 'N/A'} mono />
              <MetricRow label="Environment" value={instance?.environment} />
              <MetricRow label="Uptime" value={instance?.uptime} />
              <MetricRow label="Status" value={instance?.status} />
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
              <MetricRow label="Status" value={dbHealth?.status} />
              <MetricRow label="Ping Latency" value={dbHealth?.pingLatencyMs != null ? `${dbHealth.pingLatencyMs}ms` : 'N/A'} mono />
              <MetricRow label="Database" value={dbHealth?.database} mono />
              <MetricRow label="Version" value={dbHealth?.version || 'N/A'} />
              <MetricRow
                label="Pool"
                value={
                  dbHealth?.connectionPool?.status === 'AVAILABLE'
                    ? `${dbHealth.connectionPool.activeConnections}/${dbHealth.connectionPool.totalConnections} active/total`
                    : 'Unavailable'
                }
                mono
              />
              <MetricRow label="Host" value={`${dbHealth?.host}:${dbHealth?.port}`} mono />
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
              <MetricRow label="Status" value={cacheHealth?.status} />
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

      {/* Infrastructure Topology */}
      <InfraTopology
        instanceStatus={instanceStatus}
        instanceId={instance?.instanceId || ''}
        dbStatus={dbStatus}
        cacheStatus={cacheStatus}
      />
    </div>
  );
}
