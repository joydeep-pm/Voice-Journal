import type { Workspace } from '@/src/db/types';

let activeWorkspace: Workspace = 'professional';

export function getActiveWorkspaceState(): Workspace {
  return activeWorkspace;
}

export function setActiveWorkspaceState(workspace: Workspace): void {
  activeWorkspace = workspace;
}

export const WORKSPACES: Workspace[] = ['professional', 'personal'];
