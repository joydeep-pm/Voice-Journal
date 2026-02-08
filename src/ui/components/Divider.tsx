import { StyleSheet, View } from 'react-native';
import { border, colors } from '@/src/ui/tokens';

export function Divider() {
  return <View style={styles.line} />;
}

const styles = StyleSheet.create({
  line: {
    height: border.width,
    backgroundColor: colors.border,
    width: '100%',
  },
});
