import { useState } from 'react';
import { Globe, Server, Database, HardDrive, ArrowDown, Users } from 'lucide-react';
import type { ServiceStatus } from '../types';

interface TopologyProps {
  instanceStatus: ServiceStatus;
  instanceId: string;
  dbStatus: ServiceStatus;
  cacheStatus: ServiceStatus;
}

interface NodeProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  status: ServiceStatus | 'ACTIVE';
  x: number;
  y: number;
  onHover?: (info: string | null) => void;
}

function TopologyNode({ icon, label, sublabel, status, x, y, onHover }: NodeProps) {
  const statusColor = {
    UP: 'border-emerald-500/40 bg-emerald-500/5',
    DOWN: 'border-red-500/40 bg-red-500/5',
    UNKNOWN: 'border-slate-600 bg-slate-800/50',
    LOADING: 'border-slate-600 bg-slate-800/50',
    ACTIVE: 'border-blue-500/40 bg-blue-500/5',
  };

  const dotColor = {
    UP: 'bg-emerald-400',
    DOWN: 'bg-red-400',
    UNKNOWN: 'bg-slate-500',
    LOADING: 'bg-slate-500',
    ACTIVE: 'bg-blue-400',
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => onHover?.(`${label}: ${status === 'ACTIVE' ? 'Active' : status}`)}
      onMouseLeave={() => onHover?.(null)}
      className="cursor-pointer"
    >
      <foreignObject x={-56} y={-36} width={112} height={72}>
        <div className={`w-full h-full rounded-lg border ${statusColor[status]} flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:scale-105`}>
          <div className="text-slate-300">{icon}</div>
          <span className="text-[10px] font-medium text-slate-300">{label}</span>
          {sublabel && <span className="text-[8px] text-slate-500">{sublabel}</span>}
          <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dotColor[status]}`} />
        </div>
      </foreignObject>
    </g>
  );
}

export default function InfraTopology({ instanceStatus, instanceId, dbStatus, cacheStatus }: TopologyProps) {
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  const width = 480;
  const height = 320;
  const cx = width / 2;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Infrastructure Topology</h3>
        {hoverInfo && (
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md animate-fade-in">
            {hoverInfo}
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-lg"
          style={{ maxHeight: 320 }}
        >
          {/* Connection lines */}
          {/* Users → Nginx */}
          <line x1={cx} y1={46} x2={cx} y2={90} className="topology-line active" />
          {/* Nginx → Tomcat 1 */}
          <line x1={cx} y1={130} x2={cx - 100} y2={170} className="topology-line active" />
          {/* Nginx → Tomcat 2 */}
          <line x1={cx} y1={130} x2={cx + 100} y2={170} className="topology-line" />
          {/* Tomcat 1 → MySQL */}
          <line x1={cx - 100} y1={210} x2={cx - 60} y2={250} className={`topology-line ${dbStatus === 'UP' ? 'active' : ''}`} />
          {/* Tomcat 2 → MySQL */}
          <line x1={cx + 100} y1={210} x2={cx - 60} y2={250} className="topology-line" />
          {/* Tomcat 1 → Memcached */}
          <line x1={cx - 100} y1={210} x2={cx + 60} y2={250} className={`topology-line ${cacheStatus === 'UP' ? 'active' : ''}`} />
          {/* Tomcat 2 → Memcached */}
          <line x1={cx + 100} y1={210} x2={cx + 60} y2={250} className="topology-line" />

          {/* Nodes */}
          <TopologyNode
            icon={<Users size={16} />}
            label="Users"
            status="ACTIVE"
            x={cx} y={30}
            onHover={setHoverInfo}
          />
          <TopologyNode
            icon={<Globe size={16} />}
            label="Nginx"
            sublabel="Port 80"
            status="UNKNOWN"
            x={cx} y={110}
            onHover={setHoverInfo}
          />
          <TopologyNode
            icon={<Server size={16} />}
            label={instanceId || 'Tomcat 1'}
            sublabel="Port 8080"
            status={instanceStatus}
            x={cx - 100} y={190}
            onHover={setHoverInfo}
          />
          <TopologyNode
            icon={<Server size={16} />}
            label="Tomcat 2"
            sublabel="Port 8080"
            status="UNKNOWN"
            x={cx + 100} y={190}
            onHover={setHoverInfo}
          />
          <TopologyNode
            icon={<Database size={16} />}
            label="MySQL"
            sublabel="Port 3306"
            status={dbStatus}
            x={cx - 60} y={275}
            onHover={setHoverInfo}
          />
          <TopologyNode
            icon={<HardDrive size={16} />}
            label="Memcached"
            sublabel="Port 11211"
            status={cacheStatus}
            x={cx + 60} y={275}
            onHover={setHoverInfo}
          />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Connected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-500" /> Unknown
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Down
        </span>
      </div>
    </div>
  );
}
