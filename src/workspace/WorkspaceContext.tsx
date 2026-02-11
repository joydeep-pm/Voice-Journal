import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { initializeWorkspaceDatabases } from '@/src/db/client';
import type { Workspace, WorkspaceInitState } from '@/src/db/types';
import { getActiveWorkspaceState, setActiveWorkspaceState } from '@/src/workspace/state';

const PREFERENCE_FILENAME = 'workspace-preference.json';

type WorkspaceContextValue = {
  activeWorkspace: Workspace;
  ready: boolean;
  switchEnabled: boolean;
  migrationError: string | null;
  setActiveWorkspace: (workspace: Workspace) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function preferencePath(): string | null {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!base) {
    return null;
  }
  return `${base}${PREFERENCE_FILENAME}`;
}

async function readWorkspacePreference(): Promise<Workspace | null> {
  const path = preferencePath();
  if (!path) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return null;
    }

    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as { activeWorkspace?: unknown };
    if (parsed.activeWorkspace === 'professional' || parsed.activeWorkspace === 'personal') {
      return parsed.activeWorkspace;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeWorkspacePreference(workspace: Workspace): Promise<void> {
  const path = preferencePath();
  if (!path) {
    return;
  }

  await FileSystem.writeAsStringAsync(path, JSON.stringify({ activeWorkspace: workspace }));
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [activeWorkspace, setActiveWorkspaceValue] = useState<Workspace>(getActiveWorkspaceState());
  const [ready, setReady] = useState(false);
  const [initState, setInitState] = useState<WorkspaceInitState>({
    switchEnabled: true,
    professionalSource: 'professional',
    migrationError: null,
  });

  useEffect(() => {
    void (async () => {
      const nextInitState = await initializeWorkspaceDatabases();
      setInitState(nextInitState);

      const preferred = await readWorkspacePreference();
      const defaultWorkspace: Workspace = nextInitState.switchEnabled ? preferred ?? 'professional' : 'professional';
      setActiveWorkspaceState(defaultWorkspace);
      setActiveWorkspaceValue(defaultWorkspace);
      setReady(true);
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'Workspace setup failed.';
      setInitState({
        switchEnabled: false,
        professionalSource: 'legacy',
        migrationError: message,
      });
      setActiveWorkspaceState('professional');
      setActiveWorkspaceValue('professional');
      setReady(true);
    });
  }, []);

  const setActiveWorkspace = useCallback(
    async (workspace: Workspace) => {
      if (!initState.switchEnabled) {
        return;
      }
      setActiveWorkspaceState(workspace);
      setActiveWorkspaceValue(workspace);
      await writeWorkspacePreference(workspace);
    },
    [initState.switchEnabled]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeWorkspace,
      ready,
      switchEnabled: initState.switchEnabled,
      migrationError: initState.migrationError,
      setActiveWorkspace,
    }),
    [activeWorkspace, ready, initState.switchEnabled, initState.migrationError, setActiveWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace must be used within WorkspaceProvider.');
  }
  return value;
}
