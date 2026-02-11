import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/src/ui/components/Text';
import { border, color, radius, space, spacing } from '@/src/ui/tokens';
import { useWorkspace } from '@/src/workspace/WorkspaceContext';
import type { Workspace } from '@/src/db/types';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  compact?: boolean;
  titleVariant?: 'display' | 'h1';
  showWorkspaceSwitcher?: boolean;
};

const WORKSPACE_LABEL: Record<Workspace, string> = {
  professional: 'Professional',
  personal: 'Personal',
};

export function AppHeader({
  title,
  subtitle,
  rightAction,
  compact = false,
  titleVariant = 'display',
  showWorkspaceSwitcher = true,
}: AppHeaderProps) {
  const { activeWorkspace, setActiveWorkspace, switchEnabled } = useWorkspace();
  const [switching, setSwitching] = useState<Workspace | null>(null);

  const onSwitch = async (workspace: Workspace) => {
    if (!switchEnabled || workspace === activeWorkspace || switching) {
      return;
    }

    setSwitching(workspace);
    try {
      await setActiveWorkspace(workspace);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <View style={[styles.outer, compact ? styles.rowCompact : null]}>
      {showWorkspaceSwitcher ? (
        <View style={styles.workspaceRow}>
          <Text variant="caption" tone="secondary" compact>
            Workspace: {WORKSPACE_LABEL[activeWorkspace]}
          </Text>
          {switchEnabled ? (
            <View style={styles.switchWrap}>
              {(['professional', 'personal'] as Workspace[]).map((workspace) => {
                const selected = activeWorkspace === workspace;
                const pending = switching === workspace;
                return (
                  <Pressable
                    key={workspace}
                    onPress={() => {
                      void onSwitch(workspace);
                    }}
                    style={[styles.switchItem, selected ? styles.switchItemActive : null]}
                    disabled={Boolean(switching)}
                  >
                    <Text variant="caption" tone={selected ? 'accent' : 'secondary'} compact>
                      {pending ? '...' : WORKSPACE_LABEL[workspace]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text variant="caption" tone="danger" compact>
              Switch disabled
            </Text>
          )}
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.textWrap}>
          <Text variant={titleVariant}>{title}</Text>
          {subtitle ? <Text variant="caption" tone="secondary">{subtitle}</Text> : null}
        </View>
        {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    gap: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.cardGap,
  },
  rowCompact: {
    marginBottom: space.controlGap,
  },
  textWrap: {
    flex: 1,
    gap: space.compactGap,
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.controlGap,
  },
  switchWrap: {
    flexDirection: 'row',
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceSubtle,
    overflow: 'hidden',
  },
  switchItem: {
    paddingHorizontal: space.controlGap + spacing[4],
    paddingVertical: spacing[4],
    minWidth: spacing[32],
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchItemActive: {
    backgroundColor: color.accentSoft,
  },
});
