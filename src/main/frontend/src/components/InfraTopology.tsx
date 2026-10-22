import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Globe, Server, Database, HardDrive, Users, MessageSquare, FolderOpen,
  Maximize2, RotateCcw, X, Info, ChevronRight,
} from 'lucide-react';
import type { ServiceStatus } from '../types';
import { INFRA_NODES, INFRA_CONNECTIONS, type InfraNode } from '../config/infrastructure';
import { StatusBadge, InfoBadge } from './ui';

/* ============================================================
   TYPES
   ============================================================ */

export interface NodeStatusMap {
  [nodeId: string]: {
    status: ServiceStatus;
    lastCheckedAt?: string;
    lastSuccessfulAt?: string;
    latencyMs?: number;
    version?: string;
    monitoringType?: string;
    error?: string;
    extra?: Record<string, string>;
  };
}

interface TopologyProps {
  nodeStatuses: NodeStatusMap;
  currentResponderId?: string;
  onNodeSelect?: (nodeId: string | null) => void;
}

/* ============================================================
   ICON MAP
   ============================================================ */

const ROLE_ICON: Record<string, typeof Server> = {
  'load-balancer': Globe,
  'app-server': Server,
  'database': Database,
  'cache': HardDrive,
  'message-broker': MessageSquare,
  'file-storage': FolderOpen,
};

/* ============================================================
   LAYOUT CONSTANTS
   ============================================================ */

const SVG_W = 1120;
const SVG_H = 680;
const NODE_W = 190;
const NODE_H = 108;

// Layer Y positions
const LAYER_Y: Record<number, number> = {
  0: 44,   // Users
  1: 180,  // Nginx
  2: 365,  // Tomcats
  3: 590,  // Backend services
};

// Compute X positions for each node
function getNodePosition(node: InfraNode, layerNodes: InfraNode[]): { x: number; y: number } {
  const y = LAYER_Y[node.layer] ?? 300;
  const count = layerNodes.length;
  const gap = count >= 4 ? 65 : 130;
  const totalWidth = count * NODE_W + (count - 1) * gap;
  const startX = (SVG_W - totalWidth) / 2;
  const index = layerNodes.findIndex(n => n.id === node.id);
  const x = startX + index * (NODE_W + gap) + NODE_W / 2;
  return { x, y };
}

/* ============================================================
   CONNECTION RENDERER
   ============================================================ */

function renderConnections(
  positions: Map<string, { x: number; y: number }>,
  nodeStatuses: NodeStatusMap,
  currentResponderId?: string,
  selectedNode?: string | null,
) {
  // Add virtual "users" position
  const allPositions = new Map(positions);
  allPositions.set('users', { x: SVG_W / 2, y: LAYER_Y[0] });

  return INFRA_CONNECTIONS.map((conn, i) => {
    const from = allPositions.get(conn.from);
    const to = allPositions.get(conn.to);
    if (!from || !to) return null;

    // Only Nginx -> current responder is an observed route. Other lines are
    // configured relationships and never imply health by themselves.
    const isObservedRoute = conn.from === 'web01' && conn.to === currentResponderId;
    const isSelected = selectedNode === conn.from || selectedNode === conn.to;

    // Route from source bottom to target top
    const x1 = from.x;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y - NODE_H / 2;

    // Orthogonal routing keeps lines out of card content. Offset the shared
    // service bus for each source to avoid perfectly stacked connectors.
    const isServiceLink = ['app01', 'app02'].includes(conn.from);
    const midY = isServiceLink ? y1 + (conn.from === 'app01' ? 62 : 88) : (y1 + y2) / 2;
    const path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;

    let className = 'topology-line';
    if (isObservedRoute) {
      className += ' observed';
    } else if (isSelected) {
      className += ' highlighted';
    }

    return (
      <path
        key={i}
        d={path}
        className={className}
        data-relationship={isObservedRoute ? 'observed-routing' : 'configured'}
        strokeDasharray={
          nodeStatuses[conn.to]?.status === 'UNKNOWN' ? '6 4' : undefined
        }
      />
    );
  });
}

/* ============================================================
   TOPOLOGY NODE
   ============================================================ */

interface NodeBoxProps {
  node: InfraNode;
  status: ServiceStatus;
  isCurrentResponder: boolean;
  isSelected: boolean;
  x: number;
  y: number;
  onClick: () => void;
}

