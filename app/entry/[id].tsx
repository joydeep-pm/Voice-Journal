import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { formatClock } from '@/src/audio/recorder';
import { useAudioPlayer } from '@/src/audio/player';
import { generateTagsForEntry, runAiWorker } from '@/src/ai/worker';
import { attachTag, createTag, detachTag, getEntry, listTags, updateEntry } from '@/src/db/entries';
import { enqueueAiJob } from '@/src/db/jobs';
import type { Entry, Tag } from '@/src/db/types';
import { Button, Card, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { border, color, radius, space, spacing, typography } from '@/src/ui/tokens';

function fileNameFromUri(uri: string) {
  const segments = uri.split('/');
  return segments[segments.length - 1] || uri;
}

function parseSummary(summary?: string | null): { title: string | null; bullets: string[] } {
  const text = summary?.trim() ?? '';
  if (!text) {
    return { title: null, bullets: [] };
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = lines[0] || null;
  const bullets = lines
    .slice(1)
    .map((line) => line.replace(/^-+\s*/, '').trim())
    .filter(Boolean);

  return { title, bullets };
}

const MOOD_OPTIONS = ['great', 'good', 'neutral', 'stressed', 'low'] as const;
type MoodValue = (typeof MOOD_OPTIONS)[number];

function detectMoodFromText(input: string): MoodValue {
  const text = input.toLowerCase();
  const positive = ['great', 'happy', 'excited', 'good', 'love', 'confident', 'grateful', 'calm'];
  const negative = ['sad', 'low', 'down', 'upset', 'angry', 'frustrated', 'tired', 'hopeless'];
  const stressed = ['stress', 'stressed', 'anxious', 'anxiety', 'overwhelmed', 'worried', 'pressure', 'burnout'];

  let score = 0;
  for (const word of positive) {
    if (text.includes(word)) score += 1;
  }
  for (const word of negative) {
    if (text.includes(word)) score -= 1;
  }

  const stressHits = stressed.reduce((count, word) => (text.includes(word) ? count + 1 : count), 0);
  if (stressHits >= 2) {
    return 'stressed';
  }
  if (score >= 2) {
    return 'great';
  }
  if (score === 1) {
    return 'good';
  }
  if (score <= -2) {
    return 'low';
  }
  return 'neutral';
}

export default function EntryDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const entryId = typeof params.id === 'string' ? params.id : '';

  const [entry, setEntry] = useState<Entry | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seekDraftSec, setSeekDraftSec] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [busyTag, setBusyTag] = useState(false);
  const [busyAi, setBusyAi] = useState(false);
  const [busyAiTags, setBusyAiTags] = useState(false);
  const [busyMood, setBusyMood] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entryId) {
      setError('Invalid entry id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [row, tags] = await Promise.all([getEntry(entryId), listTags()]);
      if (!row) {
        setError('Entry not found.');
      }
      setEntry(row);
      setAllTags(tags);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load entry.');
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!entry || entry.aiStatus !== 'queued') {
      return;
    }

    void runAiWorker();
    const timer = setInterval(() => {
      void load();
    }, 2500);

    return () => clearInterval(timer);
  }, [entry, load]);

  const player = useAudioPlayer(entry?.audioUri);
  const maxDurationSec = Math.max(1, player.durationSec || entry?.durationSec || 1);
  const sliderValue = Math.min(seekDraftSec ?? player.positionSec, maxDurationSec);
  const remainingSec = Math.max(0, maxDurationSec - sliderValue);

  const jumpBy = (deltaSec: number) => {
    const base = seekDraftSec ?? player.positionSec;
    const target = Math.min(maxDurationSec, Math.max(0, base + deltaSec));
    setSeekDraftSec(null);
    void player.seekTo(target);
  };

  const attachableTags = useMemo(() => {
    if (!entry) {
      return [];
    }
    return allTags.filter((tag) => !entry.tags.some((t) => t.id === tag.id));
  }, [allTags, entry]);

  const canGenerateAiTags = Boolean(entry?.transcript?.trim() || entry?.summary?.trim());
  const summaryParts = useMemo(() => parseSummary(entry?.summary), [entry?.summary]);
  const transcriptText = entry?.transcript?.trim() ?? '';
  const moodValue = (entry?.mood ?? null) as MoodValue | null;

  const addTagByName = async () => {
    if (!entry || !newTagName.trim()) {
      return;
    }

    setBusyTag(true);
    setInfoMessage(null);

    try {
      const tag = await createTag(newTagName.trim());
      await attachTag(entry.id, tag.id);
      setNewTagName('');
      await load();
    } catch (tagError) {
      setInfoMessage(tagError instanceof Error ? tagError.message : 'Failed to add tag.');
    } finally {
      setBusyTag(false);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!entry) {
      return;
    }

    setBusyTag(true);
    setInfoMessage(null);

    try {
      await detachTag(entry.id, tagId);
      await load();
    } catch (tagError) {
      setInfoMessage(tagError instanceof Error ? tagError.message : 'Failed to remove tag.');
    } finally {
      setBusyTag(false);
    }
  };

  const addExistingTag = async (tagId: string) => {
    if (!entry) {
      return;
    }

    setBusyTag(true);
    setInfoMessage(null);

    try {
      await attachTag(entry.id, tagId);
      await load();
    } catch (tagError) {
      setInfoMessage(tagError instanceof Error ? tagError.message : 'Failed to attach tag.');
    } finally {
      setBusyTag(false);
    }
  };

  const processWithAi = async () => {
    if (!entry) {
      return;
    }

    setBusyAi(true);
    setInfoMessage(null);

    try {
      const queued = await enqueueAiJob(entry.id, 'transcribe');
      if (queued.enqueued) {
        setInfoMessage('Queued transcription + summary generation.');
      } else {
        setInfoMessage('Already queued/running; continuing processing.');
      }
      await runAiWorker();
      await load();
    } catch (aiError) {
      setInfoMessage(aiError instanceof Error ? aiError.message : 'Failed to queue AI processing.');
    } finally {
      setBusyAi(false);
    }
  };

  const generateAiTags = async () => {
    if (!entry) {
      return;
    }

    setBusyAiTags(true);
    setInfoMessage(null);

    try {
      const result = await generateTagsForEntry(entry.id);
      if (!result.suggested) {
        setInfoMessage('AI returned no tag suggestions for this entry.');
      } else {
        setInfoMessage(`AI suggested ${result.suggested} tag(s); attached ${result.attached}.`);
      }
      await load();
    } catch (tagError) {
      setInfoMessage(tagError instanceof Error ? tagError.message : 'Failed to generate tags with AI.');
    } finally {
      setBusyAiTags(false);
    }
  };

  const shareTranscript = async () => {
    if (!transcriptText) {
      return;
    }

    try {
      await Share.share({ message: transcriptText });
    } catch (shareError) {
      setInfoMessage(shareError instanceof Error ? shareError.message : 'Failed to share transcript.');
    }
  };

  const setMood = async (mood: MoodValue | null) => {
    if (!entry) {
      return;
    }

    setBusyMood(true);
    setInfoMessage(null);
    try {
      await updateEntry(entry.id, { mood });
      setEntry((prev) => (prev ? { ...prev, mood } : prev));
    } catch (moodError) {
      setInfoMessage(moodError instanceof Error ? moodError.message : 'Failed to update mood.');
    } finally {
      setBusyMood(false);
    }
  };

  const autoDetectMood = async () => {
    const text = `${entry?.transcript ?? ''}\n${entry?.summary ?? ''}`.trim();
    if (!text) {
      setInfoMessage('Add transcript or summary first to auto-detect mood.');
      return;
    }

    const detected = detectMoodFromText(text);
    await setMood(detected);
    setInfoMessage(`Mood set to ${detected}.`);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading entry" rows={4} />
      </Screen>
    );
  }

  if (error || !entry) {
    return (
      <Screen>
        <InlineStatus tone="error" message={error ?? 'Entry unavailable.'} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card quiet style={styles.sectionCard}>
        <View style={styles.audioPathWrap}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.audioPathText}>
            /audio/{fileNameFromUri(entry.audioUri)}
          </Text>
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={() => void player.togglePlayPause()}
            disabled={!player.isLoaded}
            style={({ pressed }) => [
              styles.primaryAction,
              !player.isLoaded ? styles.disabledAction : null,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={spacing[16]} color={color.surface} />
            <Text variant="body" style={styles.primaryActionText}>
              {player.isPlaying ? 'Pause' : 'Play'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void player.seekTo(0)}
            disabled={!player.isLoaded}
            style={({ pressed }) => [
              styles.secondaryAction,
              !player.isLoaded ? styles.disabledAction : null,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Ionicons name="refresh" size={spacing[16]} color={color.accent} />
            <Text variant="body" tone="accent">
              Restart
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            onPress={() => jumpBy(-10)}
            disabled={!player.isLoaded}
            style={({ pressed }) => [
              styles.secondaryAction,
              styles.smallAction,
              !player.isLoaded ? styles.disabledAction : null,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Text variant="body" tone="accent">
              -10s
            </Text>
          </Pressable>
          <Pressable
            onPress={() => jumpBy(10)}
            disabled={!player.isLoaded}
            style={({ pressed }) => [
              styles.secondaryAction,
              styles.smallAction,
              !player.isLoaded ? styles.disabledAction : null,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Text variant="body" tone="accent">
              +10s
            </Text>
          </Pressable>
        </View>

        <Slider
          minimumValue={0}
          maximumValue={maxDurationSec}
          value={sliderValue}
          onValueChange={(value) => setSeekDraftSec(value)}
          onSlidingComplete={(value) => {
            setSeekDraftSec(null);
            void player.seekTo(value);
          }}
          minimumTrackTintColor={color.accent}
          maximumTrackTintColor={color.border}
          thumbTintColor={color.accent}
          disabled={!player.isLoaded}
          style={styles.slider}
        />

        <View style={styles.metaRow}>
          <Text variant="body" compact>
            {formatClock(sliderValue)} / {formatClock(maxDurationSec)}
          </Text>
          <Text variant="caption" tone="secondary" compact>
            Remaining: -{formatClock(remainingSec)}
          </Text>
        </View>
        {player.error ? <InlineStatus tone="error" message={player.error} /> : null}
      </Card>

      <Card quiet style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="h2">Summary</Text>
          <InlineStatus
            message={entry.aiStatus === 'summarized' ? 'SUMMARIZED' : entry.aiStatus.toUpperCase()}
            tone={entry.aiStatus === 'error' ? 'error' : entry.aiStatus === 'summarized' ? 'success' : 'info'}
            quiet
          />
        </View>

        {summaryParts.title ? (
          <View style={styles.summaryWrap}>
            <Text variant="h2">{summaryParts.title}</Text>
            {summaryParts.bullets.length ? (
              summaryParts.bullets.map((bullet, index) => (
                <View key={`${index}-${bullet}`} style={styles.bulletRow}>
                  <View style={styles.bulletBar} />
                  <Text variant="body" tone="secondary" style={styles.bulletText}>
                    - {bullet}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="muted">No bullet points yet.</Text>
            )}
          </View>
        ) : (
          <Text variant="muted">No summary yet.</Text>
        )}

        {entry.aiStatus !== 'summarized' || Boolean(entry.errorMsg) ? (
          <Button
            label={busyAi ? 'Processing...' : 'Process with AI'}
            onPress={() => void processWithAi()}
            disabled={busyAi || entry.aiStatus === 'queued'}
            variant="secondary"
          />
        ) : null}
        {entry.errorMsg ? <InlineStatus tone="error" message={entry.errorMsg} /> : null}
      </Card>

      <Card quiet compact style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="h2">Mood</Text>
          {moodValue ? <InlineStatus quiet message={moodValue.toUpperCase()} tone="info" /> : null}
        </View>

        <View style={styles.wrapRow}>
          {MOOD_OPTIONS.map((mood) => {
            const selected = moodValue === mood;
            return (
              <Pressable
                key={mood}
                onPress={() => void setMood(selected ? null : mood)}
                disabled={busyMood}
                style={({ pressed }) => [
                  styles.moodChip,
                  selected ? styles.moodChipSelected : null,
                  pressed ? styles.pressedAction : null,
                  busyMood ? styles.disabledAction : null,
                ]}
              >
                <Text variant="caption" tone={selected ? 'accent' : 'secondary'} compact>
                  {mood}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          label={busyMood ? 'Updating...' : 'Auto-detect mood'}
          variant="secondary"
          compact
          onPress={() => void autoDetectMood()}
          disabled={busyMood}
        />
      </Card>

      <Card quiet style={styles.sectionCard}>
        <Text variant="h2">Tags</Text>

        <Button
          label={busyAiTags ? 'Generating...' : 'Generate tags with AI'}
          variant="secondary"
          compact
          onPress={() => void generateAiTags()}
          disabled={busyAiTags || busyTag || !canGenerateAiTags}
        />

        {!canGenerateAiTags ? <Text variant="muted">Generate transcript/summary first.</Text> : null}

        <View style={styles.wrapRow}>
          {entry.tags.length ? (
            entry.tags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => void removeTag(tag.id)}
                disabled={busyTag}
                style={({ pressed }) => [
                  styles.removableChip,
                  pressed ? styles.pressedAction : null,
                ]}
              >
                <Text variant="body" compact>
                  #{tag.name}
                </Text>
                <Ionicons name="close" size={spacing[12]} color={color.textSecondary} />
              </Pressable>
            ))
          ) : (
            <Text variant="muted">No tags yet.</Text>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add tag"
            value={newTagName}
            onChangeText={setNewTagName}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={color.textSecondary}
          />
          <Button
            label="Add"
            compact
            onPress={() => void addTagByName()}
            disabled={busyTag || !newTagName.trim()}
            style={styles.addButton}
          />
        </View>

        {attachableTags.length ? (
          <View style={styles.attachWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachRow}>
              {attachableTags.map((tag) => (
                <Pressable
                  key={`available-${tag.id}`}
                  onPress={() => void addExistingTag(tag.id)}
                  disabled={busyTag}
                  style={({ pressed }) => [
                    styles.availableChip,
                    pressed ? styles.pressedAction : null,
                  ]}
                >
                  <Ionicons name="add" size={spacing[12]} color={color.textSecondary} />
                  <Text variant="caption" tone="secondary" compact>
                    #{tag.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Card>

      <Card quiet style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text variant="h2">Transcript</Text>
          <Pressable
            onPress={() => void shareTranscript()}
            disabled={!transcriptText}
            style={({ pressed }) => [
              styles.copyButton,
              !transcriptText ? styles.disabledAction : null,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Ionicons name="copy-outline" size={spacing[16]} color={color.accent} />
          </Pressable>
        </View>
        <Text variant="body" style={styles.longText}>
          {transcriptText || 'No transcript yet.'}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.transcriptMeta}>
          Transcribed automatically.
        </Text>
      </Card>

      {infoMessage ? <InlineStatus message={infoMessage} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    gap: spacing[8],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  audioPathWrap: {
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: spacing[8],
    backgroundColor: color.surfaceSubtle,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  audioPathText: {
    fontFamily: 'monospace',
  },
  row: {
    flexDirection: 'row',
    gap: spacing[8],
    alignItems: 'center',
  },
  primaryAction: {
    flex: 1,
    minHeight: spacing[32] + spacing[12],
    borderRadius: radius.control,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[8],
  },
  primaryActionText: {
    color: color.surface,
  },
  secondaryAction: {
    flex: 1,
    minHeight: spacing[32] + spacing[12],
    borderRadius: radius.control,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[8],
  },
  smallAction: {
    minHeight: spacing[32],
  },
  slider: {
    width: '100%',
    height: spacing[32],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  input: {
    flex: 1,
    minHeight: spacing[32] + spacing[12],
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: radius.control,
    backgroundColor: color.surfaceSubtle,
    paddingHorizontal: space.cardGap,
    color: color.text,
    fontSize: typography.sizes[16],
  },
  addButton: {
    minWidth: spacing[32] + spacing[12],
  },
  attachWrap: {
    marginTop: spacing[4],
  },
  attachRow: {
    gap: spacing[8],
    paddingRight: spacing[8],
  },
  removableChip: {
    minHeight: spacing[32],
    paddingHorizontal: spacing[12],
    borderRadius: radius.control,
    borderWidth: border.width,
    borderColor: color.border,
    backgroundColor: color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  availableChip: {
    minHeight: spacing[32],
    paddingHorizontal: spacing[12],
    borderRadius: radius.control,
    borderWidth: border.width,
    borderColor: color.border,
    backgroundColor: color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  moodChip: {
    minHeight: spacing[32],
    paddingHorizontal: spacing[12],
    borderRadius: radius.control,
    borderWidth: border.width,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodChipSelected: {
    backgroundColor: color.accentSoft,
    borderColor: color.accent,
  },
  summaryWrap: {
    gap: spacing[4],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[8],
  },
  bulletBar: {
    width: spacing[4],
    height: spacing[24],
    borderRadius: spacing[4],
    backgroundColor: color.accentSoft,
    marginTop: spacing[4],
  },
  bulletText: {
    flex: 1,
  },
  copyButton: {
    width: spacing[32],
    height: spacing[32],
    borderRadius: spacing[8],
    borderWidth: border.width,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  disabledAction: {
    opacity: 0.5,
  },
  pressedAction: {
    opacity: 0.75,
  },
  longText: {
    lineHeight: typography.sizes[16] + spacing[8],
    color: color.text,
  },
  transcriptMeta: {
    marginTop: spacing[8],
  },
});
