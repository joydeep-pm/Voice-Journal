import { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type ScreenShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  scroll?: boolean;
}>;

export function ScreenShell({ title, subtitle, scroll = true, children }: ScreenShellProps) {
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll ? { contentContainerStyle: styles.contentContainer } : { style: styles.contentContainer };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Body {...bodyProps}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.content}>{children}</View>
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f9',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101418',
  },
  subtitle: {
    marginTop: 4,
    color: '#5f6770',
    fontSize: 14,
  },
  content: {
    marginTop: 16,
    gap: 12,
  },
});
