import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, setOnAuthLost } from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // isReady distinguishes "we haven't checked yet" from "we checked and
  // there's no one logged in" — without this, a PrivateRoute would flash-
  // redirect to /signin on every hard refresh before the silent-refresh
  // attempt has had a chance to run.
  const [isReady, setIsReady] = useState(false);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logging out should feel instantaneous client-side even if the
      // network call fails (e.g. offline) — local state is cleared regardless.
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnAuthLost(() => {
      setUser(null);
    });
  }, []);

  // On first load, there's no access token in memory (it's never persisted),
  // so we attempt one silent refresh using the httpOnly cookie. If that
  // fails, the user is simply signed out — this is expected, not an error.
  useEffect(() => {
    (async () => {
      try {
        const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
        if (!csrfMatch) {
          setIsReady(true);
          return;
        }
        const response = await api.post(
          '/auth/refresh',
          {},
          { headers: { 'X-CSRF-Token': decodeURIComponent(csrfMatch[1]) } }
        );
        setAccessToken(response.data.accessToken);
        // We don't get user details back from /refresh by design (it only
        // issues a token) — fetch the account's own subscription/profile
        // info as a lightweight "who am I" check instead.
        const me = await api.get('/subscription/me');
        setUser({ planTier: me.data.planTier });
      } catch {
        setUser(null);
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    const response = await api.post('/auth/signup', { email, password, name });
    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isReady, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
