import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tag } from '@/lib/types';

type TagChipProps = {
  tag: Tag;
  removable?: boolean;
  onRemove?: () => void;
  onPress?: () => void;
};

export function TagChip({ tag, removable = false, onRemove, onPress }: TagChipProps) {
  const content = (
    <View style={styles.chip}>
      <Text style={styles.text}>#{tag.name}</Text>
      {removable ? <Text style={styles.remove}>×</Text> : null}
    </View>
  );

  if (!onPress && !onRemove) {
    return content;
  }

  return (
    <Pressable onPress={onPress ?? onRemove}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f4ff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccd8ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    color: '#1f3b8f',
    fontSize: 12,
    fontWeight: '500',
  },
  remove: {
    color: '#3e4f81',
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
});
