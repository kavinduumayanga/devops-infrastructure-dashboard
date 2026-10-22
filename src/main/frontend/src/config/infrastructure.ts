/**
 * Centralized infrastructure metadata.
 *
 * This file contains the configured lab inventory:
 *   - hostnames, IPs, ports, roles, and relationships.
 *
 * Measured health (UP / DOWN / UNKNOWN) is NOT part of this file.
 * Components merge live observations with this static configuration
 * at render time.
 */

export type InfraRole =
  | 'load-balancer'
  | 'app-server'
  | 'database'
  | 'cache'
  | 'message-broker'
  | 'file-storage';

export type MonitoringCapability = 'monitored' | 'not-monitored';

export interface InfraNode {
  /** Unique identifier matching the VM hostname. */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Service role in the architecture. */
  role: InfraRole;
  /** Short role description shown in the topology. */
  roleLabel: string;
  /** Private IP in the lab network. */
  ip: string;
  /** Primary service port. */
  port: number;
  /** Additional ports (e.g. management UI). */
  additionalPorts?: { label: string; port: number }[];
  /** Service name (e.g. Nginx, Tomcat, MySQL). */
  service: string;
  /** Whether the app can actively monitor this node. */
  monitoring: MonitoringCapability;
  /** Tooltip explaining monitoring status. */
  monitoringNote: string;
  /** Additional metadata entries. */
  meta?: Record<string, string>;
  /** Topology layer (0 = top, higher = bottom). */
  layer: number;
}

export interface InfraConnection {
  from: string;
  to: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Node definitions
// ---------------------------------------------------------------------------

export const INFRA_NODES: InfraNode[] = [
  {
    id: 'web01',
    displayName: 'web01',
    role: 'load-balancer',
    roleLabel: 'Nginx Reverse Proxy',
    ip: '192.168.56.20',
    port: 80,
    service: 'Nginx',
    monitoring: 'not-monitored',
    monitoringNote:
      'Configured gateway — not independently monitored by this application. If you can reach this dashboard, Nginx is routing traffic.',
    layer: 1,
  },
  {
    id: 'app01',
    displayName: 'app01',
    role: 'app-server',
    roleLabel: 'Tomcat Application Server',
    ip: '192.168.56.22',
    port: 8080,
    service: 'Apache Tomcat 10.1',
    monitoring: 'monitored',
    monitoringNote:
      'Health is determined by successful API responses from this instance.',
    layer: 2,
  },
  {
    id: 'app02',
    displayName: 'app02',
    role: 'app-server',
    roleLabel: 'Tomcat Application Server',
    ip: '192.168.56.21',
    port: 8080,
    service: 'Apache Tomcat 10.1',
    monitoring: 'monitored',
    monitoringNote:
      'Health is inferred from browser-observed responses. Not handling the current request does not indicate failure.',
    layer: 2,
  },
  {
    id: 'db01',
    displayName: 'db01',
    role: 'database',
    roleLabel: 'MySQL Database',
    ip: '192.168.56.25',
    port: 3306,
    service: 'MySQL',
    monitoring: 'monitored',
    monitoringNote:
      'Health is checked via JDBC ping and connection-pool metrics.',
    layer: 3,
  },
  {
    id: 'mc01',
    displayName: 'mc01',
    role: 'cache',
    roleLabel: 'Memcached',
    ip: '192.168.56.24',
    port: 11211,
    service: 'Memcached',
    monitoring: 'monitored',
    monitoringNote:
      'Health is checked via read/write test through the spymemcached client.',
    layer: 3,
  },
  {
    id: 'rmq01',
    displayName: 'rmq01',
    role: 'message-broker',
    roleLabel: 'RabbitMQ Broker',
    ip: '192.168.56.23',
    port: 5672,
    additionalPorts: [{ label: 'Management UI', port: 15672 }],
    service: 'RabbitMQ',
    monitoring: 'not-monitored',
    monitoringNote:
      'Configured — application-level monitoring not implemented. AMQP 5672 for messaging, 15672 for management.',
    layer: 3,
  },
  {
    id: 'nfs01',
    displayName: 'nfs01',
    role: 'file-storage',
    roleLabel: 'NFS Shared Storage',
    ip: '192.168.56.26',
    port: 2049,
    service: 'NFSv4',
    monitoring: 'not-monitored',
    monitoringNote:
      'Configured — application-level monitoring not implemented. Exports /srv/nfs/shared, mounted at /mnt/nfs-shared on app servers.',
    meta: {
      'Export Path': '/srv/nfs/shared',
      'Client Mount': '/mnt/nfs-shared',
    },
    layer: 3,
  },
];

// ---------------------------------------------------------------------------
// Connection topology (directed: from → to)
// ---------------------------------------------------------------------------

export const INFRA_CONNECTIONS: InfraConnection[] = [
  // Users → Nginx
  { from: 'users', to: 'web01', label: 'HTTP' },
  // Nginx → Tomcats
  { from: 'web01', to: 'app01', label: 'Round-Robin' },
  { from: 'web01', to: 'app02', label: 'Round-Robin' },
  // Tomcats → shared services
  { from: 'app01', to: 'db01', label: 'JDBC' },
  { from: 'app01', to: 'mc01', label: 'Memcached Protocol' },
  { from: 'app01', to: 'rmq01', label: 'AMQP' },
  { from: 'app01', to: 'nfs01', label: 'NFSv4' },
  { from: 'app02', to: 'db01', label: 'JDBC' },
  { from: 'app02', to: 'mc01', label: 'Memcached Protocol' },
  { from: 'app02', to: 'rmq01', label: 'AMQP' },
  { from: 'app02', to: 'nfs01', label: 'NFSv4' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getNodeById(id: string): InfraNode | undefined {
  return INFRA_NODES.find(n => n.id === id);
}

export function getNodesByRole(role: InfraRole): InfraNode[] {
  return INFRA_NODES.filter(n => n.role === role);
}

export function getNodesByLayer(layer: number): InfraNode[] {
  return INFRA_NODES.filter(n => n.layer === layer);
}

export const MONITORED_SERVICE_COUNT = INFRA_NODES.filter(
  n => n.monitoring === 'monitored',
).length;
