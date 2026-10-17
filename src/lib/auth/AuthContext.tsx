/**
 * Authentication state for the app.
 *
 * Exposes a small, explicit state machine:
 *
 * - `initializing`: reading stored tokens and performing the first validation.
 * - `authenticated`: the backend validated the session (online + authenticated).
 * - `offline`: the backend could not be reached; tokens are retained and the
 *   app may continue with locally available data. This is **not** proof of a
 *   remote session.
 * - `unauthenticated`: no stored session, or the backend explicitly rejected
 *   the credentials (local credentials cleared).
 *
 * Session logic lives in `./session`; this module only holds React state and
 * wires it together.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { User } from '../api/types';
import * as session from './session';
import { onSessionInvalidated } from './session';
import type { RestoreOutcome } from './session';
import { clearCoursesData } from '../db/database';

export type AuthStatus = 'initializing' | 'authenticated' | 'offline' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** True while the backend session is unverified but local access is allowed. */
  isLocalOnly: boolean;
  signIn(email: string, password: string): Promise<User>;
  signUp(input: session.SignUpInput): Promise<User>;
  signOut(): Promise<void>;
  /** Retries remote session validation (used by the offline banner/foreground). */
  reconnect(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<User | null>(null);
  const restoring = useRef(false);
  const mounted = useRef(true);
  const statusRef = useRef<AuthStatus>('initializing');
  // Monotonic operation id. A restore/validation captures the current value and
  // only applies its result if no newer operation (sign-in, sign-up, sign-out)
  // has started meanwhile. This stops a slow in-flight restore from resurrecting
  // a session after the user signed out.
  const opRef = useRef(0);

  const applyOutcome = useCallback((outcome: RestoreOutcome, op: number) => {
    if (!mounted.current || op !== opRef.current) {
      return;
    }
    switch (outcome.state) {
      case 'authenticated':
        setUser(outcome.user);
        setStatus('authenticated');
        break;
      case 'offline':
        setUser(outcome.user);
        setStatus('offline');
        break;
      case 'rejected':
      case 'none':
        setUser(null);
        setStatus('unauthenticated');
        break;
    }
  }, []);

  const validate = useCallback(async () => {
    if (restoring.current) {
      return;
    }
    restoring.current = true;
    const op = ++opRef.current;
    try {
      const outcome = await session.restoreSession();
      applyOutcome(outcome, op);
    } catch {
      // Unexpected (storage) failure. Never strand the app on the loader; only
      // downgrade the very first attempt, and never disrupt an established
      // offline session on a later reconnect attempt.
      if (op === opRef.current && mounted.current && statusRef.current === 'initializing') {
        setUser(null);
        setStatus('unauthenticated');
      }
    } finally {
      restoring.current = false;
    }
  }, [applyOutcome]);

  const started = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      void validate();
    }
    return () => {
      mounted.current = false;
    };
  }, [validate]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const signIn = useCallback(async (email: string, password: string) => {
    const signedInUser = await session.signIn(email, password);
    opRef.current += 1; // supersede any in-flight restore
    setUser(signedInUser);
    setStatus('authenticated');
    return signedInUser;
  }, []);

  const signUp = useCallback(async (input: session.SignUpInput) => {
    const signedUpUser = await session.signUp(input);
    opRef.current += 1; // supersede any in-flight restore
    setUser(signedUpUser);
    setStatus('authenticated');
    return signedUpUser;
  }, []);

  const signOut = useCallback(async () => {
    // Invalidate any in-flight restore/refresh result *before* clearing, so a
    // late response cannot restore the session, and sign the UI out immediately
    // even if the server is unreachable. Local sign-out must always succeed.
    opRef.current += 1;
    setUser(null);
    setStatus('unauthenticated');
    try {
      await clearCoursesData();
    } catch {
      // best-effort
    }
    await session.logout();
  }, []);

  const reconnect = useCallback(async () => {
    await validate();
  }, [validate]);

  // Re-validate when the app returns to the foreground while offline. Relies on
  // the single-flight guard rather than a timer, so rapid changes do not cause
  // duplicate requests and the backend is never polled continuously.
  useEffect(() => {
    if (status !== 'offline') {
      return;
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void validate();
      }
    });
    return () => subscription.remove();
  }, [status, validate]);

  // Return to the signed-out state when a background request discovers the
  // session was rejected by the backend (refresh returned 401/403). The session
  // service has already cleared local credentials by this point.
  useEffect(() => {
    return onSessionInvalidated(() => {
      if (!mounted.current) {
        return;
      }
      opRef.current += 1; // discard any in-flight restore result
      setUser(null);
      setStatus('unauthenticated');
      void clearCoursesData().catch(() => undefined);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLocalOnly: status === 'offline',
      signIn,
      signUp,
      signOut,
      reconnect,
    }),
    [status, user, signIn, signUp, signOut, reconnect],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the authentication context. Must be used under an `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
