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

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [environment, setEnvironment] = useState('Loading');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (
    localStorage.getItem('dashboard-theme') === 'light' ? 'light' : 'dark'
  ));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchInstance()
      .then(response => {
        if (response.success) setEnvironment(response.data.environment || 'Unknown');
        else setEnvironment('Unknown');
      })
      .catch(() => setEnvironment('Unavailable'));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        handleRefresh();
      }, 15000);
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
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(page) => {
          setCurrentPage(page);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          lastRefreshed={lastRefreshed}
          autoRefresh={autoRefresh}
          environment={environment}
          theme={theme}
          onToggleAutoRefresh={() => setAutoRefresh(a => !a)}
          onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
          onRefresh={handleRefresh}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}
