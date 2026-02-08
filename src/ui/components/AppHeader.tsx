import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/src/ui/components/Text';
import { space } from '@/src/ui/tokens';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
  compact?: boolean;
  titleVariant?: 'display' | 'h1';
};

export function AppHeader({ title, subtitle, rightAction, compact = false, titleVariant = 'display' }: AppHeaderProps) {
  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      <View style={styles.textWrap}>
        <Text variant={titleVariant}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="secondary">{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
