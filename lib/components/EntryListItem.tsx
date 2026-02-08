import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTime, pickEntryTitle } from '@/lib/format';
import type { Entry } from '@/lib/types';

type EntryListItemProps = {
  entry: Entry;
  onPress: () => void;
};

export function EntryListItem({ entry, onPress }: EntryListItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.title}>{pickEntryTitle(entry.summary, entry.title)}</Text>
      <Text style={styles.meta}>{formatDateTime(entry.createdAt)}</Text>
      <View style={styles.tagRow}>
        {entry.tags.length ? (
          entry.tags.map((tag) => (
            <View style={styles.tag} key={`${entry.id}-${tag.id}`}>
              <Text style={styles.tagText}>#{tag.name}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noTags}>No tags</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e7ec',
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101418',
  },
  meta: {
    fontSize: 12,
    color: '#5f6770',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#eef3ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: '#1f3b8f',
    fontSize: 12,
  },
  noTags: {
    color: '#7c8590',
    fontSize: 12,
  },
});
