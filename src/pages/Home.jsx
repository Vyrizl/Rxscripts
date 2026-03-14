import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, Download, Eye, Users, TrendingUp, Zap, ArrowRight, Star } from 'lucide-react';
import api from '../lib/api';
import ScriptCard from '../components/ScriptCard';
import styles from './Home.module.css';

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className={styles.statBox}>
      <Icon size={18} style={{ color: 'var(--accent)' }} />
      <div>
        <div className={styles.statVal}>{value?.toLocaleString() || '0'}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [recent, setRecent] = useState([]);
  const [popular, setPopular] = useState([]);

  useEffect(() => {
    api.get('/data/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/community/announcements').then(r => setAnnouncements(r.data.announcements || [])).catch(() => {});
    api.get('/scripts?sort=newest&limit=6').then(r => setRecent(r.data.scripts || [])).catch(() => {});
    api.get('/scripts?sort=downloads&limit=6').then(r => setPopular(r.data.scripts || [])).catch(() => {});
  }, []);

  return (
    <div>
      {announcements.length > 0 && (
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px 0' }}>
          {announcements.map(a => (
            <div key={a.id} className={`announcement ${a.type}`}>
              <strong>{a.title}</strong> — {a.content}
            </div>
          ))}
        </div>
      )}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className="page">
          <div className={styles.heroInner}>
            <div className={styles.pill}>
              <Zap size={12} />
              The definitive Roblox script repository
            </div>
            <h1 className={styles.heroTitle}>
              Find scripts that<br />
              <span className={styles.accent}>actually work</span>
            </h1>
            <p className={styles.heroSub}>
              Browse {stats?.total_scripts || '100+'}  community-submitted Roblox scripts.
              Rated, tagged, and kept up to date.
            </p>
            <div className={styles.heroCta}>
              <Link to="/scripts" className="btn btn-primary btn-lg">
                <Code2 size={16} />
                Browse Scripts
              </Link>
              <Link to="/upload" className="btn btn-ghost btn-lg">
                Upload Script
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="page">
        <div className={styles.statsRow}>
          <StatBox icon={Code2} label="Scripts" value={stats?.total_scripts} />
          <StatBox icon={Download} label="Downloads" value={stats?.total_downloads} />
          <StatBox icon={Eye} label="Views" value={stats?.total_views} />
          <StatBox icon={Users} label="Members" value={stats?.total_users} />
        </div>

        {stats?.recent?.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2><Zap size={20} style={{ color: 'var(--accent)' }} /> New Uploads</h2>
              <Link to="/scripts?sort=newest" className={styles.viewAll}>
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid-scripts">
              {stats.recent.map(s => <ScriptCard key={s.slug} script={s} />)}
            </div>
          </section>
        )}

        {stats?.popular?.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2><TrendingUp size={20} style={{ color: 'var(--accent)' }} /> Most Downloaded</h2>
              <Link to="/scripts?sort=downloads" className={styles.viewAll}>
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid-scripts">
              {stats.popular.map(s => <ScriptCard key={s.slug} script={s} />)}
            </div>
          </section>
        )}

        {!stats?.recent?.length && (
          <div className={styles.empty}>
            <Code2 size={48} style={{ color: 'var(--text-3)' }} />
            <h2>No scripts yet</h2>
            <p>Be the first to upload a script.</p>
            <Link to="/upload" className="btn btn-primary">Upload Script</Link>
          </div>
        )}
      </div>
    </div>
  );
}
