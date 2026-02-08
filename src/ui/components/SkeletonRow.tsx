import { Animated, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { colors, radii, spacing } from '@/src/ui/tokens';

type SkeletonRowProps = {
  width?: `${number}%` | number;
};

export function SkeletonRow({ width = '100%' }: SkeletonRowProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, { width, opacity }]}>
      <View style={styles.fill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: spacing[20],
    borderRadius: radii[10],
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    backgroundColor: colors.border,
  },
});
