import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import styles from './VerifyEmail.module.css';

// This page is no longer needed for the email flow —
// verification happens on-screen right after registration.
// Redirect anyone who lands here to login.
export default function VerifyEmail() {
  const nav = useNavigate();
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}><Zap size={20} style={{ color: 'var(--accent)' }} /><span>RXScripts</span></div>
        <div className={styles.result}>
          <p style={{ fontSize: '2rem' }}>🔐</p>
          <h2>Verification</h2>
          <p className="text-muted">Verification codes are shown on-screen right after you register. No email link needed.</p>
          <button className="btn btn-primary w-full" onClick={() => nav('/login')}>Go to sign in</button>
        </div>
      </div>
    </div>
  );
}
