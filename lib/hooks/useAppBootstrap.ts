import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useJournalStore } from '@/lib/store';

export function useAppBootstrap() {
  const bootstrap = useJournalStore((state) => state.bootstrap);
  const runWorkerNow = useJournalStore((state) => state.runWorkerNow);

  useEffect(() => {
    void bootstrap();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runWorkerNow();
      }
    });

    return () => subscription.remove();
  }, [bootstrap, runWorkerNow]);
}
