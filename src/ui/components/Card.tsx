import { ReactNode } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { color, elevation, motion, radius, space, touchTarget } from '@/src/ui/tokens';
import { usePressScale } from '@/src/ui/components/usePressScale';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  quiet?: boolean;
};

export function Card({ children, style, onPress, disabled = false, compact = false, quiet = false }: CardProps) {
  const press = usePressScale(motion.easeScaleCard);
  const variantStyle = [
    compact ? styles.compact : null,
    quiet ? styles.quiet : null,
  ];

  if (!onPress) {
    return <View style={[styles.base, ...variantStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.base, ...variantStyle, press.animatedStyle, disabled ? styles.disabled : null, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: touchTarget.min,
  },
  base: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.pageX,
    gap: space.cardGap,
    shadowColor: color.accent,
    shadowOpacity: elevation.shadowOpacity,
    shadowRadius: elevation.shadowRadius,
    shadowOffset: {
      width: elevation.shadowOffsetX,
      height: elevation.shadowOffsetY,
    },
    elevation: elevation.android,
  },
  disabled: {
    opacity: 0.6,
  },
  compact: {
    padding: space.cardGap,
    gap: space.controlGap,
    borderRadius: radius.card,
  },
  quiet: {
    backgroundColor: '#FFFCF8',
    shadowOpacity: 0.05,
    elevation: 1,
  },
});
