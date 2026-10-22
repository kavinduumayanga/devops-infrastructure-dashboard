import { useState, useCallback, useEffect, useRef } from 'react';
import type { PageId } from './types';
import { fetchInstance } from './api';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OverviewPage from './pages/OverviewPage';
import ServersPage from './pages/ServersPage';
import DatabasePage from './pages/DatabasePage';
import CachePage from './pages/CachePage';
import RequestsPage from './pages/RequestsPage';
import SystemPage from './pages/SystemPage';

type RefreshState = 'idle' | 'refreshing' | 'paused' | 'error';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [environment, setEnvironment] = useState('Loading');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (
    localStorage.getItem('dashboard-theme') === 'light' ? 'light' : 'dark'
  ));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const visibilityRef = useRef(true);

  // Apply theme immediately to prevent flash
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  // Fetch environment on mount
  useEffect(() => {
    fetchInstance()
      .then(response => {
        if (response.success) setEnvironment(response.data.environment || 'Unknown');
        else setEnvironment('Unknown');
      })
      .catch(() => setEnvironment('Unavailable'));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshState('refreshing');
    setRefreshKey(k => k + 1);
    setLastRefreshed(new Date());
    // Reset to idle after a brief period
    setTimeout(() => setRefreshState(prev => prev === 'refreshing' ? 'idle' : prev), 1500);
  }, []);

  // Auto-refresh with visibility awareness
  useEffect(() => {
    function handleVisibility() {
      visibilityRef.current = !document.hidden;
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        // Pause unnecessary polling when tab is hidden
        if (visibilityRef.current) {
          handleRefresh();
        }
      }, 10000); // 10 second interval
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, handleRefresh]);

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <OverviewPage key={refreshKey} />;
      case 'servers': return <ServersPage key={refreshKey} />;
      case 'database': return <DatabasePage key={refreshKey} />;
      case 'cache': return <CachePage key={refreshKey} />;
      case 'requests': return <RequestsPage key={refreshKey} />;
      case 'system': return <SystemPage key={refreshKey} />;
      default: return <OverviewPage key={refreshKey} />;
    }
  };

  return (
    <div className="flex h-screen surface-app overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          currentPage={currentPage}
          lastRefreshed={lastRefreshed}
          autoRefresh={autoRefresh}
          refreshState={autoRefresh ? (refreshState === 'refreshing' ? 'refreshing' : 'idle') : 'paused'}
          environment={environment}
          theme={theme}
          onToggleAutoRefresh={() => setAutoRefresh(a => !a)}
          onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
          onRefresh={handleRefresh}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1600px] mx-auto" style={{ animation: 'fadeIn 300ms ease-out' }}>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
