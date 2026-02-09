import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_ENABLED = process.env.EXPO_PUBLIC_BIOMETRIC_LOCK === '1';

type BiometricGateState = {
  ready: boolean;
  enabled: boolean;
  supported: boolean;
  unlocked: boolean;
  error: string | null;
  unlock: () => Promise<void>;
};

export function useBiometricGate(): BiometricGateState {
  const [ready, setReady] = useState(!BIOMETRIC_ENABLED);
  const [supported, setSupported] = useState(false);
  const [unlocked, setUnlocked] = useState(!BIOMETRIC_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const unlock = useCallback(async () => {
    if (!BIOMETRIC_ENABLED) {
      setUnlocked(true);
      setReady(true);
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Voice Journal',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    if (result.success) {
      setUnlocked(true);
      setError(null);
      return;
    }

    setUnlocked(false);
    setError(result.error ? `Biometric auth failed: ${result.error}` : 'Biometric auth was cancelled.');
  }, []);

  useEffect(() => {
    if (!BIOMETRIC_ENABLED) {
      return;
    }

    const init = async () => {
      try {
        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        const canUse = hasHardware && isEnrolled;
        setSupported(canUse);

        if (!canUse) {
          setUnlocked(true);
          setError(null);
          setReady(true);
          return;
        }

        await unlock();
      } catch (initError) {
        setUnlocked(true);
        setError(initError instanceof Error ? initError.message : 'Biometric check failed.');
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [unlock]);

  useEffect(() => {
    if (!BIOMETRIC_ENABLED || !supported) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (previous === 'active' && nextState.match(/inactive|background/)) {
        setUnlocked(false);
        return;
      }

      if (previous.match(/inactive|background/) && nextState === 'active') {
        void unlock();
      }
    });

    return () => subscription.remove();
  }, [supported, unlock]);

  return {
    ready,
    enabled: BIOMETRIC_ENABLED,
    supported,
    unlocked,
    error,
    unlock,
  };
}
