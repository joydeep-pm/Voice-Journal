import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildWeeklyThemes } from '@/src/ai/themes';
import { listEntriesWithSummary, listTopTags, listWeeklyCounts } from '@/src/db/entries';
import { listGad2Assessments, saveGad2Assessment } from '@/src/db/wellness';
import type { Gad2Assessment, TopTag, WeeklyCount, WeeklyTheme } from '@/src/db/types';
import { AppHeader, Button, Card, Chip, EmptyState, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { color, space, spacing } from '@/src/ui/tokens';
import { useWorkspace } from '@/src/workspace/WorkspaceContext';
import { gad2Severity } from '@/src/wellness/utils';

export default function InsightsScreen() {
  const { activeWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weeklyCounts, setWeeklyCounts] = useState<WeeklyCount[]>([]);
  const [topTags, setTopTags] = useState<TopTag[]>([]);
  const [themes, setThemes] = useState<WeeklyTheme[]>([]);
  const [gad2, setGad2] = useState<Gad2Assessment[]>([]);
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [gad2Saving, setGad2Saving] = useState(false);
  const [gad2Message, setGad2Message] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [counts, tags, summarizedEntries, gad2Rows] = await Promise.all([
        listWeeklyCounts(),
        listTopTags(),
        listEntriesWithSummary(),
        activeWorkspace === 'personal' ? listGad2Assessments(8) : Promise.resolve([]),
      ]);
      setWeeklyCounts(counts);
      setTopTags(tags);
      setThemes(buildWeeklyThemes(summarizedEntries));
      setGad2(gad2Rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load insights.');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const featuredWeek = useMemo(() => weeklyCounts[0] ?? null, [weeklyCounts]);
  const latestGad2 = useMemo(() => gad2[0] ?? null, [gad2]);

  const saveWeeklyGad2 = async () => {
    setGad2Saving(true);
    setGad2Message(null);
    try {
      const saved = await saveGad2Assessment({
        nervousScore: q1,
        controlScore: q2,
      });
      setGad2((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)].slice(0, 8));
      setGad2Message(`Weekly GAD-2 saved (${saved.totalScore}/6, ${gad2Severity(saved.totalScore)}).`);
    } catch (saveError) {
      setGad2Message(saveError instanceof Error ? saveError.message : 'Failed to save GAD-2.');
    } finally {
      setGad2Saving(false);
    }
  };

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

      {activeWorkspace === 'personal' ? (
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleMarker} />
            <Text variant="h2">Weekly GAD-2 check-in</Text>
          </View>
          {latestGad2 ? (
            <Text variant="muted">
              Latest score: {latestGad2.totalScore}/6 ({gad2Severity(latestGad2.totalScore)})
            </Text>
          ) : (
            <Text variant="muted">No GAD-2 submitted yet.</Text>
          )}
          <Text variant="caption" tone="secondary">
            Feeling nervous, anxious, or on edge?
          </Text>
          <View style={styles.choiceRow}>
            {[0, 1, 2, 3].map((value) => (
              <Chip
                key={`q1-${value}`}
                label={`${value}`}
                quiet={q1 === value}
                onPress={() => setQ1(value)}
              />
            ))}
          </View>
          <Text variant="caption" tone="secondary">
            Not able to stop or control worrying?
          </Text>
          <View style={styles.choiceRow}>
            {[0, 1, 2, 3].map((value) => (
              <Chip
                key={`q2-${value}`}
                label={`${value}`}
                quiet={q2 === value}
                onPress={() => setQ2(value)}
              />
            ))}
          </View>
          <Button
            label={gad2Saving ? 'Saving...' : 'Save weekly GAD-2'}
            onPress={() => void saveWeeklyGad2()}
            disabled={gad2Saving}
          />
          {gad2Message ? <InlineStatus tone="info" message={gad2Message} /> : null}
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
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
});
