import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from '@/src/ui/components/Text';
import { colors, radii, spacing } from '@/src/ui/tokens';

type ToastTone = 'info' | 'success' | 'error';

type ToastProps = {
  visible: boolean;
  message: string | null;
  tone?: ToastTone;
};

const toneMap: Record<ToastTone, { bg: string; fg: string }> = {
  info: { bg: '#EEF2FF', fg: colors.accent },
  success: { bg: '#DCFCE7', fg: colors.success },
  error: { bg: '#FEE2E2', fg: colors.danger },
};

export function Toast({ visible, message, tone = 'info' }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible && message ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, message, opacity]);

  if (!message) {
    return null;
  }

  const color = toneMap[tone];

  return (
    <Animated.View style={[styles.wrap, { opacity }]}> 
      <View style={[styles.toast, { backgroundColor: color.bg }]}>
        <Text variant="caption" style={{ color: color.fg }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing[16],
    right: spacing[16],
    bottom: spacing[24],
  },
  toast: {
    borderRadius: radii[14],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
