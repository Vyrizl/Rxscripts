import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthCtx = createContext(null);
const TOKEN_KEY = 'rxs_token';
const EXPIRES_KEY = 'rxs_token_expires';

function isExpired() {
  const exp = localStorage.getItem(EXPIRES_KEY);
  if (!exp) return false;
  return Date.now() > parseInt(exp);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || isExpired()) { clearSession(); setLoading(false); return; }
    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => { if (isExpired()) { clearSession(); setUser(null); } }, 60_000);
    return () => clearInterval(id);
  }, []);

  const login = async (login, password, remember = false, captcha = '') => {
    const r = await api.post('/auth/login', { login, password, remember, captcha });
    localStorage.setItem(TOKEN_KEY, r.data.token);
    localStorage.setItem(EXPIRES_KEY, String(r.data.expiresAt));
    setUser(r.data.user);
    return r.data.user;
  };

  // Returns { pendingId, email, message } — caller shows verify screen
  const register = async (username, email, password, captcha = '') => {
    const r = await api.post('/auth/register', { username, email, password, captcha });
    return r.data;
  };

  const logout = () => { clearSession(); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
