import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '@/src/ui/components/Button';
import { Text } from '@/src/ui/components/Text';
import { color, radius, space } from '@/src/ui/tokens';

type ChipProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  quiet?: boolean;
  dashed?: boolean;
  left?: ReactNode;
};

export function Chip({ label, onPress, disabled, style, quiet = true, dashed = false, left }: ChipProps) {
  if (dashed) {
    return (
      <View style={[styles.dashed, style]}>
        <Text variant="caption" tone="secondary" compact>
          {label}
        </Text>
      </View>
    );
  }

  const content = left ? (
    <View style={styles.row}>
      {left}
      <Text variant="caption" tone="accent" compact>
        {label}
      </Text>
    </View>
  ) : undefined;

  if (!onPress) {
    return (
      <View style={[styles.staticChip, quiet ? styles.staticQuiet : null, style]}>
        {content}
        {!content ? (
          <Text variant="caption" tone="accent" compact>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Button
      label={left ? '' : label}
      onPress={onPress}
      disabled={disabled}
      variant="secondary"
      compact
      quiet={quiet}
      left={content}
      style={[styles.chip, left ? styles.withIcon : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    minHeight: space.cardGap + space.cardGap + space.compactGap,
  },
  withIcon: {
    paddingHorizontal: space.controlGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.compactGap,
  },
  dashed: {
    alignSelf: 'flex-start',
    minHeight: space.cardGap + space.cardGap + space.compactGap,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.cardGap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticChip: {
    alignSelf: 'flex-start',
    minHeight: space.cardGap + space.cardGap + space.compactGap,
    borderRadius: radius.pill,
    paddingHorizontal: space.cardGap,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticQuiet: {
    opacity: 0.95,
  },
});
