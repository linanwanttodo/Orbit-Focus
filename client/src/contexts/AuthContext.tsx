import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthUser } from '../types';
import {
  AuthReason,
  fetchCurrentUser,
  getAuthToken,
  githubLoginUrl,
  loginWithQqAccount,
  registerQqAccount,
  setAuthToken,
} from '../services/apiService';
import { migrateLocalDataToCloud } from '../services/store';

export interface QqCredentials {
  qq: string;
  email: string;
  password: string;
}

/**
 * Outcome of a credential attempt. `ok` is explicit rather than inferred
 * from `reason` being null, because a network failure carries no reason code
 * yet is still a failure.
 */
export interface AuthAttempt {
  ok: boolean;
  reason: AuthReason | null;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True once the initial session check finished (or was skipped). */
  isReady: boolean;
  login: () => void;
  /** Sign in with an existing QQ account. */
  loginWithPassword: (input: QqCredentials) => Promise<AuthAttempt>;
  /** Create a QQ account and sign in. */
  registerWithPassword: (input: QqCredentials) => Promise<AuthAttempt>;
  logout: () => void;
}

const FAILED_ATTEMPT: AuthAttempt = { ok: false, reason: null, status: 0 };

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isReady: false,
  login: () => undefined,
  loginWithPassword: async () => FAILED_ATTEMPT,
  registerWithPassword: async () => FAILED_ATTEMPT,
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

  /**
   * Store the token, adopt the returned user, and pull any anonymous local
   * data into the account - the same migration the OAuth path performs.
   *
   * Resolves with a reason code on failure, or null on success.
   */
  const adoptSession = useCallback(async (token: string, account: AuthUser) => {
    setAuthToken(token);
    setUser(account);
    try {
      await migrateLocalDataToCloud();
    } catch (error) {
      // A failed migration must not block the sign-in itself.
      console.error('Local data migration failed:', error);
    }
  }, []);

  const loginWithPassword = useCallback(
    async (input: QqCredentials): Promise<AuthAttempt> => {
      const result = await loginWithQqAccount({ qq: input.qq, password: input.password });
      if (!result.ok || !result.token || !result.user) {
        return { ok: false, reason: result.reason, status: result.status };
      }
      await adoptSession(result.token, result.user);
      return { ok: true, reason: null, status: result.status };
    },
    [adoptSession]
  );

  const registerWithPassword = useCallback(
    async (input: QqCredentials): Promise<AuthAttempt> => {
      const result = await registerQqAccount(input);
      if (!result.ok || !result.token || !result.user) {
        return { ok: false, reason: result.reason, status: result.status };
      }
      await adoptSession(result.token, result.user);
      return { ok: true, reason: null, status: result.status };
    },
    [adoptSession]
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, login, loginWithPassword, registerWithPassword, logout }),
    [user, isReady, login, loginWithPassword, registerWithPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
