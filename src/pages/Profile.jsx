import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Edit2, Check, X, Shield, Crown, Download, Eye, Star, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import api from '../lib/api';
import ScriptCard from '../components/ScriptCard';
import styles from './Profile.module.css';

function fmt(n) { if (n>=1e6) return (n/1e6).toFixed(1)+'M'; if (n>=1e3) return (n/1e3).toFixed(1)+'K'; return n||0; }

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bio: '', discord: '', avatar_url: '' });

  const isMe = me?.username?.toLowerCase() === username?.toLowerCase();
  const isAdmin = me?.role === 'admin' || me?.is_owner;

  useEffect(() => {
    setLoading(true);
    api.get(`/users/${username}`)
      .then(r => {
        setData(r.data);
        setForm({ bio: r.data.user.bio || '', discord: r.data.user.discord || '', avatar_url: r.data.user.avatar_url || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const saveProfile = async () => {
    try {
      const r = await api.patch(`/users/${username}`, form);
      setData(d => ({ ...d, user: { ...d.user, ...r.data.user } }));
      setEditing(false);
      toast('Profile updated', 'success');
    } catch (e) { toast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const toggleVerified = async () => {
    try {
      const r = await api.patch(`/users/${username}`, { is_verified: !data.user.is_verified });
      setData(d => ({ ...d, user: { ...d.user, is_verified: r.data.user.is_verified } }));
      toast(r.data.user.is_verified ? 'User verified' : 'Verification removed', 'success');
    } catch { toast('Failed', 'error'); }
  };

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /></div>;
  if (!data) return <div className={styles.loading}><p className="text-muted">User not found.</p></div>;

  const { user, scripts, badges, stats } = data;
  const joinDate = new Date(user.created_at * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Profile header */}
        <div className={styles.profileCard + ' animate-fade'}>
          <div className={styles.avatarWrap}>
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.username} className={styles.avatar} />
              : <div className={styles.avatarFallback}>{user.username[0].toUpperCase()}</div>
            }
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.username}>{user.username}</h1>
              {user.is_owner && <Crown size={18} style={{ color: '#f59e0b' }} title="Owner" />}
              {user.role === 'admin' && !user.is_owner && <Shield size={16} style={{ color: 'var(--accent)' }} title="Admin" />}
              {user.is_verified && <span className="verified-icon" title="Verified user" style={{ width: 20, height: 20, fontSize: 11 }}>✓</span>}
            </div>

            {/* Badges */}
            {badges.length > 0 && (
              <div className={styles.badges}>
                {badges.map(b => (
                  <span key={b.name} className="badge-pill" style={{ color: b.color, borderColor: b.color + '66' }} title={b.description}>
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}

            {editing ? (
              <div className={styles.editForm}>
                <div className={styles.editField}>
                  <label>Avatar URL</label>
                  <input className="input" placeholder="https://..." value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} />
                  {form.avatar_url && <img src={form.avatar_url} alt="preview" className={styles.avatarPreview} onError={e => e.target.style.display='none'} />}
                </div>
                <div className={styles.editField}>
                  <label>Bio</label>
                  <textarea className="input" rows={3} placeholder="Tell the community about yourself..." value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
                <div className={styles.editField}>
                  <label>Discord</label>
                  <input className="input" placeholder="username" value={form.discord} onChange={e => setForm(f => ({ ...f, discord: e.target.value }))} />
                </div>
                <div className={styles.editActions}>
                  <button className="btn btn-primary btn-sm" onClick={saveProfile}><Check size={13} /> Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {user.bio && <p className={styles.bio}>{user.bio}</p>}
                {user.discord && <p className={styles.discord}>Discord: <strong>{user.discord}</strong></p>}
                <p className={styles.joined}>Joined {joinDate}</p>
              </>
            )}

            <div className={styles.profileActions}>
              {isMe && !editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Edit2 size={13} /> Edit Profile</button>}
              {isAdmin && !isMe && (
                <button className={`btn btn-sm ${user.is_verified ? 'btn-ghost' : 'btn-primary'}`} onClick={toggleVerified}>
                  <ShieldCheck size={13} /> {user.is_verified ? 'Remove Verify' : 'Verify User'}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.stat}><span className={styles.statVal}>{fmt(stats.script_count)}</span><span className={styles.statLabel}>Scripts</span></div>
            <div className={styles.stat}><span className={styles.statVal}>{fmt(stats.total_downloads)}</span><span className={styles.statLabel}>Downloads</span></div>
            <div className={styles.stat}><span className={styles.statVal}>{fmt(stats.total_views)}</span><span className={styles.statLabel}>Views</span></div>
            <div className={styles.stat}><span className={styles.statVal}>{fmt(stats.total_favorites)}</span><span className={styles.statLabel}>Stars</span></div>
          </div>
        </div>

        {/* Scripts grid */}
        {scripts.length > 0 ? (
          <div>
            <h2 className={styles.sectionTitle}>Scripts</h2>
            <div className={styles.scriptsGrid + ' stagger'}>
              {scripts.map(s => <ScriptCard key={s.id} script={{ ...s, author: user }} />)}
            </div>
          </div>
        ) : (
          <div className={styles.empty}>No scripts yet.</div>
        )}
      </div>
    </div>
  );
}
