import { useState, useEffect } from 'react';
import { Database, Plus, Trash2, RefreshCw, TestTube, AlertTriangle } from 'lucide-react';
import { fetchDatabaseHealth, fetchRecords, createRecord, deleteRecord } from '../api';
import {
  SectionHeader, StatusCard, MetricRow, SkeletonCard, ErrorState, EmptyState,
  Badge, Toast, ConfirmDialog, ProgressBar,
} from '../components/ui';
import type { DatabaseHealth, DemoRecord } from '../types';

export default function DatabasePage() {
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [records, setRecords] = useState<DemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, recordsRes] = await Promise.all([
        fetchDatabaseHealth(),
        fetchRecords(),
      ]);
      if (healthRes.success) setDbHealth(healthRes.data);
      if (recordsRes.success) setRecords(recordsRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to connect to backend');
    }
    setLoading(false);
  }

  async function handleTestDb() {
    setHealthLoading(true);
    try {
      const res = await fetchDatabaseHealth();
      if (res.success) {
        setDbHealth(res.data);
        showNotif(`Database ping: ${res.data.pingLatencyMs}ms`, 'success');
      }
    } catch {
      showNotif('Database test failed', 'error');
    }
    setHealthLoading(false);
  }

  async function handleAddRecord() {
    if (!newName.trim()) {
      setFormError('Name is required');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await createRecord(newName.trim(), newDesc.trim());
      if (res.success) {
        setRecords([res.data, ...records]);
        setNewName('');
        setNewDesc('');
        setShowAddForm(false);
        showNotif('Record created successfully', 'success');
      } else {
        setFormError(res.error || 'Failed to create record');
      }
    } catch (e: any) {
      setFormError(e.message || 'Failed to create record');
    }
    setSubmitting(false);
  }

  async function handleDelete(id: number) {
    try {
      const res = await deleteRecord(id);
      if (res.success) {
        setRecords(records.filter(r => r.id !== id));
        showNotif('Record deleted', 'success');
      }
    } catch {
      showNotif('Failed to delete record', 'error');
    }
    setDeleteConfirm(null);
  }

  function showNotif(msg: string, type: 'success' | 'error') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  const dbStatus = dbHealth?.status === 'UP' ? 'UP' as const : 'DOWN' as const;

  if (loading) {
    return (
      <div>
        <SectionHeader title="Database" subtitle="MySQL connectivity and CRUD operations." />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Database" subtitle="MySQL connectivity and CRUD operations." />
        <ErrorState message={error} onRetry={loadAll} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Database" subtitle="MySQL connectivity and CRUD operations." />

      {/* Toast notification */}
      {notification && (
        <div className="mb-4">
          <Toast message={notification.msg} type={notification.type} onDismiss={() => setNotification(null)} />
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Record"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Health + Actions row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <StatusCard
          title="MySQL Health"
          status={dbStatus}
          icon={<Database className="w-4 h-4" />}
        >
          <div className="space-y-0.5">
            <MetricRow label="Status" value={dbHealth?.status} />
            <MetricRow label="Ping" value={dbHealth?.pingLatencyMs != null ? `${dbHealth.pingLatencyMs}ms` : 'N/A'} mono />
            <MetricRow label="Version" value={dbHealth?.version || 'N/A'} />
            <MetricRow label="Database" value={dbHealth?.database} mono />
            <MetricRow
              label="Pool Active / Total"
              value={
                dbHealth?.connectionPool?.status === 'AVAILABLE'
                  ? `${dbHealth.connectionPool.activeConnections} / ${dbHealth.connectionPool.totalConnections}`
                  : 'Unavailable'
              }
              mono
            />
            <MetricRow label="Host" value={`${dbHealth?.host}:${dbHealth?.port}`} mono />
            <MetricRow label="Records" value={dbHealth?.recordCount ?? 'N/A'} />
          </div>
        </StatusCard>

        {/* Actions panel */}
        <div className="xl:col-span-2 surface-card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              id="test-database"
              onClick={handleTestDb}
              disabled={healthLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-cyan-500/10 text-cyan-400 border border-cyan-500/20
                hover:bg-cyan-500/15 disabled:opacity-50 transition-colors"
            >
              <TestTube className="w-3.5 h-3.5" />
              {healthLoading ? 'Testing…' : 'Test Database'}
            </button>
            <button
              id="add-record"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                hover:bg-emerald-500/15 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Record
            </button>
            <button
              id="refresh-records"
              onClick={loadAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-slate-700/30 text-slate-300 border border-slate-600/50
                hover:bg-slate-700/50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Records
            </button>
          </div>

          {/* Add record form */}
          {showAddForm && (
            <div className="mt-4 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-3)]" style={{ animation: 'slideUp 200ms ease-out' }}>
              <h4 className="text-xs font-semibold text-slate-300 mb-3">New Record</h4>
              {formError && (
                <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {formError}
                </p>
              )}
              <div className="space-y-3">
                <input
                  id="record-name"
                  type="text"
                  placeholder="Name (required)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  maxLength={150}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--surface-1)] border border-[var(--border-default)]
                    text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                <input
                  id="record-description"
                  type="text"
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--surface-1)] border border-[var(--border-default)]
                    text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    id="submit-record"
                    onClick={handleAddRecord}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-emerald-500/15 text-emerald-400 border border-emerald-500/25
                      hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setFormError(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                      text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Records table */}
      {records.length === 0 ? (
        <EmptyState message="No records found. Add a record to get started." icon={<Database className="w-6 h-6" />} />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Demo Records</h3>
            <span className="text-[10px] text-slate-600">Sample database records — not discovered infrastructure</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--surface-3)]">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">ID</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Name</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium hidden sm:table-cell">Description</th>
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Created</th>
                  <th className="text-right py-2.5 px-4 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-slate-800/20 hover:bg-slate-800/10 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-mono">{r.id}</td>
                    <td className="py-2.5 px-4 text-slate-200 font-medium">{r.name}</td>
                    <td className="py-2.5 px-4 text-slate-400 hidden sm:table-cell max-w-xs truncate">{r.description || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400
                          hover:bg-red-500/10 transition-colors"
                        title="Delete record"
                        aria-label={`Delete record ${r.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
