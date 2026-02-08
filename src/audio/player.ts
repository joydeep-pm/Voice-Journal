import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio, AVPlaybackStatusSuccess } from 'expo-av';

function toSeconds(ms: number) {
  return Math.max(0, Math.floor(ms / 1000));
}

export function useAudioPlayer(audioUri: string | null | undefined) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    setIsLoaded(false);
    setIsPlaying(false);
    setPositionSec(0);
    setDurationSec(0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!audioUri) {
        await unload();
        return;
      }

      setError(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      await unload();

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded) {
              return;
            }

            const loaded = status as AVPlaybackStatusSuccess;
            setIsLoaded(true);
            setIsPlaying(loaded.isPlaying);
            setPositionSec(toSeconds(loaded.positionMillis));
            setDurationSec(toSeconds(loaded.durationMillis ?? 0));
          }
        );

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load audio file.');
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [audioUri, unload]);

  useEffect(() => {
    return () => {
      void unload();
    };
  }, [unload]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current || !isLoaded) {
      return;
    }

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, [isLoaded, isPlaying]);

  const seekTo = useCallback(
    async (seconds: number) => {
      if (!soundRef.current || !isLoaded) {
        return;
      }

      await soundRef.current.setPositionAsync(Math.max(0, Math.floor(seconds)) * 1000);
    },
    [isLoaded]
  );

  return {
    isLoaded,
    isPlaying,
    positionSec,
    durationSec,
    error,
    togglePlayPause,
    seekTo,
    unload,
  };
}
