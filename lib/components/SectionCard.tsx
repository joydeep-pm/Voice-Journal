import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SectionCardProps = PropsWithChildren<{
  title?: string;
}>;

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e7ec',
    padding: 14,
    gap: 10,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    color: '#131a23',
  },
});
