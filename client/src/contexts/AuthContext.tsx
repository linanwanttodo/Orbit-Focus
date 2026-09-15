import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthUser } from '../types';
import { fetchCurrentUser, getAuthToken, githubLoginUrl, setAuthToken } from '../services/apiService';
import { migrateLocalDataToCloud } from '../services/store';

interface AuthContextValue {
  user: AuthUser | null;
  /** True once the initial session check finished (or was skipped). */
  isReady: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isReady: false,
  login: () => undefined,
  logout: () => undefined,
});

// If the OAuth callback redirected to /auth-done, take the token from the
// URL fragment and rewrite the address bar back to "/" before first render.
function consumeOAuthRedirect(): void {
  try {
    const url = new URL(window.location.href);
    if (url.pathname !== '/auth-done') return;
    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    const token = params.get('token');
    if (token) {
      setAuthToken(token);
    } else {
      setAuthToken(null);
    }
    window.history.replaceState({}, '', '/');
  } catch {
    // Malformed URL - stay anonymous.
  }
}

consumeOAuthRedirect();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (getAuthToken()) {
        try {
          const me = await fetchCurrentUser();
          if (me) {
            await migrateLocalDataToCloud();
            if (!cancelled) setUser(me);
          } else {
            setAuthToken(null);
          }
        } catch (error) {
          console.error('Session check failed:', error);
          setAuthToken(null);
        }
      }
      if (!cancelled) setIsReady(true);
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.assign(githubLoginUrl());
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, isReady, login, logout }), [user, isReady, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
