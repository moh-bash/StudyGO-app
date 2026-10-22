/**
 * Authentication state for the app.
 *
 * Exposes a small, explicit state machine:
 *
 * - `initializing`: reading stored tokens and performing the first validation.
 * - `authenticated`: the backend validated the session (online + authenticated).
 * - `offline`: the device genuinely could not reach the backend; tokens are
 *   retained and the app may continue with locally available data. This is
 *   **not** proof of a remote session.
 * - `server-error`: the backend was reachable but did not give a usable answer
 *   (5xx / malformed body / no answer within the startup deadline). Tokens are
 *   retained like `offline`, but the device is online — the UI must not claim a
 *   connectivity problem.
 * - `unauthenticated`: no stored session, or the backend explicitly rejected
 *   the credentials (local credentials cleared).
 *
 * Session logic lives in `./session`; this module only holds React state and
 * wires it together. Profile updates keep object identity stable (see
 * `./user-equality`) so a repeated validation of an unchanged profile never
 * re-renders consumers or restarts memoized effects.
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
import { onBackendReachable } from '../api/client';
import type { User } from '../api/types';
import * as session from './session';
import { onSessionInvalidated } from './session';
import type { RestoreOutcome } from './session';
import { sameUser } from './user-equality';
import { clearCoursesData } from '../db/database';

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'offline'
  | 'server-error'
  | 'unauthenticated';

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
    // Keep the previous object reference when nothing changed: every validation
    // returns a fresh `GET /auth/me` object, and unconditional replacement
    // churned `useAuth()` consumers and invalidated `[user]`-keyed memos
    // (the `useCatalog` refetch loop). React bails out when we return `prev`.
    const settleProfile = (next: User | null) => {
      setUser((prev) => (sameUser(prev, next) ? prev : next));
    };
    switch (outcome.state) {
      case 'authenticated':
        settleProfile(outcome.user);
        setStatus('authenticated');
        break;
      case 'offline':
        // Transport failure: local-only access, tokens kept. The user object is
        // the cached profile snapshot — equally stable via `settleProfile`.
        settleProfile(outcome.user);
        setStatus('offline');
        break;
      case 'server-error':
        // The backend was reachable but failed or did not answer in time (5xx,
        // malformed body, startup deadline): local-only access, tokens kept,
        // and the UI is told the server is unhealthy — not offline.
        settleProfile(outcome.user);
        setStatus('server-error');
        break;
      case 'rejected':
      case 'none':
        settleProfile(null);
        setStatus('unauthenticated');
        // Wipe locally cached course data on any terminal restore outcome so a
        // rejected/absent session never leaves another account's catalog behind.
        void clearCoursesData().catch(() => undefined);
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

  // Re-validate when the app returns to the foreground while local-only
  // (offline *or* server-error). Relies on the single-flight guard rather than
  // a timer, so rapid changes do not cause duplicate requests and the backend
  // is never polled continuously.
  useEffect(() => {
    if (status !== 'offline' && status !== 'server-error') {
      return;
    }
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void validate();
      }
    });
    return () => subscription.remove();
  }, [status, validate]);

  // Clear a stale local-only state as soon as *any* request proves the backend
  // is reachable again. Without this, a single transient failure at boot (or on
  // the foreground re-check) would leave the banner up forever, even while
  // catalog/other requests are succeeding — the reported bug. The recovery
  // chain cannot loop: a successful validation settles `user` with a stable
  // reference (`sameUser`), so `useCatalog`'s scope does not change, no new
  // catalog request fires, and no new `onBackendReachable` is emitted from this
  // cycle. We only react while local-only, and reuse the single-flight
  // `validate()` so this never becomes polling or a duplicate restore.
  useEffect(() => {
    return onBackendReachable(() => {
      if (mounted.current && (statusRef.current === 'offline' || statusRef.current === 'server-error')) {
        void validate();
      }
    });
  }, [validate]);

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
      // Local-only covers both honest degraded states: unreachable transport
      // (`offline`) and a reachable-but-failing backend (`server-error`).
      isLocalOnly: status === 'offline' || status === 'server-error',
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
