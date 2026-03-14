import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield, Users, Code2, Download, Eye, MessageSquare, Star,
  Trash2, ChevronLeft, ChevronRight, Search, Loader2, Check,
  BarChart2, AlertTriangle, RefreshCw
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

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [scripts, setScripts] = useState({ scripts: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') { nav('/'); return; }
    loadStats();
  }, [user]);

  useEffect(() => {
    if (tab === 'users') loadUsers(1);
    if (tab === 'scripts') loadScripts(1);
  }, [tab]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data);
    } catch { toast('Failed to load stats', 'error'); }
    finally { setLoading(false); }
  };

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const r = await api.get('/admin/users', { params: { page, q: search } });
      setUsers(r.data);
    } catch { toast('Failed to load users', 'error'); }
    finally { setLoading(false); }
  };

  const loadScripts = async (page = 1) => {
    setLoading(true);
    try {
      const r = await api.get('/admin/scripts', { params: { page, q: search, status: statusFilter } });
      setScripts(r.data);
    } catch { toast('Failed to load scripts', 'error'); }
    finally { setLoading(false); }
  };

  const changeUserRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}`, { role });
      setUsers(u => ({ ...u, users: u.users.map(x => x.id === id ? { ...x, role } : x) }));
      toast('Role updated', 'success');
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const deleteUser = async (id, username) => {
    if (!confirm(`Delete user "${username}"? This removes all their scripts too.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(u => ({ ...u, users: u.users.filter(x => x.id !== id), total: u.total - 1 }));
      toast('User deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const changeScriptStatus = async (id, status) => {
    try {
      await api.patch(`/admin/scripts/${id}`, { status });
      setScripts(s => ({ ...s, scripts: s.scripts.map(x => x.id === id ? { ...x, status } : x) }));
      toast('Status updated', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const deleteScript = async (id, title) => {
    if (!confirm(`Delete script "${title}"?`)) return;
    try {
      await api.delete(`/admin/scripts/${id}`);
      setScripts(s => ({ ...s, scripts: s.scripts.filter(x => x.id !== id), total: s.total - 1 }));
      toast('Script deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const statusColor = { active: 'badge-green', patched: 'badge-red', outdated: 'badge-yellow', removed: 'badge-gray' };
  const roleColor = { admin: 'badge-purple', moderator: 'badge-yellow', user: 'badge-gray' };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><Shield size={22} style={{ color: 'var(--accent)' }} /> Admin Panel</h1>
          <p className="text-muted text-sm">Manage users, scripts, and site settings.</p>
        </div>
      </div>

      <div className={styles.tabs}>
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'users', label: `Users${stats ? ` (${stats.counts.total_users})` : ''}`, icon: Users },
          { id: 'scripts', label: `Scripts${stats ? ` (${stats.counts.total_scripts})` : ''}`, icon: Code2 },
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.active : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className={styles.overview}>
          {loading ? (
            <div className={styles.center}><Loader2 size={24} className={styles.spin} style={{ color: 'var(--accent)' }} /></div>
          ) : stats ? (
            <>
              <div className={styles.statGrid}>
                <StatCard icon={Users} label="Total Users" value={stats.counts.total_users} />
                <StatCard icon={Code2} label="Active Scripts" value={stats.counts.total_scripts} />
                <StatCard icon={Download} label="Total Downloads" value={stats.counts.total_downloads} color="var(--green)" />
                <StatCard icon={Eye} label="Total Views" value={stats.counts.total_views} color="var(--blue)" />
                <StatCard icon={MessageSquare} label="Comments" value={stats.counts.total_comments} color="var(--yellow)" />
                <StatCard icon={Star} label="Ratings" value={stats.counts.total_ratings} color="var(--yellow)" />
              </div>

              <div className={styles.recentGrid}>
                <div className={`card ${styles.recentCard}`}>
                  <h3 className={styles.recentTitle}>Recent Users</h3>
                  <table className={styles.table}>
                    <thead><tr><th>Username</th><th>Role</th><th>Joined</th></tr></thead>
                    <tbody>
                      {stats.recent_users.map(u => (
                        <tr key={u.id}>
                          <td><Link to={`/u/${u.username}`} className={styles.link}>{u.username}</Link></td>
                          <td><span className={`badge ${roleColor[u.role]}`}>{u.role}</span></td>
                          <td className="mono text-xs text-muted">{new Date(u.created_at  * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={`card ${styles.recentCard}`}>
                  <h3 className={styles.recentTitle}>Recent Scripts</h3>
                  <table className={styles.table}>
                    <thead><tr><th>Title</th><th>Status</th><th>Author</th></tr></thead>
                    <tbody>
                      {stats.recent_scripts.map(s => (
                        <tr key={s.id}>
                          <td><Link to={`/scripts/${s.slug}`} className={styles.link}>{s.title}</Link></td>
                          <td><span className={`badge ${statusColor[s.status]}`}>{s.status}</span></td>
                          <td className="text-sm text-muted">{s.author}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className={styles.tableSection}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={`input ${styles.searchInput}`}
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(1)}
              />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(1)}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.center}><Loader2 size={24} className={styles.spin} style={{ color: 'var(--accent)' }} /></div>
          ) : (
            <div className={`card ${styles.tableCard}`}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Username</th><th>Email</th><th>Role</th><th>Scripts</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.users.map(u => (
                    <tr key={u.id}>
                      <td><Link to={`/u/${u.username}`} className={styles.link}>{u.username}</Link></td>
                      <td className="text-sm text-muted mono">{u.email}</td>
                      <td>
                        <select
                          className={styles.select}
                          value={u.role}
                          onChange={e => changeUserRole(u.id, e.target.value)}
                          disabled={u.id === user.id}
                        >
                          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="mono text-sm">{u.script_count}</td>
                      <td className="mono text-xs text-muted">{new Date(u.created_at  * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => deleteUser(u.id, u.username)}
                          disabled={u.id === user.id}
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {users.pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={users.page <= 1} onClick={() => loadUsers(users.page - 1)}>
                <ChevronLeft size={15} />
              </button>
              <span className="mono text-sm text-muted">{users.page} / {users.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={users.page >= users.pages} onClick={() => loadUsers(users.page + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scripts */}
      {tab === 'scripts' && (
        <div className={styles.tableSection}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={`input ${styles.searchInput}`}
                placeholder="Search scripts or authors..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadScripts(1)}
              />
            </div>
            <select
              className={`input ${styles.filterSelect}`}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); loadScripts(1); }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => loadScripts(1)}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className={styles.center}><Loader2 size={24} className={styles.spin} style={{ color: 'var(--accent)' }} /></div>
          ) : (
            <div className={`card ${styles.tableCard}`}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Title</th><th>Author</th><th>Status</th><th>Downloads</th><th>Views</th><th>Uploaded</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {scripts.scripts.map(s => (
                    <tr key={s.id}>
                      <td><Link to={`/scripts/${s.slug}`} className={styles.link}>{s.title}</Link></td>
                      <td className="text-sm text-muted">{s.author}</td>
                      <td>
                        <select
                          className={styles.select}
                          value={s.status}
                          onChange={e => changeScriptStatus(s.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="mono text-sm">{s.downloads}</td>
                      <td className="mono text-sm">{s.views}</td>
                      <td className="mono text-xs text-muted">{new Date(s.created_at  * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => deleteScript(s.id, s.title)}
                          title="Delete script"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {scripts.pages > 1 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost btn-sm" disabled={scripts.page <= 1} onClick={() => loadScripts(scripts.page - 1)}>
                <ChevronLeft size={15} />
              </button>
              <span className="mono text-sm text-muted">{scripts.page} / {scripts.pages}</span>
              <button className="btn btn-ghost btn-sm" disabled={scripts.page >= scripts.pages} onClick={() => loadScripts(scripts.page + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
