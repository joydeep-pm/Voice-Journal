import { StyleSheet, View } from 'react-native';
import { SkeletonRow } from '@/src/ui/components/SkeletonRow';
import { Text } from '@/src/ui/components/Text';
import { spacing } from '@/src/ui/tokens';

type LoadingStateProps = {
  label?: string;
  rows?: number;
};

export function LoadingState({ label = 'Loading...', rows = 3 }: LoadingStateProps) {
  return (
    <View style={styles.base}>
      <Text variant="muted">{label}</Text>
      <View style={styles.rows}>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={`skeleton-${index}`} width={index === rows - 1 ? '70%' : '100%'} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing[12],
  },
  rows: {
    gap: spacing[8],
  },
});
