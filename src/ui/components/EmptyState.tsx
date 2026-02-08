import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/src/ui/components/Button';
import { Text } from '@/src/ui/components/Text';
import { color, radius, spacing } from '@/src/ui/tokens';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <View style={styles.base}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text variant="h2" style={styles.centerText}>
        {title}
      </Text>
      <Text variant="muted" style={styles.centerText}>
        {description}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[24],
  },
  iconWrap: {
    width: spacing[32] * 2,
    height: spacing[32] * 2,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  action: {
    width: '100%',
  },
});
