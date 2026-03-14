import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Code2, Search, Upload, BookOpen, LogIn, LogOut, User, ChevronDown, Shield, Cpu, Bell, Crown } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import styles from './Navbar.module.css';

function VerifiedIcon() {
  return <span className="verified-icon" title="Verified">✓</span>;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);

  const isActive = path => loc.pathname === path || loc.pathname.startsWith(path + '/');

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    const fetch = () => api.get('/community/notifications').then(r => {
      setNotifs(r.data.notifications || []);
      setUnread(r.data.unread || 0);
    }).catch(() => {});
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // Close notif panel on outside click
  useEffect(() => {
    const handler = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openNotifs = async () => {
    setNotifOpen(o => !o);
    if (unread > 0) {
      await api.patch('/community/notifications').catch(() => {});
      setUnread(0);
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    }
  };

  const handleSearch = e => {
    e.preventDefault();
    if (search.trim()) nav(`/scripts?q=${encodeURIComponent(search.trim())}`);
  };

  const timeAgo = ts => {
    const s = Math.floor((Date.now() / 1000) - ts);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <img src="/logo.png" alt="RXScripts" className={styles.logoImg} />
          <span className={styles.logoName}>RXScripts</span>
        </Link>

        <nav className={styles.links}>
          <Link to="/scripts" className={`${styles.link} ${isActive('/scripts') ? styles.active : ''}`}><Code2 size={15} />Scripts</Link>
          <Link to="/executors" className={`${styles.link} ${isActive('/executors') ? styles.active : ''}`}><Cpu size={15} />Executors</Link>
          <Link to="/blog" className={`${styles.link} ${isActive('/blog') ? styles.active : ''}`}><BookOpen size={15} />Blog</Link>
        </nav>

        <form onSubmit={handleSearch} className={styles.searchForm}>
          <Search size={15} className={styles.searchIcon} />
          <input className={styles.searchInput} placeholder="Search scripts..." value={search} onChange={e => setSearch(e.target.value)} />
        </form>

        <div className={styles.actions}>
          {user ? (
            <>
              <Link to="/upload" className="btn btn-primary btn-sm"><Upload size={14} />Upload</Link>

              {/* Notification Bell */}
              <div className={styles.notifWrap} ref={notifRef}>
                <button className={styles.notifBtn} onClick={openNotifs}>
                  <Bell size={18} />
                  {unread > 0 && <span className={styles.notifBadge}>{unread > 9 ? '9+' : unread}</span>}
                </button>
                {notifOpen && (
                  <div className={styles.notifPanel + ' animate-scale'}>
                    <div className={styles.notifHeader}>
                      <span>Notifications</span>
                      {notifs.length > 0 && (
                        <button className={styles.notifClear} onClick={async () => {
                          await api.delete('/community/notifications').catch(() => {});
                          setNotifs([]); setUnread(0); setNotifOpen(false);
                        }}>Clear all</button>
                      )}
                    </div>
                    {notifs.length === 0
                      ? <div className={styles.notifEmpty}>No notifications</div>
                      : notifs.slice(0, 15).map(n => (
                        <div key={n.id} className={`${styles.notifItem} ${!n.is_read ? styles.unread : ''}`} onClick={() => { if (n.link) nav(n.link); setNotifOpen(false); }}>
                          <span className={styles.notifMsg}>{n.message}</span>
                          <span className={styles.notifTime}>{timeAgo(n.created_at)}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className={styles.userMenu}>
                <button className={styles.userBtn} onClick={() => setUserOpen(o => !o)}>
                  <div className={styles.avatar}>
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : user.username[0].toUpperCase()
                    }
                  </div>
                  <span>{user.username}</span>
                  {user.is_owner && <Crown size={12} style={{ color: '#f59e0b' }} />}
                  {user.role === 'admin' && !user.is_owner && <Shield size={12} style={{ color: 'var(--accent)' }} />}
                  {user.is_verified && <VerifiedIcon />}
                  <ChevronDown size={13} />
                </button>
                {userOpen && (
                  <div className={styles.dropdown + ' animate-scale'}>
                    <Link to={`/u/${user.username}`} className={styles.dropItem} onClick={() => setUserOpen(false)}><User size={14} /> Profile</Link>
                    {(user.role === 'admin' || user.is_owner) && (
                      <Link to="/admin" className={styles.dropItem} onClick={() => setUserOpen(false)}><Shield size={14} /> Admin</Link>
                    )}
                    <div className={styles.dropDivider} />
                    <button className={styles.dropItem} onClick={() => { logout(); setUserOpen(false); }}><LogOut size={14} /> Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost btn-sm"><LogIn size={14} />Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
