import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, Users, Code2, Download, Eye, Trash2, ChevronLeft,
  ChevronRight, Search, Loader2, Check, BarChart2, AlertTriangle,
  Ban, ShieldCheck, ShieldOff, FileText, Clock, RefreshCw, X
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import styles from './Admin.module.css';

const STATUS_OPTIONS = ['active', 'patched', 'outdated', 'removed'];
const ROLE_OPTIONS = ['user', 'moderator', 'admin'];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`card ${styles.statCard}`}>
      <Icon size={18} style={{ color: color || 'var(--accent)' }} />
      <div>
        <div className={styles.statVal}>{value?.toLocaleString() ?? '—'}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function BanModal({ user: target, onClose, onBan }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const toast = useToast();

  const submit = async () => {
    if (!reason.trim()) { toast('Reason required', 'error'); return; }
    await onBan(target.id, reason, days ? parseInt(days) : null);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Ban {target.username}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label>Reason</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for ban..." autoFocus />
          </div>
          <div className={styles.field}>
            <label>Duration (days) — leave empty for permanent</label>
            <input className="input" type="number" value={days} onChange={e => setDays(e.target.value)} placeholder="e.g. 7 (empty = permanent)" min="1" />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit}>Ban User</button>
        </div>
      </div>
    </div>
  );
}

