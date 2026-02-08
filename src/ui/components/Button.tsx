import { ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from '@/src/ui/components/Text';
import { usePressScale } from '@/src/ui/components/usePressScale';
import { border, color, elevation, motion, radius, space, touchTarget } from '@/src/ui/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  quiet?: boolean;
};

const stylesByVariant: Record<ButtonVariant, { bg: string; borderColor: string; text: string; raised?: boolean }> = {
  primary: { bg: color.accent, borderColor: color.accent, text: color.surface, raised: true },
  secondary: { bg: color.accentSoft, borderColor: color.accentSoft, text: color.accentStrong },
  ghost: { bg: 'transparent', borderColor: 'transparent', text: color.textSecondary },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  left,
  style,
  compact = false,
  quiet = false,
}: ButtonProps) {
  const press = usePressScale(motion.easeScaleButton);
  const tone = stylesByVariant[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.wrap, style]}
    >
      <Animated.View
        style={[
          styles.base,
          press.animatedStyle,
          {
            backgroundColor: tone.bg,
            borderColor: tone.borderColor,
          },
          tone.raised ? styles.raised : null,
          compact ? styles.compact : null,
          quiet ? styles.quiet : null,
          inactive ? styles.inactive : null,
        ]}
      >
        {loading ? <ActivityIndicator color={tone.text} size="small" /> : null}
        {!loading && left ? <View style={styles.left}>{left}</View> : null}
        {label ? (
          <Text variant={compact ? 'caption' : 'body'} style={[styles.label, { color: tone.text }]}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: touchTarget.min,
  },
  base: {
    minHeight: touchTarget.min,
    borderRadius: radius.xxl,
    borderWidth: border.width,
    paddingHorizontal: space.pageX,
    paddingVertical: space.controlGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.controlGap,
  },
  inactive: {
    opacity: 0.55,
  },
  raised: {
    shadowColor: color.accentStrong,
    shadowOpacity: elevation.actionOpacity,
    shadowRadius: elevation.shadowRadius + 2,
    shadowOffset: {
      width: elevation.shadowOffsetX,
      height: elevation.shadowOffsetY,
    },
    elevation: elevation.android + 1,
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
  compact: {
    minHeight: touchTarget.min,
    borderRadius: radius.control,
    paddingHorizontal: space.cardGap,
    paddingVertical: space.compactGap,
  },
  quiet: {
    opacity: 0.95,
  },
});
