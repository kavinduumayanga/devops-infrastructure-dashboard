import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { ServiceStatus } from '../types';

/* ============================================================
   STATUS BADGE
   ============================================================ */

const STATUS_CONFIG: Record<string, {
  bg: string; text: string; dot: string; label: string; title: string;
}> = {
  UP:       { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'up',       label: 'Healthy',      title: 'Service is responding normally' },
  DOWN:     { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'down',     label: 'Down',         title: 'Service check returned failure' },
  UNKNOWN:  { bg: 'bg-slate-700/50',   text: 'text-slate-400',   dot: 'unknown',  label: 'Not Monitored', title: 'No monitoring data available' },
  LOADING:  { bg: 'bg-slate-700/50',   text: 'text-slate-400',   dot: 'unknown',  label: 'Loading…',     title: 'Check in progress' },
  STALE:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'stale',    label: 'Stale',        title: 'Last observation is no longer recent' },
  CHECKING: { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'checking', label: 'Checking…',    title: 'Health check request is in flight' },
  DEGRADED: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'stale',    label: 'Degraded',     title: 'Service is partially available' },
};

export function StatusBadge({ status, size = 'sm' }: { status: ServiceStatus | string; size?: 'sm' | 'xs' }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  const sizeClasses = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${c.bg} ${c.text} ${sizeClasses}`}
      title={c.title}
      role="status"
      aria-label={`Status: ${c.label}`}
    >
      <span className={`status-dot ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ============================================================
   STATUS CARD
   ============================================================ */

interface StatusCardProps {
  title: string;
  status: ServiceStatus;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function StatusCard({ title, status, icon, children, className = '', action }: StatusCardProps) {
  const borderAccent: Record<string, string> = {
    UP:      'border-l-emerald-500/40',
    DOWN:    'border-l-red-500/40',
    UNKNOWN: 'border-l-slate-600/40',
    LOADING: 'border-l-slate-600/40',
    STALE:   'border-l-amber-500/40',
    CHECKING: 'border-l-blue-500/40',
  };

  return (
    <div
      className={`
        surface-card border-l-[3px] p-5
        ${borderAccent[status] || 'border-l-slate-600/40'}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="text-slate-400">{icon}</div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <StatusBadge status={status} />
        </div>
      </div>
      {children}
    </div>
  );
}

/* ============================================================
   METRIC ROW
   ============================================================ */

export function MetricRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 min-h-[28px]">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-xs text-slate-300 text-right ml-3 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

/* ============================================================
   SKELETON
   ============================================================ */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/* ============================================================
   ERROR STATE
   ============================================================ */

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="surface-card border-red-500/20 p-6 text-center" role="alert">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
        <span className="text-red-400 text-lg font-bold">!</span>
      </div>
      <p className="text-sm font-medium text-red-400 mb-1">Connection Error</p>
      <p className="text-xs text-slate-500 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400
            hover:bg-red-500/20 border border-red-500/20 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="surface-card p-8 text-center">
      {icon && <div className="text-slate-600 mb-3 flex justify-center">{icon}</div>}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

/* ============================================================
   SECTION HEADER
   ============================================================ */

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ============================================================
   BADGE
   ============================================================ */

type BadgeVariant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'cyan' | 'purple';

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    default: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
    blue:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    green:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    red:     'bg-red-500/10 text-red-400 border border-red-500/20',
    cyan:    'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    purple:  'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

/* ============================================================
   TOOLTIP
   ============================================================ */

export function Tooltip({ children, text }: { children: ReactNode; text: string }) {
  return (
    <span className="relative group/tooltip inline-flex items-center">
      {children}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5
          rounded-lg text-[11px] leading-tight text-slate-200 bg-slate-800 border border-slate-700
          shadow-lg whitespace-normal max-w-[240px] text-center
          opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100
          transition-opacity duration-150 z-50"
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

/* ============================================================
   INFO BADGE (for unknown / unmonitored)
   ============================================================ */

export function InfoBadge({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 cursor-help">
        <Info className="w-3 h-3" />
      </span>
    </Tooltip>
  );
}

/* ============================================================
   CONFIRMATION DIALOG
   ============================================================ */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass = variant === 'danger'
    ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
    : 'bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="surface-card p-6 max-w-sm w-full"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        <h3 className="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */

export function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error' | 'info'; onDismiss?: () => void }) {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error:   'bg-red-500/10 text-red-400 border-red-500/20',
    info:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div
      className={`px-4 py-2.5 rounded-lg text-xs font-medium border ${styles[type]}`}
      style={{ animation: 'slideDown 250ms ease-out' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onDismiss && (
          <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity text-[10px]" aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PROGRESS BAR
   ============================================================ */

export function ProgressBar({ value, max, label, color = 'emerald' }: {
  value: number; max: number; label?: string; color?: 'emerald' | 'amber' | 'red' | 'blue';
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const barColors = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    blue: 'bg-blue-400',
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500">{label}</span>
          <span className="text-slate-300 font-mono">{pct}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
