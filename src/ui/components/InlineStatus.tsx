import { StyleSheet, View } from 'react-native';
import { Text } from '@/src/ui/components/Text';
import { color, radius, space } from '@/src/ui/tokens';

type InlineStatusTone = 'info' | 'success' | 'error';

type InlineStatusProps = {
  tone?: InlineStatusTone;
  message: string;
  quiet?: boolean;
};

const toneMap: Record<InlineStatusTone, { bg: string; fg: string }> = {
  info: { bg: color.accentSoft, fg: color.accentStrong },
  success: { bg: color.successSoft, fg: color.success },
  error: { bg: color.dangerSoft, fg: color.danger },
};

export function InlineStatus({ tone = 'info', message, quiet = true }: InlineStatusProps) {
  const color = toneMap[tone];

  return (
    <View style={[styles.base, quiet ? styles.quiet : null, { backgroundColor: color.bg }]}>
      <Text variant="caption" compact style={{ color: color.fg }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: space.cardGap,
    paddingVertical: space.controlGap,
    alignSelf: 'flex-start',
  },
  quiet: {
    paddingVertical: space.compactGap,
  },
});
