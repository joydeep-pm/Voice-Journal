import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { useBiometricGate } from '@/src/runtime/useBiometricGate';
import { useAppRuntime } from '@/src/runtime/useAppRuntime';
import { Button, Card, Text } from '@/src/ui/components';
import { setUiFontEnabled } from '@/src/ui/fontState';
import { color, space } from '@/src/ui/tokens';
import { WorkspaceProvider, useWorkspace } from '@/src/workspace/WorkspaceContext';

function RootLayoutBody() {
  useAppRuntime();
  const workspace = useWorkspace();
  const biometric = useBiometricGate();
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    setUiFontEnabled(fontsLoaded && !fontError);
  }, [fontsLoaded, fontError]);

  if (!workspace.ready) {
    return (
      <View style={styles.loadingWrap}>
        <Card style={styles.lockCard}>
          <Text variant="h1">Preparing workspaces</Text>
          <Text variant="muted">Initializing personal and professional data stores...</Text>
        </Card>
      </View>
    );
  }

  const lockVisible = biometric.enabled && (!biometric.ready || (biometric.supported && !biometric.unlocked));

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entry/[id]" options={{ title: 'Entry Detail' }} />
      </Stack>
      {workspace.migrationError ? (
        <View style={styles.warningWrap}>
          <Card quiet>
            <Text variant="caption" tone="danger">
              Workspace migration warning
            </Text>
            <Text variant="muted">{workspace.migrationError}</Text>
          </Card>
        </View>
      ) : null}
      {lockVisible ? (
        <View style={styles.lockBackdrop}>
          <Card style={styles.lockCard}>
            <Text variant="h1">Unlock Voice Journal</Text>
            <Text variant="muted">{biometric.ready ? 'Authenticate to continue.' : 'Checking security...'}</Text>
            {biometric.error ? <Text variant="caption" tone="danger">{biometric.error}</Text> : null}
            {biometric.ready ? <Button label="Unlock" onPress={() => void biometric.unlock()} /> : null}
          </Card>
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <WorkspaceProvider>
      <RootLayoutBody />
    </WorkspaceProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    backgroundColor: color.bg,
    justifyContent: 'center',
    paddingHorizontal: space.pageX,
  },
  warningWrap: {
    position: 'absolute',
    left: space.pageX,
    right: space.pageX,
    top: space.pageX,
  },
  lockBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
    justifyContent: 'center',
    paddingHorizontal: space.pageX,
  },
  lockCard: {
    gap: space.cardGap,
    backgroundColor: color.surface,
  },
});
