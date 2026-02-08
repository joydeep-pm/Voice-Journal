import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { runAiWorker } from '@/src/ai/worker';
import { formatClock, RecordedClip, useAudioRecorder } from '@/src/audio/recorder';
import { createEntry, updateEntry } from '@/src/db/entries';
import { enqueueAiJob } from '@/src/db/jobs';
import { AppHeader, Button, Card, InlineStatus, Screen, Text } from '@/src/ui/components';
import { color, space } from '@/src/ui/tokens';

function modeLabel(mode: 'idle' | 'recording' | 'paused' | 'stopping') {
  if (mode === 'recording') {
    return 'Recording';
  }
  if (mode === 'paused') {
    return 'Paused';
  }
  if (mode === 'stopping') {
    return 'Stopping';
  }
  return 'Idle';
}

async function hapticMedium() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // no-op when haptics are unavailable
  }
}

async function hapticLight() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op when haptics are unavailable
  }
}

export default function RecordScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingClip, setPendingClip] = useState<RecordedClip | null>(null);

  const recorder = useAudioRecorder({
    onBackgroundStop: (clip) => {
      setPendingClip(clip);
    },
  });

  const saveClip = async (clip: RecordedClip) => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const entry = await createEntry({
        audioUri: clip.audioUri,
        durationSec: clip.durationSec,
      });

      if (clip.fileSaveError) {
        await updateEntry(entry.id, {
          errorMsg: `Audio persisted from temp URI: ${clip.fileSaveError}`,
        });
      }

      if (clip.stopReason === 'background') {
        setSaveMessage('Background interruption clip saved.');
      }

      const queueResult = await enqueueAiJob(entry.id, 'transcribe');
      if (queueResult.enqueued) {
        void runAiWorker();
      }

      setPendingClip(null);
      router.push({ pathname: '/entry/[id]', params: { id: entry.id } });
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const onStopPress = async () => {
    await hapticMedium();
    const clip = await recorder.stop();
    if (!clip) {
      return;
    }

    await saveClip(clip);
  };

  const onStartPress = async () => {
    await hapticMedium();
    await recorder.start();
  };

  const onPauseResume = async () => {
    await hapticLight();
    if (recorder.mode === 'recording') {
      await recorder.pause();
      return;
    }

    if (recorder.mode === 'paused') {
      await recorder.resume();
    }
  };

  const isIdle = recorder.mode === 'idle';
  const showPauseResume = recorder.mode === 'recording' || recorder.mode === 'paused';

  return (
    <Screen scroll={false}>
      <AppHeader title="Record" subtitle="Capture a voice entry" />

      <View style={[styles.flexBody, isIdle ? styles.centerWhenIdle : null]}>
        {recorder.permissionState === 'denied' ? (
          <Card>
            <Text variant="h2">Microphone permission required</Text>
            <Text variant="muted">
              Recording is blocked because microphone access is denied. Open your device settings and enable microphone permission for this app.
            </Text>
          </Card>
        ) : null}

        <Card quiet style={styles.recorderCard}>
          <View style={styles.centerStack}>
            <InlineStatus tone={isIdle ? 'info' : 'success'} message={modeLabel(recorder.mode).toUpperCase()} quiet />
            <View style={styles.timerWrap}>
              <Text variant="display" style={styles.timer}>
                {formatClock(recorder.elapsedSec)}
              </Text>
            </View>
          </View>

          {recorder.message ? <InlineStatus tone="error" message={recorder.message} /> : null}
          {saveMessage ? <InlineStatus tone="info" message={saveMessage} /> : null}

          <View style={styles.controls}>
            <Button
              label={saving ? 'Saving...' : isIdle ? 'Start recording' : 'Stop recording'}
              onPress={() => {
                if (isIdle) {
                  void onStartPress();
                } else {
                  void onStopPress();
                }
              }}
              disabled={saving || recorder.mode === 'stopping'}
            />

            {showPauseResume ? (
              <Button
                label={recorder.mode === 'recording' ? 'Pause' : 'Resume'}
                variant="secondary"
                compact
                onPress={() => void onPauseResume()}
                disabled={saving || recorder.mode === 'stopping'}
              />
            ) : null}
          </View>
        </Card>

        {pendingClip ? (
          <Card>
            <Text variant="h2">Interrupted recording</Text>
            <Text variant="muted">Recording stopped in background. Save this clip now?</Text>
            <Button
              label={saving ? 'Saving...' : 'Save interrupted clip'}
              onPress={() => void saveClip(pendingClip)}
              disabled={saving}
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexBody: {
    flex: 1,
    gap: space.sectionGap,
  },
  centerWhenIdle: {
    justifyContent: 'center',
  },
  recorderCard: {
    gap: space.sectionGap,
  },
  centerStack: {
    alignItems: 'center',
    gap: space.cardGap,
  },
  timerWrap: {
    width: '100%',
    borderRadius: 9999,
    backgroundColor: color.surfaceSubtle,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.sectionGap,
    alignItems: 'center',
  },
  timer: {
    color: color.text,
  },
  controls: {
    gap: space.controlGap,
  },
});
