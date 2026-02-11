import { useEffect } from 'react';
import { AppState } from 'react-native';
import { runAiWorker } from '@/src/ai/worker';
import { initDb } from '@/src/db/client';
import { useWorkspace } from '@/src/workspace/WorkspaceContext';
import { WORKSPACES } from '@/src/workspace/state';

export function useAppRuntime() {
  const { ready, activeWorkspace } = useWorkspace();

  useEffect(() => {
    if (!ready) {
      return;
    }

    void initDb(activeWorkspace)
      .then(async () => {
        await Promise.all(WORKSPACES.map((workspace) => runAiWorker(undefined, { workspace })));
      })
      .catch((error) => {
        console.error('App runtime init failed', error);
      });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void Promise.all(WORKSPACES.map((workspace) => runAiWorker(undefined, { workspace }))).catch((error) => {
          console.error('AI worker on foreground failed', error);
        });
      }
    });

    return () => sub.remove();
  }, [ready, activeWorkspace]);
}
