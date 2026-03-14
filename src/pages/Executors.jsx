import { useEffect, useState } from 'react';
import { Cpu, ExternalLink, Download, Shield, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';
import styles from './Executors.module.css';

export default function Executors() {
  const [executors, setExecutors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/data/executors').then(r => setExecutors(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div className={styles.header}>
        <h1>Executors</h1>
        <p className="text-muted">Supported script executors and their compatibility ratings.</p>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
        </div>
      ) : executors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-2)' }}>
          <Cpu size={40} style={{ margin: '0 auto 16px', color: 'var(--text-3)' }} />
          <p>No executors listed yet.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {executors.map(e => (
            <div key={e.id} className={`card ${styles.card}`}>
              <div className={styles.cardTop}>
                {e.logo_url ? <img src={e.logo_url} alt={e.name} className={styles.logo} /> : <Cpu size={24} style={{ color: 'var(--accent)' }} />}
                <div>
                  <h3 className={styles.name}>{e.name}</h3>
                  <div className={styles.meta}>
                    {e.is_free ? <span className="badge badge-green">Free</span> : <span className="badge badge-yellow">Paid</span>}
                    <span className="badge badge-gray">{e.platform}</span>
                    {e.status === 'detected' && <span className="badge badge-red">Detected</span>}
                  </div>
                </div>
              </div>

              {e.description && <p className={styles.desc}>{e.description}</p>}

              <div className={styles.scores}>
                <div className={styles.score}>
                  <span className="text-xs text-muted mono">UNC</span>
                  <div className={styles.scoreBar}>
                    <div className={styles.scoreBarFill} style={{ width: `${e.unc_score}%`, background: 'var(--accent)' }} />
                  </div>
                  <span className="mono text-xs">{e.unc_score}%</span>
                </div>
                <div className={styles.score}>
                  <span className="text-xs text-muted mono">sUNC</span>
                  <div className={styles.scoreBar}>
                    <div className={styles.scoreBarFill} style={{ width: `${e.sunc_score}%`, background: 'var(--green)' }} />
                  </div>
                  <span className="mono text-xs">{e.sunc_score}%</span>
                </div>
              </div>

              <div className={styles.links}>
                {e.website_url && (
                  <a href={e.website_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                    <ExternalLink size={13} /> Website
                  </a>
                )}
                {e.download_url && (
                  <a href={e.download_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                    <Download size={13} /> Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
