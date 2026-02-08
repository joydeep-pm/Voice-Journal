import Slider from '@react-native-community/slider';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { formatClock } from '@/src/audio/recorder';
import { useAudioPlayer } from '@/src/audio/player';
import { generateTagsForEntry, runAiWorker } from '@/src/ai/worker';
import { attachTag, createTag, detachTag, getEntry, listTags } from '@/src/db/entries';
import { enqueueAiJob } from '@/src/db/jobs';
import type { Entry, Tag } from '@/src/db/types';
import { Button, Card, Chip, InlineStatus, LoadingState, Screen, Text } from '@/src/ui/components';
import { border, color, radius, space, spacing, typography } from '@/src/ui/tokens';

function formatDate(ms: number) {
  return new Date(ms).toLocaleString();
}

function fileNameFromUri(uri: string) {
  const segments = uri.split('/');
  return segments[segments.length - 1] || uri;
}

function entryTitle(entry: Entry): string {
  if (entry.summary?.trim()) {
    return entry.summary.trim().split('\n')[0] || 'Audio note';
  }
  return 'Audio note';
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
      <View style={styles.entryHeader}>
        <Text variant="h1" numberOfLines={2}>
          {entryTitle(entry)}
        </Text>
        <Text variant="muted">{formatDate(entry.createdAt)}</Text>
      </View>

      <Card quiet>
        <View style={styles.sectionTitleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Player</Text>
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {fileNameFromUri(entry.audioUri)}
        </Text>

        <View style={styles.row}>
          <Button
            label={player.isPlaying ? 'Pause' : 'Play'}
            onPress={() => void player.togglePlayPause()}
            disabled={!player.isLoaded}
          />
          <Button
            label="Restart"
            variant="secondary"
            compact
            onPress={() => void player.seekTo(0)}
            disabled={!player.isLoaded}
          />
        </View>

        <View style={styles.row}>
          <Button label="-10s" variant="secondary" compact onPress={() => jumpBy(-10)} disabled={!player.isLoaded} />
          <Button label="+10s" variant="secondary" compact onPress={() => jumpBy(10)} disabled={!player.isLoaded} />
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
          <Text variant="caption" tone="secondary" compact>
            {formatClock(sliderValue)} / {formatClock(maxDurationSec)}
          </Text>
          <Text variant="caption" tone="secondary" compact>
            -{formatClock(remainingSec)}
          </Text>
        </View>
        {player.error ? <InlineStatus tone="error" message={player.error} /> : null}
      </Card>

      <Card quiet>
        <View style={styles.sectionTitleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">AI</Text>
        </View>
        <InlineStatus
          message={`Status: ${entry.aiStatus.toUpperCase()}`}
          tone={entry.aiStatus === 'error' ? 'error' : entry.aiStatus === 'summarized' ? 'success' : 'info'}
        />
        {entry.errorMsg ? <InlineStatus tone="error" message={entry.errorMsg} /> : null}
        <Button
          label={busyAi ? 'Processing...' : 'Process with AI'}
          onPress={() => void processWithAi()}
          disabled={busyAi || entry.aiStatus === 'queued'}
        />
      </Card>

      <Card quiet>
        <View style={styles.sectionTitleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Tags</Text>
        </View>

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
              <Chip
                key={tag.id}
                label={`#${tag.name} x`}
                onPress={() => void removeTag(tag.id)}
                disabled={busyTag}
              />
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrapRow}>
              {attachableTags.map((tag) => (
                <Chip
                  key={`available-${tag.id}`}
                  label={`+ #${tag.name}`}
                  onPress={() => void addExistingTag(tag.id)}
                  disabled={busyTag}
                />
              ))}
            </ScrollView>
            {attachableTags.length > 3 ? <View pointerEvents="none" style={styles.attachHint} /> : null}
          </View>
        ) : null}
      </Card>

      <Card quiet>
        <View style={styles.sectionTitleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Transcript</Text>
        </View>
        <Text variant="body" style={styles.longText}>
          {entry.transcript?.trim() || 'No transcript yet.'}
        </Text>
      </Card>

      <Card quiet>
        <View style={styles.sectionTitleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Summary</Text>
        </View>
        <Text variant="body" style={styles.longText}>
          {entry.summary?.trim() || 'No summary yet.'}
        </Text>
      </Card>

      {infoMessage ? <InlineStatus message={infoMessage} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entryHeader: {
    gap: space.compactGap,
    marginBottom: space.compactGap,
  },
  sectionTitleRow: {
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
    gap: space.controlGap,
    alignItems: 'center',
    flexWrap: 'wrap',
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
    gap: space.controlGap,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
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
    minWidth: spacing[32] + spacing[20],
  },
  attachWrap: {
    position: 'relative',
    borderRadius: radius.control,
    borderWidth: border.width,
    borderColor: color.border,
    padding: space.controlGap,
    backgroundColor: color.surfaceSubtle,
  },
  attachHint: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: spacing[32],
    borderTopRightRadius: radius.control,
    borderBottomRightRadius: radius.control,
    borderLeftWidth: border.width,
    borderLeftColor: color.border,
    opacity: 0.55,
    backgroundColor: color.surfaceSubtle,
  },
  longText: {
    lineHeight: typography.sizes[24],
    color: color.text,
  },
});
