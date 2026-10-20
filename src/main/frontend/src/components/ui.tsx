import type { ServiceStatus } from '../types';

interface StatusCardProps {
  title: string;
  status: ServiceStatus;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function StatusCard({ title, status, icon, children, className = '' }: StatusCardProps) {
  const statusColors: Record<ServiceStatus, string> = {
    UP: 'border-emerald-500/20',
    DOWN: 'border-red-500/20',
    UNKNOWN: 'border-slate-700',
    LOADING: 'border-slate-700',
  };

  return (
    <div
      className={`
        bg-slate-900/50 border rounded-xl p-5 transition-card
        ${statusColors[status]} ${className}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="text-slate-400">{icon}</div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: ServiceStatus | string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    UP: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'up', label: 'Healthy' },
    DOWN: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'down', label: 'Down' },
    UNKNOWN: { bg: 'bg-slate-700/50', text: 'text-slate-400', dot: 'unknown', label: 'Unknown' },
    LOADING: { bg: 'bg-slate-700/50', text: 'text-slate-400', dot: 'unknown', label: 'Loading...' },
    DEGRADED: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'unknown', label: 'Degraded' },
  };

  const c = config[status] || config.UNKNOWN;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`status-dot ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function MetricRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 text-center">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-red-400 mb-1">Connection Error</p>
      <p className="text-xs text-slate-500 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 
            hover:bg-red-500/20 border border-red-500/20 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = {
    default: 'bg-slate-700/50 text-slate-400',
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}
