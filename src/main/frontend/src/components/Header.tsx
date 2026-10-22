import {
  RefreshCw, Menu, Clock, Sun, Moon,
  Wifi, WifiOff, Pause, Loader2,
} from 'lucide-react';

type RefreshState = 'idle' | 'refreshing' | 'paused' | 'error';

interface HeaderProps {
  currentPage: string;
  lastRefreshed: Date;
  autoRefresh: boolean;
  refreshState: RefreshState;
  environment: string;
  theme: 'dark' | 'light';
  onToggleAutoRefresh: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  overview: 'Overview',
  servers: 'Application Servers',
  database: 'Database',
  cache: 'Cache',
  requests: 'Request Activity',
  system: 'System Information',
};

export default function Header({
  currentPage,
  lastRefreshed,
  autoRefresh,
  refreshState,
  environment,
  theme,
  onToggleAutoRefresh,
  onToggleTheme,
  onRefresh,
  onToggleSidebar,
}: HeaderProps) {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Determine display state for the refresh indicator
  const refreshDisplay = (() => {
    if (refreshState === 'error') return { icon: WifiOff, label: 'Unable to refresh', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
    if (refreshState === 'refreshing') return { icon: Loader2, label: 'Refreshing…', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    if (autoRefresh) return { icon: Wifi, label: 'Auto-refresh', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    return { icon: Pause, label: 'Paused', color: 'text-slate-500', bg: 'bg-slate-700/30 border-slate-700' };
  })();

  const RefreshIcon = refreshDisplay.icon;

  return (
    <header className="h-[var(--header-height)] surface-header border-b flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        <button
          id="toggle-sidebar"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-slate-200 hidden sm:block">
            {PAGE_TITLES[currentPage] || 'Dashboard'}
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {environment}
          </span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Refresh state indicator */}
        <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${refreshDisplay.bg} ${refreshDisplay.color}`}>
          <RefreshIcon className={`w-3 h-3 ${refreshState === 'refreshing' ? 'animate-spin' : ''}`} />
          <span>{refreshDisplay.label}</span>
        </div>

        {/* Last refreshed time */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formatTime(lastRefreshed)}</span>
        </div>

        {/* Auto-refresh toggle */}
        <button
          id="toggle-auto-refresh"
          onClick={onToggleAutoRefresh}
          aria-pressed={autoRefresh}
          aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          title={autoRefresh ? 'Auto-refresh is ON (10s interval)' : 'Auto-refresh is OFF'}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
            border transition-colors
            ${autoRefresh
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/15'
              : 'text-slate-500 hover:text-slate-300 border-slate-700 hover:border-slate-600'
            }
          `}
        >
          <span className="hidden sm:inline">{autoRefresh ? 'Auto: On' : 'Auto: Off'}</span>
        </button>

        {/* Theme toggle */}
        <button
          id="toggle-theme"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-700 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Manual refresh */}
        <button
          id="refresh-dashboard"
          onClick={onRefresh}
          disabled={refreshState === 'refreshing'}
          aria-label="Refresh dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
            bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100
            border border-slate-700 hover:border-slate-600 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshState === 'refreshing' ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
