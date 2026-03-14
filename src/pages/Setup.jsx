import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle, Loader2, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import styles from './Setup.module.css';

export default function Setup() {
  const [phase, setPhase] = useState('checking');
  const [form, setForm] = useState({ adminUsername: 'admin', adminEmail: '', adminPassword: '', setupKey: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/setup')
      .then(r => setPhase(r.data.complete ? 'locked' : 'form'))
      .catch(() => setPhase('form'));
  }, []);

  const submit = async () => {
    setError('');
    if (!form.adminEmail || !form.adminPassword || !form.setupKey) {
      setError('All fields are required.');
      return;
    }
    if (form.adminPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/setup', form);
      setPhase('done');
    } catch (e) {
      setError(e.response?.data?.error || 'Setup failed. Check your setup key.');
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'checking') return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Loader2 size={32} className={styles.spin} style={{ color: 'var(--accent)' }} />
        <p className="text-muted">Checking setup status...</p>
      </div>
    </div>
  );

  if (phase === 'locked') return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Lock size={44} style={{ color: 'var(--text-3)' }} />
        <h2 className={styles.title}>Setup already complete</h2>
        <p className="text-muted" style={{ textAlign: 'center', lineHeight: 1.6 }}>
          This page has been permanently locked. RXScripts is already configured.
        </p>
        <button className="btn btn-primary" onClick={() => nav('/')}>Go to homepage</button>
      </div>
    </div>
  );

  if (phase === 'done') return (
    <div className={styles.page}>
      <div className={styles.card}>
        <CheckCircle size={52} style={{ color: 'var(--green)' }} />
        <h2 className={styles.title}>RXScripts is ready</h2>
        <div className={styles.successList}>
          {['Database initialized', 'Admin account created', 'Setup page permanently locked'].map(s => (
            <div key={s} className={styles.successItem}>
              <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} /> {s}
            </div>
          ))}
        </div>
        <div className={styles.notice}>
          <AlertTriangle size={14} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          Log in immediately and change your password if it's weak.
        </div>
        <button className="btn btn-primary w-full" onClick={() => nav('/login')}>Sign in as admin</button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Zap size={26} style={{ color: 'var(--accent)' }} />
          <h1 className={styles.title}>RXScripts Setup</h1>
          <p className={styles.sub}>One-time configuration. This page locks permanently after completion.</p>
        </div>

        <div className={styles.warning}>
          <AlertTriangle size={14} style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 1 }} />
          <span>Complete this carefully — you cannot reopen this page without resetting the database.</span>
        </div>

        <div className={styles.form}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Admin Account</h3>

            <div className={styles.field}>
              <label>Username</label>
              <input className="input" value={form.adminUsername} onChange={e => set('adminUsername', e.target.value)} placeholder="admin" autoComplete="off" />
            </div>

            <div className={styles.field}>
              <label>Email</label>
              <input className="input" type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@example.com" autoComplete="off" />
            </div>

            <div className={styles.field}>
              <label>Password</label>
              <div className={styles.passWrap}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={form.adminPassword}
                  onChange={e => set('adminPassword', e.target.value)}
                  placeholder="Minimum 8 characters"
                  style={{ paddingRight: 40 }}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.passToggle} onClick={() => setShowPass(s => !s)} tabIndex={-1}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Authorization</h3>
            <div className={styles.field}>
              <label>Setup Key</label>
              <input
                className="input"
                type="password"
                value={form.setupKey}
                onChange={e => set('setupKey', e.target.value)}
                placeholder="Your SETUP_KEY env var"
                onKeyDown={e => e.key === 'Enter' && submit()}
                autoComplete="off"
              />
              <span className={styles.hint}>Set SETUP_KEY in Netlify → Site settings → Environment variables</span>
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <button className="btn btn-primary w-full" onClick={submit} disabled={loading}>
            {loading && <Loader2 size={15} className={styles.spin} />}
            Initialize RXScripts
          </button>
        </div>
      </div>
    </div>
  );
}
