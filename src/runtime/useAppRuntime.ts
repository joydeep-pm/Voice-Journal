import { useEffect } from 'react';
import { AppState } from 'react-native';
import { runAiWorker } from '@/src/ai/worker';
import { initDb } from '@/src/db/client';

export function useAppRuntime() {
  useEffect(() => {
    void initDb()
      .then(() => runAiWorker())
      .catch((error) => {
        console.error('App runtime init failed', error);
      });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runAiWorker().catch((error) => {
          console.error('AI worker on foreground failed', error);
        });
      }
    });

    return () => sub.remove();
  }, []);
}