function TopologyNodeBox({ node, status, isCurrentResponder, isSelected, x, y, onClick }: NodeBoxProps) {
  const Icon = ROLE_ICON[node.role] || Server;

  const borderColor = (() => {
    if (isSelected) return 'border-cyan-400/60';
    if (isCurrentResponder) return 'border-cyan-400/40';
    switch (status) {
      case 'UP': return 'border-emerald-500/30';
      case 'DOWN': return 'border-red-500/30';
      case 'STALE': return 'border-amber-500/30';
      case 'DEGRADED': return 'border-amber-500/30';
      default: return 'border-slate-700/60';
    }
  })();

  const bgColor = (() => {
    if (isSelected) return 'bg-cyan-500/8';
    if (isCurrentResponder) return 'bg-cyan-500/5';
    switch (status) {
      case 'UP': return 'bg-emerald-500/5';
      case 'DOWN': return 'bg-red-500/5';
      case 'STALE': return 'bg-amber-500/5';
      case 'DEGRADED': return 'bg-amber-500/5';
      default: return 'bg-slate-800/60';
    }
  })();

  const dotColor = (() => {
    switch (status) {
      case 'UP': return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]';
      case 'DOWN': return 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]';
      case 'STALE': return 'bg-amber-400';
      case 'DEGRADED': return 'bg-amber-400';
      case 'LOADING':
      case 'CHECKING': return 'bg-blue-400 animate-pulse';
      default: return 'bg-slate-500';
    }
  })();

  return (
    <g transform={`translate(${x - NODE_W / 2}, ${y - NODE_H / 2})`} className="cursor-pointer" onClick={onClick}>
      <foreignObject width={NODE_W} height={NODE_H}>
        <div
          className={`
            w-full h-full rounded-xl border ${borderColor} ${bgColor}
            flex flex-col items-center justify-center gap-1
            transition-all duration-200 hover:scale-[1.03] relative
            backdrop-blur-sm
          `}
          role="button"
          tabIndex={0}
          aria-label={`${node.displayName}, ${node.service}, status ${status}`}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') onClick();
          }}
        >
          {/* Status dot */}
          <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${dotColor}`} />

          {/* Current responder indicator */}
          {isCurrentResponder && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 whitespace-nowrap">
              Current responder
            </div>
          )}

          <Icon className="w-5 h-5 text-slate-400 mb-0.5" />
          <span className="text-sm font-semibold text-slate-100 leading-none">{node.displayName}</span>
          <span className="text-[11px] text-slate-400 leading-none">{node.service}</span>
          <span className="text-[10px] font-mono text-slate-500 leading-none">{node.ip}:{node.port}</span>
          <span className="text-[9px] font-semibold tracking-wide text-slate-400">{status}</span>
        </div>
      </foreignObject>
    </g>
  );
}

/* ============================================================
   DETAIL PANEL
   ============================================================ */

function NodeDetailPanel({ node, status, onClose }: {
  node: InfraNode;
  status: NodeStatusMap[string] | undefined;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Focus the panel
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const nodeStatus = status?.status || 'UNKNOWN';

  return (
    <div
      ref={panelRef}
      className="surface-card p-4 w-full max-w-sm"
      style={{ animation: 'slideUp 200ms ease-out' }}
      tabIndex={-1}
      role="dialog"
      aria-label={`Details for ${node.displayName}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">{node.displayName}</span>
          <StatusBadge status={nodeStatus} size="xs" />
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          aria-label="Close details"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <DetailRow label="Role" value={node.roleLabel} />
        <DetailRow label="Service" value={node.service} />
        <DetailRow label="IP Address" value={node.ip} mono />
        <DetailRow label="Port" value={String(node.port)} mono />

        {node.additionalPorts?.map(p => (
          <DetailRow key={p.port} label={p.label} value={String(p.port)} mono />
        ))}

        {node.meta && Object.entries(node.meta).map(([k, v]) => (
          <DetailRow key={k} label={k} value={v} mono />
        ))}

        <DetailRow
          label="Relationships"
          value={INFRA_CONNECTIONS
            .filter(connection => connection.from === node.id || connection.to === node.id)
            .map(connection => connection.from === node.id ? connection.to : connection.from)
            .join(', ') || 'None'}
        />

        {status?.latencyMs != null && (
          <DetailRow label="Latency" value={`${status.latencyMs}ms`} mono />
        )}

        {status?.version && (
          <DetailRow label="Version" value={status.version} />
        )}

        {status?.monitoringType && (
          <DetailRow label="Monitoring" value={status.monitoringType.replace(/_/g, ' ')} />
        )}

        {status?.lastCheckedAt && (
          <DetailRow label="Last checked" value={new Date(status.lastCheckedAt).toLocaleString()} />
        )}

        {status?.lastSuccessfulAt && (
          <DetailRow label="Latest success" value={new Date(status.lastSuccessfulAt).toLocaleString()} />
        )}

        {status?.error && (
          <DetailRow label="Observation" value={status.error} />
        )}

        {status?.extra && Object.entries(status.extra).map(([k, v]) => (
          <DetailRow key={k} label={k} value={v} />
        ))}

        {/* Monitoring info */}
        <div className="pt-2 mt-2 border-t border-slate-800/50">
          <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-relaxed">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{node.monitoringNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

/* ============================================================
   MAIN TOPOLOGY COMPONENT
   ============================================================ */

