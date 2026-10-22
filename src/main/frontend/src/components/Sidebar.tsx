import { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Server,
  Database,
  HardDrive,
  Activity,
  Monitor,
  Layers,
  X,
} from 'lucide-react';
import type { PageId } from '../types';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen: boolean;
  onClose: () => void;
}

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview',  label: 'Overview',             icon: LayoutDashboard },
  { id: 'servers',   label: 'Application Servers',   icon: Server },
  { id: 'database',  label: 'Database',              icon: Database },
  { id: 'cache',     label: 'Cache',                 icon: HardDrive },
  { id: 'requests',  label: 'Request Activity',      icon: Activity },
  { id: 'system',    label: 'System Information',     icon: Monitor },
];

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

  // Close sidebar on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside sidebar on mobile when open
  useEffect(() => {
    if (isOpen && sidebarRef.current) {
      const firstFocusable = sidebarRef.current.querySelector<HTMLElement>('button, a, [tabindex]');
      firstFocusable?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[var(--sidebar-width)] surface-sidebar border-r
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        aria-label="Main navigation"
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/15">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-100 tracking-tight leading-none">DevOps</h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase mt-0.5">Infrastructure</p>
            </div>
          </div>
          {/* Close button (mobile only) */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Dashboard pages">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
                  transition-all duration-150 relative group
                  focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-1
                  ${isActive
                    ? 'bg-cyan-500/8 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }
                `}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cyan-400"
                    aria-hidden="true"
                  />
                )}
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[var(--border-default)]">
          <p className="text-[10px] text-slate-600 text-center tracking-wide">
            DevOps Dashboard v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
