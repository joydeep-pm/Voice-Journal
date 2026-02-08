import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildWeeklyThemes } from '@/src/ai/themes';
import { listEntriesWithSummary, listTopTags, listWeeklyCounts } from '@/src/db/entries';
import type { TopTag, WeeklyCount, WeeklyTheme } from '@/src/db/types';
import { AppHeader, Card, Chip, EmptyState, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { color, space, spacing } from '@/src/ui/tokens';

export default function InsightsScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyCounts, setWeeklyCounts] = useState<WeeklyCount[]>([]);
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [themes, setThemes] = useState<WeeklyTheme[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [counts, tags, summarizedEntries] = await Promise.all([
        listWeeklyCounts(),
        listTopTags(),
        listEntriesWithSummary(),
      ]);
      setWeeklyCounts(counts);
      setTopTags(tags);
      setThemes(buildWeeklyThemes(summarizedEntries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const featuredWeek = useMemo(() => weeklyCounts[0] ?? null, [weeklyCounts]);

  return (
    <Screen>
      <AppHeader title="Insights" subtitle="Weekly activity, tags, and themes" titleVariant="h1" compact />

      {loading ? <LoadingState label="Loading insights" rows={4} /> : null}
      {error ? <InlineStatus tone="error" message={error} /> : null}

      {featuredWeek ? (
        <Card quiet>
          <Text variant="caption" tone="secondary" compact>
            This week
          </Text>
          <View style={styles.featuredRow}>
            <Text variant="display">{featuredWeek.count}</Text>
            <Text variant="body" tone="secondary">
              entries logged
            </Text>
          </View>
          <Text variant="muted" compact>
            {featuredWeek.week}
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Entries per week</Text>
        </View>
        {weeklyCounts.length ? (
          weeklyCounts.map((item, index) => (
            <View key={item.week} style={[styles.row, index > 0 ? styles.rowBorder : null]}>
              <Text variant="body">{item.week}</Text>
              <Text variant="caption" tone="secondary">
                {item.count}
              </Text>
            </View>
          ))
        ) : (
          <Text variant="muted">No entries yet.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Top tags</Text>
        </View>
        {topTags.length ? (
          <View style={styles.chipWrap}>
            {topTags.slice(0, 8).map((item) => (
              <Chip key={item.tagId} quiet label={`#${item.tagName} (${item.count})`} />
            ))}
          </View>
        ) : (
          <Text variant="muted">No tags yet.</Text>
        )}
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Weekly themes</Text>
        </View>
        {themes.length ? (
          themes.map((item, index) => (
            <View key={item.week} style={[styles.themeWrap, index > 0 ? styles.rowBorder : null]}>
              <Text variant="caption" tone="secondary" compact>
                {item.week}
              </Text>
              <Text variant="body">{item.theme}</Text>
              <Text variant="muted" compact>
                {item.entryIds.length} linked entries
              </Text>
            </View>
          ))
        ) : (
          <EmptyState title="No themes yet" description="Add summarized entries to generate weekly themes." />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.controlGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  titleMarker: {
    width: spacing[4],
    height: spacing[16],
    borderRadius: spacing[4],
    backgroundColor: color.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.controlGap,
    paddingVertical: space.controlGap,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  themeWrap: {
    gap: space.compactGap,
    paddingVertical: space.controlGap,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
});
