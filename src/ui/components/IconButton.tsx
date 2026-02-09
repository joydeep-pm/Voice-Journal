import { ReactNode } from 'react';
import { Animated, Insets, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { usePressScale } from '@/src/ui/components/usePressScale';
import { border, color, motion, radius, touchTarget } from '@/src/ui/tokens';

type IconButtonProps = {
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: Insets;
  quiet?: boolean;
};

const DEFAULT_HIT_SLOP: Insets = {
  top: touchTarget.min / 4,
  right: touchTarget.min / 4,
  bottom: touchTarget.min / 4,
  left: touchTarget.min / 4,
};

export function IconButton({ icon, onPress, disabled = false, style, hitSlop = DEFAULT_HIT_SLOP, quiet = false }: IconButtonProps) {
  const press = usePressScale(motion.easeScaleCard);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={hitSlop}
    >
      <Animated.View style={[styles.base, quiet ? styles.quiet : null, press.animatedStyle, disabled ? styles.disabled : null, style]}>
        {icon}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  quiet: {
    backgroundColor: color.surfaceSubtle,
  },
});
