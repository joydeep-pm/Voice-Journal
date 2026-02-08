import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, SectionList, StyleSheet, View } from 'react-native';
import { formatClock } from '@/src/audio/recorder';
import { listEntries } from '@/src/db/entries';
import type { Entry } from '@/src/db/types';
import { AppHeader, Button, Card, Chip, EmptyState, IconButton, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { color, motion, space, spacing } from '@/src/ui/tokens';

type EntrySection = {
  title: string;
  data: Entry[];
};

function titleForEntry(entry: Entry): string {
  if (entry.summary?.trim()) {
    return entry.summary.trim().split('\n')[0] || 'Audio note';
  }
  return 'Audio note';
}

function snippetForEntry(entry: Entry): string {
  const transcript = entry.transcript?.trim();
  if (!transcript) {
    return 'No transcript yet';
  }

  return transcript.length > 80 ? `${transcript.slice(0, 80)}...` : transcript;
}

function getLocalDayKey(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayStart(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function sectionTitleFromKey(key: string): string {
  const now = new Date();
  const nowStart = dayStart(now.getTime());
  const yesterdayStart = nowStart - 24 * 60 * 60 * 1000;
  const sectionDate = new Date(`${key}T00:00:00`);
  const sectionStart = dayStart(sectionDate.getTime());

  if (sectionStart === nowStart) {
    return 'Today';
  }
  if (sectionStart === yesterdayStart) {
    return 'Yesterday';
  }

  return sectionDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupEntries(entries: Entry[]): EntrySection[] {
  const map = new Map<string, Entry[]>();

  for (const entry of entries) {
    const key = getLocalDayKey(entry.createdAt);
    const bucket = map.get(key) ?? [];
    bucket.push(entry);
    map.set(key, bucket);
  }

  return [...map.entries()].map(([key, items]) => ({
    title: sectionTitleFromKey(key),
    data: items,
  }));
}

function getWeekCount(entries: Entry[]): number {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  const weekStart = start.getTime();

  return entries.filter((entry) => entry.createdAt >= weekStart).length;
}

function toneForAiStatus(status: Entry['aiStatus']): 'info' | 'success' | 'error' {
  if (status === 'error') {
    return 'error';
  }
  if (status === 'summarized') {
    return 'success';
  }
  return 'info';
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function glyphForEntry(entry: Entry): keyof typeof Ionicons.glyphMap {
  if (entry.aiStatus === 'summarized') {
    return 'sparkles';
  }
  if (entry.aiStatus === 'error') {
    return 'alert-circle';
  }
  return 'bulb-outline';
}

function tagIcon(index: number): keyof typeof Ionicons.glyphMap {
  const icons: Array<keyof typeof Ionicons.glyphMap> = ['flask-outline', 'chatbubble-outline', 'rocket-outline', 'planet-outline'];
  return icons[index % icons.length];
}

export default function HomeScreen() {
  const router = useRouter();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const didAnimate = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listEntries();
      setEntries(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const weekCount = useMemo(() => getWeekCount(entries), [entries]);
  const sections = useMemo(() => groupEntries(entries), [entries]);

  if (!didAnimate.current && !loading) {
    didAnimate.current = true;
    Animated.timing(entrance, {
      toValue: 1,
      duration: motion.listEnterDuration,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.screenContent}>
      <AppHeader
        title="Journal"
        subtitle={`${weekCount} entries this week`}
        rightAction={
          <IconButton
            onPress={() => void refresh()}
            quiet
            icon={<Ionicons name="sparkles" size={spacing[20]} color={color.accent} />}
          />
        }
      />

      <Button
        label="New recording"
        onPress={() => router.push('/(tabs)/record')}
        left={<Ionicons name="pulse" size={spacing[20]} color={color.surface} />}
      />

      {loading && !entries.length ? <LoadingState label="Loading entries" rows={4} /> : null}

      {!loading && error ? (
        <View style={styles.stack}>
          <InlineStatus tone="error" message={error} />
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
        </View>
      ) : null}

      {!loading && !error && !entries.length ? (
        <EmptyState
          title="No entries yet"
          description="Capture your first note and start your memory stream."
          actionLabel="Start recording"
          onAction={() => router.push('/(tabs)/record')}
          icon={<Ionicons name="mic-outline" size={spacing[24]} color={color.textSecondary} />}
        />
      ) : null}

      {!error && entries.length ? (
        <Animated.View
          style={[
            styles.listWrap,
            {
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [spacing[12], 0],
                  }),
                },
              ],
            },
          ]}
        >
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeaderWrap}>
                <View style={styles.sectionHeaderBar} />
                <Text variant="h1" style={styles.sectionHeader}>
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const visibleTags = item.tags.slice(0, 2);
              const extra = item.tags.length - visibleTags.length;

              return (
                <Card style={styles.entryCard} onPress={() => router.push({ pathname: '/entry/[id]', params: { id: item.id } })}>
                  <View style={styles.titleRow}>
                    <Text variant="h1" numberOfLines={1} style={styles.titleText}>
                      {titleForEntry(item)}
                    </Text>
                    <Ionicons name={glyphForEntry(item)} size={spacing[20]} color={color.accent} />
                  </View>

                  <Text variant="muted" numberOfLines={2}>
                    {snippetForEntry(item)}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text variant="caption" tone="secondary" compact>
                      {formatTime(item.createdAt)}
                    </Text>
                    <Text variant="caption" tone="secondary" compact>
                      {formatClock(item.durationSec)}
                    </Text>
                    <InlineStatus quiet tone={toneForAiStatus(item.aiStatus)} message={item.aiStatus.toUpperCase()} />
                  </View>

                  <View style={styles.tagRow}>
                    {visibleTags.length ? (
                      visibleTags.map((tag, index) => (
                        <Chip
                          key={tag.id}
                          label={tag.name}
                          quiet
                          left={<Ionicons name={tagIcon(index)} size={spacing[12]} color={color.accentStrong} />}
                        />
                      ))
                    ) : (
                      <Text variant="muted" compact>
                        No tags
                      </Text>
                    )}
                    {extra > 0 ? <Chip label={`+${extra}`} dashed /> : null}
                  </View>
                </Card>
              );
            }}
            SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
            ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: space.sectionGap,
  },
  stack: {
    gap: space.cardGap,
  },
  entryCard: {
    paddingVertical: spacing[20],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  titleText: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: space.compactGap,
    paddingBottom: spacing[32],
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    paddingTop: space.compactGap,
  },
  sectionHeaderBar: {
    width: spacing[8],
    height: spacing[32] - spacing[8],
    borderRadius: spacing[4],
    backgroundColor: color.accent,
  },
  sectionHeader: {
    marginBottom: space.controlGap,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    flexWrap: 'wrap',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    flexWrap: 'wrap',
  },
  sectionGap: {
    height: space.sectionGap,
  },
  itemGap: {
    height: space.controlGap,
  },
});
