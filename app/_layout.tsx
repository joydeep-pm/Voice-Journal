import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { useAppRuntime } from '@/src/runtime/useAppRuntime';
import { setUiFontEnabled } from '@/src/ui/fontState';

export default function RootLayout() {
  useAppRuntime();
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    setUiFontEnabled(fontsLoaded && !fontError);
  }, [fontsLoaded, fontError]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Entry Detail' }} />
      </Stack>
    </>
  );
}
