import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

export type RecorderMode = 'idle' | 'recording' | 'paused' | 'stopping';
export type PermissionState = 'unknown' | 'granted' | 'denied';

export type RecordedClip = {
  audioUri: string;
  durationSec: number;
  fileSaveError?: string;
  stopReason: 'user' | 'background';
};

type UseAudioRecorderOptions = {
  onBackgroundStop?: (clip: RecordedClip) => void;
};

function pickExtension(tempUri: string): string {
  const lower = tempUri.toLowerCase();
  if (lower.endsWith('.m4a')) {
    return 'm4a';
  }
  if (lower.endsWith('.caf')) {
    return 'caf';
  }
  return Platform.OS === 'ios' ? 'm4a' : 'm4a';
}

async function persistRecording(tempUri: string): Promise<{ uri: string; fileSaveError?: string }> {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    return { uri: tempUri, fileSaveError: 'FileSystem.documentDirectory unavailable; using temp URI.' };
  }

  const audioDir = `${baseDir}audio`;
  const ext = pickExtension(tempUri);
  const targetUri = `${audioDir}/entry_${Date.now()}.${ext}`;

  try {
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true });
    await FileSystem.copyAsync({ from: tempUri, to: targetUri });
    return { uri: targetUri };
  } catch (error) {
    return {
      uri: tempUri,
      fileSaveError: error instanceof Error ? error.message : 'Failed to persist recording; using temp URI.',
    };
  }
}

export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function useAudioRecorder(options?: UseAudioRecorderOptions) {
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [mode, setMode] = useState<RecorderMode>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<RecorderMode>('idle');
  const stopInFlightRef = useRef(false);
  const elapsedSecRef = useRef(0);
  const onBackgroundStopRef = useRef<UseAudioRecorderOptions['onBackgroundStop']>(options?.onBackgroundStop);

  const startedAtMsRef = useRef(0);
  const pausedAtMsRef = useRef(0);
  const pausedAccumMsRef = useRef(0);

  const updateMode = (next: RecorderMode) => {
    modeRef.current = next;
    setMode(next);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const recalcElapsed = () => {
    if (!startedAtMsRef.current) {
      setElapsedSec(0);
      return;
    }

    const now = modeRef.current === 'paused' ? pausedAtMsRef.current : Date.now();
    const elapsedMs = Math.max(0, now - startedAtMsRef.current - pausedAccumMsRef.current);
    const nextSec = Math.floor(elapsedMs / 1000);
    elapsedSecRef.current = nextSec;
    setElapsedSec(nextSec);
  };

  const startTicker = () => {
    clearTimer();
    timerRef.current = setInterval(recalcElapsed, 300);
  };

  const requestPermission = async (): Promise<boolean> => {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      setPermissionState('granted');
      return true;
    }

    const asked = await Audio.requestPermissionsAsync();
    const granted = asked.granted;
    setPermissionState(granted ? 'granted' : 'denied');

    if (!granted) {
      setMessage('Microphone permission denied. Enable it in device settings.');
    }

    return granted;
  };

  const stopInternal = async (stopReason: RecordedClip['stopReason']): Promise<RecordedClip | null> => {
    if (!recordingRef.current || stopInFlightRef.current) {
      return null;
    }

    stopInFlightRef.current = true;
    updateMode('stopping');
    clearTimer();

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const tempUri = recording.getURI();

      if (!tempUri) {
        throw new Error('Recording file URI is missing.');
      }

      const durationMs =
        'durationMillis' in status && typeof status.durationMillis === 'number'
          ? status.durationMillis
          : elapsedSecRef.current * 1000;

      const persisted = await persistRecording(tempUri);
      const result: RecordedClip = {
        audioUri: persisted.uri,
        durationSec: Math.max(1, Math.round(durationMs / 1000)),
        fileSaveError: persisted.fileSaveError,
        stopReason,
      };

      return result;
    } finally {
      recordingRef.current = null;
      startedAtMsRef.current = 0;
      pausedAtMsRef.current = 0;
      pausedAccumMsRef.current = 0;
      setElapsedSec(0);
      elapsedSecRef.current = 0;
      updateMode('idle');
      stopInFlightRef.current = false;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
    }
  };

  const start = async () => {
    if (modeRef.current !== 'idle') {
      return;
    }

    setMessage(null);

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    recordingRef.current = recording;
    startedAtMsRef.current = Date.now();
    pausedAtMsRef.current = 0;
    pausedAccumMsRef.current = 0;
    setElapsedSec(0);
    elapsedSecRef.current = 0;
    updateMode('recording');
    startTicker();
  };

  const pause = async () => {
    if (!recordingRef.current || modeRef.current !== 'recording') {
      return;
    }

    await recordingRef.current.pauseAsync();
    pausedAtMsRef.current = Date.now();
    updateMode('paused');
    recalcElapsed();
  };

  const resume = async () => {
    if (!recordingRef.current || modeRef.current !== 'paused') {
      return;
    }

    await recordingRef.current.startAsync();
    pausedAccumMsRef.current += Date.now() - pausedAtMsRef.current;
    pausedAtMsRef.current = 0;
    updateMode('recording');
  };

  const stop = async (): Promise<RecordedClip | null> => {
    return stopInternal('user');
  };

  useEffect(() => {
    onBackgroundStopRef.current = options?.onBackgroundStop;
  }, [options?.onBackgroundStop]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if ((nextState === 'inactive' || nextState === 'background') && (modeRef.current === 'recording' || modeRef.current === 'paused')) {
        setMessage('Recording stopped because app moved to background.');
        void stopInternal('background').then((clip) => {
          if (clip && onBackgroundStopRef.current) {
            onBackgroundStopRef.current(clip);
          }
        });
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      if (recordingRef.current) {
        void recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    };
  }, []);

  return {
    permissionState,
    mode,
    elapsedSec,
    message,
    setMessage,
    start,
    pause,
    resume,
    stop,
  };
}
