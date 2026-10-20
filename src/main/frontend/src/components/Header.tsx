import { RefreshCw, Menu, Clock, ToggleLeft, ToggleRight, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  lastRefreshed: Date;
  autoRefresh: boolean;
  environment: string;
  theme: 'dark' | 'light';
  onToggleAutoRefresh: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
}

export default function Header({
  lastRefreshed,
  autoRefresh,
  environment,
  theme,
  onToggleAutoRefresh,
  onToggleTheme,
  onRefresh,
  onToggleSidebar,
}: HeaderProps) {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="h-14 bg-slate-925 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          id="toggle-sidebar"
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            LIVE
          </span>
          <span className="text-xs text-slate-500">DevOps Infrastructure Dashboard</span>
          <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {environment}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Last refreshed */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(lastRefreshed)}</span>
        </div>

        {/* Auto-refresh toggle */}
        <button
          id="toggle-auto-refresh"
          onClick={onToggleAutoRefresh}
          aria-pressed={autoRefresh}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
            transition-colors
            ${autoRefresh
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-600'
            }
          `}
        >
          {autoRefresh ? (
            <ToggleRight className="w-3.5 h-3.5" />
          ) : (
            <ToggleLeft className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Auto</span>
        </button>

        <button
          id="toggle-theme"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Refresh button */}
        <button
          id="refresh-dashboard"
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
            bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100
            border border-slate-700 hover:border-slate-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
