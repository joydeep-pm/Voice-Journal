import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, SectionList, StyleSheet, View } from 'react-native';
import { listEntries } from '@/src/db/entries';
import { createStressCheckIn, getReminderPreferences, listRecentStressCheckIns } from '@/src/db/wellness';
import type { Entry, StressCheckIn } from '@/src/db/types';
import { AppHeader, Button, Card, Chip, EmptyState, IconButton, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { color, motion, space, spacing } from '@/src/ui/tokens';
import { useWorkspace } from '@/src/workspace/WorkspaceContext';
import { interventionLabel, shouldShowAdaptiveNudge } from '@/src/wellness/utils';

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
  const { activeWorkspace } = useWorkspace();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wellnessMessage, setWellnessMessage] = useState<string | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);
  const [latestCheckIn, setLatestCheckIn] = useState<StressCheckIn | null>(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const didAnimate = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listEntries();
      setEntries(rows);

      if (activeWorkspace === 'personal') {
        const [prefs, checkIns] = await Promise.all([getReminderPreferences(), listRecentStressCheckIns(1)]);
        const latest = checkIns[0] ?? null;
        setLatestCheckIn(latest);
        setNudgeMessage(
          shouldShowAdaptiveNudge({
            preferences: prefs,
            latestCheckIn: latest,
            latestEntryAt: rows[0]?.createdAt ?? null,
          })
        );
      } else {
        setLatestCheckIn(null);
        setNudgeMessage(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const weekCount = useMemo(() => getWeekCount(entries), [entries]);
  const sections = useMemo(() => groupEntries(entries), [entries]);

  const quickStressCheckIn = async (intensity: number) => {
    setWellnessMessage(null);
    try {
      const checkIn = await createStressCheckIn({
        stressIntensity: intensity,
      });
      setLatestCheckIn(checkIn);
      setWellnessMessage(
        `Saved check-in (${intensity}/10). Suggested tool: ${interventionLabel(checkIn.recommendedTool)}.`
      );
    } catch (checkInError) {
      setWellnessMessage(checkInError instanceof Error ? checkInError.message : 'Failed to save check-in.');
    }
  };

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

      {activeWorkspace === 'personal' ? (
        <Card quiet>
          <View style={styles.titleRow}>
            <View style={styles.sectionHeaderBar} />
            <Text variant="h2">Personal stress check-in</Text>
          </View>
          {nudgeMessage ? <InlineStatus tone="info" message={nudgeMessage} /> : null}
          {latestCheckIn ? (
            <Text variant="muted">
              Latest: {latestCheckIn.stressIntensity}/10, {interventionLabel(latestCheckIn.recommendedTool)}.
            </Text>
          ) : (
            <Text variant="muted">No stress check-ins yet this week.</Text>
          )}
          <View style={styles.quickCheckRow}>
            <Button label="Low (3)" compact variant="secondary" onPress={() => void quickStressCheckIn(3)} />
            <Button label="Medium (6)" compact variant="secondary" onPress={() => void quickStressCheckIn(6)} />
            <Button label="High (9)" compact onPress={() => void quickStressCheckIn(9)} />
          </View>
          {wellnessMessage ? <InlineStatus tone="info" message={wellnessMessage} /> : null}
        </Card>
      ) : null}

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
              const showStatus = item.aiStatus === 'summarized';
              const hasBadgeContent = showStatus || visibleTags.length > 0 || extra > 0;

              return (
                <Card style={styles.entryCard} onPress={() => router.push({ pathname: '/entry/[id]', params: { id: item.id } })}>
                  <View style={styles.titleRow}>
                    <Text variant="h1" numberOfLines={1} style={styles.titleText}>
                      {titleForEntry(item)}
                    </Text>
                    <Ionicons name={glyphForEntry(item)} size={spacing[20]} color={color.accent} />
                  </View>

                  {hasBadgeContent ? (
                    <View style={styles.badgeRow}>
                      {showStatus ? <InlineStatus quiet tone={toneForAiStatus(item.aiStatus)} message="SUMMARIZED" /> : null}
                      {visibleTags.map((tag, index) => (
                        <Chip
                          key={tag.id}
                          label={tag.name}
                          quiet
                          left={<Ionicons name={tagIcon(index)} size={spacing[12]} color={color.accentStrong} />}
                        />
                      ))}
                      {extra > 0 ? <Chip label={`+${extra}`} dashed /> : null}
                    </View>
                  ) : null}
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[8],
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
  sectionGap: {
    height: space.sectionGap,
  },
  itemGap: {
    height: space.controlGap,
  },
  quickCheckRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
});
