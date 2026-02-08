import { PropsWithChildren } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space } from '@/src/ui/tokens';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
}>;

export function Screen({ scroll = true, style, contentContainerStyle, children, bottomInset = 0 }: ScreenProps) {
  const contentStyle = [styles.content, { paddingBottom: space.pageBottom + bottomInset }, contentContainerStyle];

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, style]} edges={['top']}>
        <View pointerEvents="none" style={styles.topGlow} />
        <View style={[...contentStyle, styles.contentFill]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top']}>
      <View pointerEvents="none" style={styles.topGlow} />
      <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: color.accentSoft,
    opacity: 0.3,
  },
  content: {
    paddingHorizontal: space.pageX,
    paddingTop: space.pageTop,
    paddingBottom: space.pageBottom,
    gap: space.sectionGap,
  },
  contentFill: {
    flex: 1,
  },
});
