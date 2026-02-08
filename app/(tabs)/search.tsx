import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { formatClock } from '@/src/audio/recorder';
import { searchEntries } from '@/src/db/entries';
import type { Entry } from '@/src/db/types';
import { AppHeader, Button, Card, EmptyState, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { border, color, radius, space, spacing, typography } from '@/src/ui/tokens';

function titleForEntry(entry: Entry) {
  if (entry.summary?.trim()) {
    return entry.summary.trim().split('\n')[0] || 'Audio note';
  }
  return 'Audio note';
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setResults(await searchEntries(trimmed));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const showIdleHint = useMemo(() => !loading && !error && !query.trim().length, [loading, error, query]);
  const hasQuery = query.trim().length > 0;

  return (
    <Screen scroll={false} contentContainerStyle={styles.content}>
      <AppHeader title="Search" subtitle="Find transcript or summary text" titleVariant="h1" compact />

      <Card quiet>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={spacing[16]} color={color.textSecondary} />
            <TextInput
              placeholder="Search notes"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch()}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={color.textSecondary}
              returnKeyType="search"
            />
          </View>
          <Button label="Go" onPress={() => void runSearch()} compact />
        </View>
        <Text variant="caption" tone="secondary" compact>
          {hasQuery ? 'Searching transcript and summaries' : 'Try keywords like decisions, mood, project names'}
        </Text>
      </Card>

      {showIdleHint ? (
        <EmptyState
          title="Search your memory"
          description="Try words from transcript, summary, or topics you discussed."
          icon={<Ionicons name="search-outline" size={spacing[24]} color={color.textSecondary} />}
        />
      ) : null}

      {loading ? <LoadingState label="Searching" rows={3} /> : null}
      {error ? <InlineStatus tone="error" message={error} /> : null}

      {!loading && !error && query.trim().length > 0 && !results.length ? (
        <EmptyState title="No results" description="Try another keyword from your transcript or summary." />
      ) : null}

      {!loading && results.length ? (
        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/entry/[id]', params: { id: item.id } })}>
              <Text variant="h2" numberOfLines={1}>
                {titleForEntry(item)}
              </Text>
              <Text variant="muted" numberOfLines={2}>
                {item.transcript?.trim() ? item.transcript.trim().slice(0, 90) : 'No transcript yet'}
              </Text>
              <View style={styles.resultMeta}>
                <Text variant="caption" tone="secondary" compact>
                  {formatClock(item.durationSec)}
                </Text>
                <InlineStatus
                  quiet
                  message={item.aiStatus.toUpperCase()}
                  tone={item.aiStatus === 'error' ? 'error' : item.aiStatus === 'summarized' ? 'success' : 'info'}
                />
              </View>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    gap: space.controlGap,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: spacing[32] + spacing[12],
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: radius.control,
    backgroundColor: color.surfaceSubtle,
    paddingHorizontal: space.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  input: {
    flex: 1,
    color: color.text,
    fontSize: typography.sizes[16],
    paddingVertical: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing[32],
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  itemGap: {
    height: space.controlGap,
  },
});
