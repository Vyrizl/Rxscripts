import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import api from '../lib/api';
import styles from './Auth.module.css';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

function TurnstileWidget({ onVerify, resetSignal }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  const render = useCallback(() => {
    if (!ref.current || !TURNSTILE_SITE_KEY || !window.turnstile) return;
    if (widgetId.current != null) { window.turnstile.reset(widgetId.current); return; }
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: TURNSTILE_SITE_KEY, theme: 'dark',
      callback: token => onVerify(token),
      'expired-callback': () => onVerify(''),
      'error-callback': () => onVerify('')
    });
  }, [onVerify]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (window.turnstile) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.onload = render;
    document.head.appendChild(s);
  }, [render]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current != null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onVerify('');
    }
  }, [resetSignal, onVerify]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className={styles.turnstile} />;
}

// ── Email sent / code entry screen ──────────────────────────────────────────
function VerifyCodeScreen({ pendingId, email, onSuccess, onBack }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);
  const toast = useToast();

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError('');
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = e => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      setDigits(paste.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const submit = async () => {
    const code = digits.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify', { pendingId, code });
      toast('Account verified!', 'success');
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.error || 'Invalid or expired code');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { pendingId });
      toast('New code sent to your email', 'success');
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to resend', 'error');
    } finally { setResending(false); }
  };

  return (
    <div className={styles.verifyScreen + ' animate-scale'}>
      <div className={styles.verifyIcon}>✉️</div>
      <h2 className={styles.verifyTitle}>Check your email</h2>
      <p className={styles.verifySub}>
        A 6-digit verification code was sent to <strong>{email}</strong>. Enter it below.
      </p>

      <div className={styles.digitRow} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            className={styles.digitInput + (error ? ' ' + styles.digitError : '')}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && <p className={styles.codeError}>{error}</p>}

      <button className="btn btn-primary w-full" onClick={submit} disabled={loading || digits.join('').length < 6}>
        {loading && <Loader2 size={14} className={styles.spin} />}
        Verify Account
      </button>

      <div className={styles.resendRow}>
        <span className="text-muted" style={{ fontSize: '0.8rem' }}>Didn't get it?</span>
        <button className={styles.resendBtn} onClick={resend} disabled={resending}>
          <RefreshCw size={12} /> {resending ? 'Sending...' : 'Resend code'}
        </button>
      </div>

      <button className="btn btn-ghost w-full" style={{ fontSize: '0.8rem' }} onClick={onBack}>
        Back to sign in
      </button>
    </div>
  );
}

// ── Main Auth page ───────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', login: '', remember: false });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyState, setVerifyState] = useState(null); // { userId, code }
  const { login, register } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const resetCaptcha = () => setCaptchaReset(s => s + 1);

  const submit = async () => {
    if (TURNSTILE_SITE_KEY && !captchaToken) { toast('Please complete the captcha', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.login, form.password, form.remember, captchaToken);
        nav('/');
      } else {
        const r = await register(form.username, form.email, form.password, captchaToken);
        // Show the verification code screen immediately
        setVerifyState({ userId: r.userId, email: form.email });
      }
    } catch (e) {
      const errCode = e.response?.data?.code;
      const uid = e.response?.data?.userId;
  
      toast(e.response?.data?.error || 'Something went wrong', 'error');
      resetCaptcha();
    } finally { setLoading(false); }
  };

  // Unverified login attempt — fetch a new code for them
  useEffect(() => {
    if (!unverifiedUserId) return;
    api.post('/auth/resend-verification', { userId: unverifiedUserId })
      .then(() => setVerifyState({ userId: unverifiedUserId, email: '(your registered email)' }))
      .catch(() => toast('Could not generate verification code', 'error'))
      .finally(() => setUnverifiedUserId(null));
  }, [unverifiedUserId]);

  // Show verify screen
  if (verifyState) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}><Zap size={22} style={{ color: 'var(--accent)' }} /><span>RXScripts</span></div>
        <VerifyCodeScreen
          pendingId={verifyState.pendingId}
          email={verifyState.email}
          onSuccess={() => { setVerifyState(null); setMode('login'); toast('Now sign in to your account', 'success'); }}
          onBack={() => { setVerifyState(null); setMode('login'); resetCaptcha(); }}
        />
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}><Zap size={22} style={{ color: 'var(--accent)' }} /><span>RXScripts</span></div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${mode === 'login' ? styles.active : ''}`} onClick={() => { setMode('login'); resetCaptcha(); }}>Sign In</button>
          <button className={`${styles.tab} ${mode === 'register' ? styles.active : ''}`} onClick={() => { setMode('register'); resetCaptcha(); }}>Register</button>
        </div>

        <div className={styles.form}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label>Username</label>
              <input className="input" placeholder="your_username" value={form.username} onChange={e => set('username', e.target.value)} autoComplete="username" />
              <span className={styles.hint}>3–20 chars, letters/numbers/underscores only</span>
            </div>
          )}

          <div className={styles.field}>
            <label>{mode === 'login' ? 'Username or Email' : 'Email'}</label>
            <input className="input" type={mode === 'register' ? 'email' : 'text'} placeholder={mode === 'login' ? 'username or email' : 'your@email.com'} value={mode === 'login' ? form.login : form.email} onChange={e => set(mode === 'login' ? 'login' : 'email', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoComplete={mode === 'register' ? 'email' : 'username'} />
          </div>

          <div className={styles.field}>
            <label>Password</label>
            <div className={styles.passWrap}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} style={{ paddingRight: 40 }} />
              <button type="button" className={styles.passToggle} onClick={() => setShowPass(s => !s)} tabIndex={-1}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {mode === 'register' && <span className={styles.hint}>Minimum 6 characters</span>}
          </div>

          {mode === 'login' && (
            <label className={styles.rememberRow}>
              <input type="checkbox" checked={form.remember} onChange={e => set('remember', e.target.checked)} />
              <span>Keep me logged in for 30 days</span>
            </label>
          )}

          <TurnstileWidget onVerify={setCaptchaToken} resetSignal={captchaReset} />

          <button className="btn btn-primary w-full" style={{ marginTop: 4 }} onClick={submit} disabled={loading}>
            {loading && <Loader2 size={15} className={styles.spin} />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'register' && (
            <p className={styles.terms}>
              By registering you agree to our rules. A verification code will be shown after signup — no email required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