function DeleteRequestModal({ user: target, onClose, onRequest }) {
  const [reason, setReason] = useState('');
  const toast = useToast();

  const submit = async () => {
    await onRequest(target.id, reason);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Request Delete: {target.username}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 12 }}>
            This will send a deletion request to the owner for approval. The account won't be deleted until the owner approves.
          </p>
          <div className={styles.field}>
            <label>Reason (optional)</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for deletion request..." autoFocus />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={submit}>Submit Request</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [scripts, setScripts] = useState({ scripts: [], total: 0, page: 1, pages: 1 });
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0, page: 1 });
  const [deleteRequests, setDeleteRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [banModal, setBanModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => {
    if (!user?.is_admin) { nav('/'); return; }
    loadStats();
  }, [user]);

  useEffect(() => {
    if (tab === 'users') loadUsers(1);
    if (tab === 'scripts') loadScripts(1);
    if (tab === 'audit') loadAudit(1);
    if (tab === 'requests' && user?.is_owner) loadDeleteRequests();
  }, [tab]);

  const loadStats = async () => {
    setLoading(true);
    try { const r = await api.get('/admin/stats'); setStats(r.data); }
    catch { toast('Failed to load stats', 'error'); }
    finally { setLoading(false); }
  };

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try { const r = await api.get('/admin/users', { params: { page, q: search } }); setUsers(r.data); }
    catch { toast('Failed to load users', 'error'); }
    finally { setLoading(false); }
  };

  const loadScripts = async (page = 1) => {
    setLoading(true);
    try { const r = await api.get('/admin/scripts', { params: { page, q: search, status: statusFilter } }); setScripts(r.data); }
    catch { toast('Failed to load scripts', 'error'); }
    finally { setLoading(false); }
  };

  const loadAudit = async (page = 1) => {
    setLoading(true);
    try { const r = await api.get('/audit', { params: { page } }); setAuditLogs(r.data); }
    catch { toast('Failed to load audit log', 'error'); }
    finally { setLoading(false); }
  };

  const loadDeleteRequests = async () => {
    try { const r = await api.get('/delete-request'); setDeleteRequests(r.data.requests || []); }
    catch { }
  };

  const changeUserRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}`, { role });
      setUsers(u => ({ ...u, users: u.users.map(x => x.id === id ? { ...x, role } : x) }));
      toast('Role updated', 'success');
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const toggleVerifyUser = async (id, current) => {
    try {
      await api.patch(`/admin/users/${id}`, { is_verified: !current });
      setUsers(u => ({ ...u, users: u.users.map(x => x.id === id ? { ...x, is_verified: !current } : x) }));
      toast(current ? 'Verification removed' : 'User verified', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const banUser = async (userId, reason, durationDays) => {
    try {
      await api.post('/ban', { userId, reason, durationDays });
      toast('User banned', 'success');
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const unbanUser = async (userId) => {
    try {
      await api.delete(`/ban/${userId}`);
      toast('User unbanned', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const requestDelete = async (userId, reason) => {
    try {
      await api.post('/delete-request', { userId, reason });
      toast('Delete request submitted to owner', 'success');
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const handleDeleteRequest = async (requestId, action) => {
    try {
      await api.patch('/delete-request', { requestId, action });
      setDeleteRequests(r => r.filter(x => x.id !== requestId));
      toast(action === 'approve' ? 'Account deleted' : 'Request rejected', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const changeScriptStatus = async (id, status) => {
    try {
      await api.patch(`/admin/scripts/${id}`, { status });
      setScripts(s => ({ ...s, scripts: s.scripts.map(x => x.id === id ? { ...x, status } : x) }));
      toast('Status updated', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const toggleVerifyScript = async (id, current) => {
    try {
      await api.patch(`/admin/scripts/${id}`, { is_verified: !current });
      setScripts(s => ({ ...s, scripts: s.scripts.map(x => x.id === id ? { ...x, is_verified: !current } : x) }));
      toast(current ? 'Verification removed' : 'Script verified', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const deleteScript = async (id, title) => {
    if (!confirm(`Delete script "${title}"?`)) return;
    try {
      await api.delete(`/admin/scripts/${id}`);
      setScripts(s => ({ ...s, scripts: s.scripts.filter(x => x.id !== id), total: s.total - 1 }));
      toast('Script deleted', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const statusColor = { active: 'badge-green', patched: 'badge-red', outdated: 'badge-yellow', removed: 'badge-gray' };
  const roleColor = { admin: 'badge-purple', moderator: 'badge-yellow', user: 'badge-gray' };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'scripts', label: 'Scripts', icon: Code2 },
    { id: 'audit', label: 'Audit Log', icon: FileText },
    ...(user?.is_owner ? [{ id: 'requests', label: 'Delete Requests', icon: AlertTriangle }] : []),
  ];

  const timeAgo = ts => {
    const s = Math.floor((Date.now() / 1000) - ts);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  };

  if (!user?.is_admin) return null;

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 60 }}>
      {banModal && <BanModal user={banModal} onClose={() => setBanModal(null)} onBan={banUser} />}
      {deleteModal && <DeleteRequestModal user={deleteModal} onClose={() => setDeleteModal(null)} onRequest={requestDelete} />}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><Shield size={22} style={{ color: 'var(--accent)' }} /> Admin</h1>
          <p className="text-muted">Site management panel</p>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.active : ''}`} onClick={() => setTab(t.id)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {loading && <div className={styles.loadingBar} />}

      {/* OVERVIEW */}
      {tab === 'overview' && stats && (
        <div className="animate-fade">
          <div className={styles.statsGrid}>
            <StatCard icon={Users} label="Users" value={stats.counts?.users} />
            <StatCard icon={Code2} label="Scripts" value={stats.counts?.scripts} />
            <StatCard icon={Download} label="Downloads" value={stats.counts?.downloads} color="var(--green)" />
            <StatCard icon={Eye} label="Views" value={stats.counts?.views} color="var(--blue)" />
          </div>
          <div className={styles.recentGrid}>
            <div>
              <h3 className={styles.sectionTitle}>Recent Users</h3>
              <div className={styles.recentList}>
                {stats.recent_users?.map(u => (
                  <div key={u.id} className={styles.recentItem}>
                    <Link to={`/u/${u.username}`} className={styles.recentName}>{u.username}</Link>
                    <span className={`badge ${roleColor[u.role] || 'badge-gray'}`}>{u.role}</span>
                    <span className="text-muted mono" style={{ fontSize: '0.75rem' }}>
                      {new Date(u.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className={styles.sectionTitle}>Recent Scripts</h3>
              <div className={styles.recentList}>
                {stats.recent_scripts?.map(s => (
                  <div key={s.id} className={styles.recentItem}>
                    <Link to={`/scripts/${s.slug}`} className={styles.recentName}>{s.title}</Link>
                    <span className={`badge ${statusColor[s.status] || 'badge-gray'}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="animate-fade">
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} />
              <input className="input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadUsers(1)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(1)}><RefreshCw size={14} /></button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>User</th><th>Role</th><th>Verified</th><th>Scripts</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {users.users.map(u => (
                  <tr key={u.id}>
                    <td><Link to={`/u/${u.username}`} className={styles.userLink}>{u.username}</Link><div className="mono text-muted" style={{ fontSize: '0.72rem' }}>{u.email}</div></td>
                    <td>
                      <select className={styles.select} value={u.role} onChange={e => changeUserRole(u.id, e.target.value)}>
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${u.is_verified ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => toggleVerifyUser(u.id, u.is_verified)}
                        title={u.is_verified ? 'Remove verification' : 'Verify user'}
                      >
                        {u.is_verified ? <><ShieldCheck size={13} /> Verified</> : <><ShieldOff size={13} /> Unverified</>}
                      </button>
                    </td>
                    <td className="mono">{u.script_count}</td>
                    <td className="mono text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(u.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" title="Ban user" onClick={() => setBanModal(u)} style={{ color: 'var(--yellow)' }}>
                          <Ban size={13} />
                        </button>
                        <button className="btn btn-sm btn-ghost" title="Request delete" onClick={() => setDeleteModal(u)} style={{ color: 'var(--red)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={users.page <= 1} onClick={() => loadUsers(users.page - 1)}><ChevronLeft size={15} /></button>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>Page {users.page} of {users.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={users.page >= users.pages} onClick={() => loadUsers(users.page + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      )}

      {/* SCRIPTS */}
      {tab === 'scripts' && (
        <div className="animate-fade">
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}><Search size={14} /><input className="input" placeholder="Search scripts..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadScripts(1)} /></div>
            <select className="input" style={{ width: 'auto' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => loadScripts(1)}><RefreshCw size={14} /></button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Script</th><th>Author</th><th>Status</th><th>Verified</th><th>Stats</th><th>Actions</th></tr></thead>
              <tbody>
                {scripts.scripts.map(s => (
                  <tr key={s.id}>
                    <td><Link to={`/scripts/${s.slug}`} className={styles.userLink}>{s.title}</Link></td>
                    <td className="mono text-muted" style={{ fontSize: '0.8rem' }}>{s.author}</td>
                    <td>
                      <select className={styles.select} value={s.status} onChange={e => changeScriptStatus(s.id, e.target.value)}>
                        {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${s.is_verified ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => toggleVerifyScript(s.id, s.is_verified)}
                        title={s.is_verified ? 'Remove verification' : 'Verify script'}
                      >
                        {s.is_verified ? <><ShieldCheck size={13} /> Verified</> : <ShieldOff size={13} />}
                      </button>
                    </td>
                    <td className="mono text-muted" style={{ fontSize: '0.75rem' }}>{s.downloads}↓ {s.views}👁</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={() => deleteScript(s.id, s.title)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scripts.pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={scripts.page <= 1} onClick={() => loadScripts(scripts.page - 1)}><ChevronLeft size={15} /></button>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>Page {scripts.page} of {scripts.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={scripts.page >= scripts.pages} onClick={() => loadScripts(scripts.page + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      )}

      {/* AUDIT LOG */}
      {tab === 'audit' && (
        <div className="animate-fade">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
              <tbody>
                {auditLogs.logs?.map(l => (
                  <tr key={l.id}>
                    <td className="mono text-muted" style={{ fontSize: '0.75rem' }}>{timeAgo(l.created_at)}</td>
                    <td className="mono" style={{ fontSize: '0.8rem' }}>{l.actor_username || '—'}</td>
                    <td><span className="badge badge-gray">{l.action}</span></td>
                    <td className="mono text-muted" style={{ fontSize: '0.8rem' }}>{l.target_type && `${l.target_type}: `}{l.target_name || l.target_id || '—'}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>{l.reason || '—'}</td>
                  </tr>
                ))}
                {!auditLogs.logs?.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No audit logs yet</td></tr>}
              </tbody>
            </table>
          </div>
          {auditLogs.pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={auditLogs.page <= 1} onClick={() => loadAudit(auditLogs.page - 1)}><ChevronLeft size={15} /></button>
              <span className="text-muted" style={{ fontSize: '0.875rem' }}>Page {auditLogs.page} of {auditLogs.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={auditLogs.page >= auditLogs.pages} onClick={() => loadAudit(auditLogs.page + 1)}><ChevronRight size={15} /></button>
            </div>
          )}
        </div>
      )}

      {/* DELETE REQUESTS (owner only) */}
      {tab === 'requests' && user?.is_owner && (
        <div className="animate-fade">
          {deleteRequests.length === 0
            ? <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>No pending delete requests</div>
            : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>User</th><th>Email</th><th>Reason</th><th>Requested</th><th>Actions</th></tr></thead>
                  <tbody>
                    {deleteRequests.map(r => (
                      <tr key={r.id}>
                        <td className="mono">{r.username}</td>
                        <td className="mono text-muted" style={{ fontSize: '0.8rem' }}>{r.email}</td>
                        <td className="text-muted" style={{ fontSize: '0.8rem' }}>{r.reason || '—'}</td>
                        <td className="mono text-muted" style={{ fontSize: '0.75rem' }}>{timeAgo(r.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRequest(r.id, 'approve')}>
                              <Check size={13} /> Approve
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteRequest(r.id, 'reject')}>
                              <X size={13} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
