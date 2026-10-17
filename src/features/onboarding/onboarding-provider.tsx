/**
 * First-run onboarding state.
 *
 * Onboarding is deliberately separate from authentication: whether the user has
 * seen the intro slides is a local, device-level flag, independent of whether a
 * backend session exists. Keeping it in its own provider means the auth state
 * machine stays focused on tokens/network while routing can gate on both.
 *
 * The flag is stored in AsyncStorage (non-sensitive, rebuilt from the UI on
 * failure) under a single versioned key.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'studygo.onboarded';

export interface OnboardingValue {
  /** False until the stored flag has been read; the boot gate waits for it. */
  isReady: boolean;
  hasOnboarded: boolean;
  completeOnboarding(): void;
  resetOnboarding(): void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(ONBOARDING_KEY);
      } catch {
        // Unreadable storage: treat as "not onboarded" rather than blocking.
      }
      if (!active) {
        return;
      }
      setHasOnboarded(stored === 'true');
      setIsReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasOnboarded(true);
    void AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {
      // Best-effort: the in-memory state is already updated.
    });
  }, []);

  const resetOnboarding = useCallback(() => {
    setHasOnboarded(false);
    void AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => {
      // Best-effort.
    });
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({ isReady, hasOnboarded, completeOnboarding, resetOnboarding }),
    [isReady, hasOnboarded, completeOnboarding, resetOnboarding],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

/** Access onboarding state. Must be used under an `OnboardingProvider`. */
export function useOnboarding(): OnboardingValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