export default function InfraTopology({ nodeStatuses, currentResponderId, onNodeSelect }: TopologyProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute positions
  const positions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    const layers = new Map<number, InfraNode[]>();

    INFRA_NODES.forEach(n => {
      const arr = layers.get(n.layer) || [];
      arr.push(n);
      layers.set(n.layer, arr);
    });

    INFRA_NODES.forEach(n => {
      const layerNodes = layers.get(n.layer) || [];
      posMap.set(n.id, getNodePosition(n, layerNodes));
    });

    return posMap;
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    const newSelected = selectedNode === nodeId ? null : nodeId;
    setSelectedNode(newSelected);
    onNodeSelect?.(newSelected);
  }, [selectedNode, onNodeSelect]);

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const selectedInfraNode = selectedNode ? INFRA_NODES.find(n => n.id === selectedNode) : null;

  // Count monitored healthy services
  const monitoredNodes = INFRA_NODES.filter(n => n.monitoring === 'monitored');
  const totalMonitored = monitoredNodes.length;

  // Summary text
  const summaryText = (() => {
    const loadingCount = monitoredNodes.filter(n =>
      nodeStatuses[n.id]?.status === 'LOADING' || nodeStatuses[n.id]?.status === 'CHECKING'
    ).length;
    if (loadingCount > 0) return 'Checking services…';
    const counts = monitoredNodes.reduce<Record<string, number>>((result, node) => {
      const status = nodeStatuses[node.id]?.status || 'UNKNOWN';
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
    const parts = [
      counts.UP ? `${counts.UP} healthy` : '',
      counts.DOWN ? `${counts.DOWN} down` : '',
      counts.DEGRADED ? `${counts.DEGRADED} degraded` : '',
      counts.STALE ? `${counts.STALE} stale` : '',
      counts.UNKNOWN ? `${counts.UNKNOWN} unknown` : '',
    ].filter(Boolean);
    return parts.length ? `${parts.join(' · ')} (${totalMonitored} monitored)` : 'No monitoring observations';
  })();

  return (
    <div className={`surface-card overflow-hidden ${isExpanded ? 'fixed inset-4 z-50' : ''}`} ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-default)]">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Infrastructure Topology</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{summaryText}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedNode(null)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            title="Reset view"
            aria-label="Reset topology view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            title={isExpanded ? 'Exit fullscreen' : 'Expand topology'}
            aria-label={isExpanded ? 'Exit fullscreen' : 'Expand topology'}
          >
            {isExpanded ? <X className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded overlay backdrop */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={() => setIsExpanded(false)} />
      )}

      {/* SVG Topology */}
      <div className={`flex ${selectedNode ? 'flex-col lg:flex-row' : ''} ${isExpanded ? 'h-[calc(100%-52px)]' : ''}`}>
        <div className={`${selectedNode ? 'flex-1' : 'w-full'} p-4 flex justify-center overflow-x-auto`}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className={`w-full ${isExpanded ? 'h-full' : 'max-h-[610px]'}`}
            style={{ minWidth: 760 }}
            role="img"
            aria-label="Infrastructure topology diagram showing the relationship between seven VMs"
          >
            {/* Layer labels */}
            <text x="16" y={LAYER_Y[1]} className="fill-slate-600 text-[10px] font-medium" dominantBaseline="middle">
              PROXY
            </text>
            <text x="16" y={LAYER_Y[2]} className="fill-slate-600 text-[10px] font-medium" dominantBaseline="middle">
              APPLICATION
            </text>
            <text x="16" y={LAYER_Y[3]} className="fill-slate-600 text-[10px] font-medium" dominantBaseline="middle">
              SERVICES
            </text>

            {/* Users node (virtual) */}
            <g transform={`translate(${SVG_W / 2 - 55}, ${LAYER_Y[0] - 22})`}>
              <foreignObject width={110} height={44}>
                <div className="w-full h-full rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center justify-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-300">Users</span>
                </div>
              </foreignObject>
            </g>

            {/* Connection lines (rendered below nodes) */}
            {renderConnections(positions, nodeStatuses, currentResponderId, selectedNode)}

            {/* Infrastructure nodes */}
            {INFRA_NODES.map(node => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const status = nodeStatuses[node.id]?.status || 'UNKNOWN';
              return (
                <TopologyNodeBox
                  key={node.id}
                  node={node}
                  status={status}
                  isCurrentResponder={node.id === currentResponderId}
                  isSelected={selectedNode === node.id}
                  x={pos.x}
                  y={pos.y}
                  onClick={() => handleNodeClick(node.id)}
                />
              );
            })}
          </svg>
        </div>

        {/* Detail panel */}
        {selectedInfraNode && (
          <div className="lg:w-80 lg:border-l border-t lg:border-t-0 border-[var(--border-default)] p-3 flex-shrink-0 overflow-y-auto">
            <NodeDetailPanel
              node={selectedInfraNode}
              status={nodeStatuses[selectedInfraNode.id]}
              onClose={handleCloseDetail}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
            Healthy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Down
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Unknown
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Degraded / stale
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Current Responder
          </span>
        </div>
        <span className="text-[10px] text-slate-600">
          Click a node for details
        </span>
      </div>
    </div>
  );
}
