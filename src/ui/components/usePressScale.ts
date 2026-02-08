import { useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '@/src/ui/tokens';

export function usePressScale(scale: number = motion.easeScaleButton, duration: number = motion.pressDuration) {
  const value = useRef(new Animated.Value(1)).current;

  const toPressed = () => {
    Animated.timing(value, {
      toValue: scale,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const toDefault = () => {
    Animated.spring(value, {
      toValue: 1,
      speed: 28,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  return {
    animatedStyle: { transform: [{ scale: value }] },
    onPressIn: toPressed,
    onPressOut: toDefault,
  };
}
