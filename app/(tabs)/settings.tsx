import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { checkAiBackendHealth, getAiBackendBaseUrl } from '@/src/ai/client';
import { runAiWorker } from '@/src/ai/worker';
import { createEntry, deleteAllEntries, deleteEntry, exportJournalData, getEntry, listEntries, updateEntry } from '@/src/db/entries';
import { listAiJobs } from '@/src/db/jobs';
import { AppHeader, Button, Card, InlineStatus, Screen, Text } from '@/src/ui/components';
import { border, color, radius, space, spacing, typography } from '@/src/ui/tokens';

export default function SettingsScreen() {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const currentAiUrl = (() => {
    try {
      return getAiBackendBaseUrl();
    } catch {
      return 'Not configured';
    }
  })();

  const pushLog = (line: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 100));
  };

  const testAiConnection = async () => {
    setBusyAction('ai-health');
    setConfirmDeleteAll(false);
    setStatus(null);

    try {
      const health = await checkAiBackendHealth();
      setStatus(`AI backend reachable. Service: ${health.service ?? 'unknown'}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI backend check failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const exportData = async () => {
    setBusyAction('export');
    setConfirmDeleteAll(false);
    setStatus(null);

    try {
      const data = await exportJournalData();
      const path = `${FileSystem.cacheDirectory}voice-journal-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus(`Export saved at ${path} (share sheet unavailable on this device).`);
        return;
      }

      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Export Voice Journal data',
      });
      setStatus('Export created and shared.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const runCrudCheck = async () => {
    setBusyAction('crud');
    setConfirmDeleteAll(false);
    setStatus(null);

    try {
      const before = await listEntries();
      const created = await createEntry({ audioUri: `dev://smoke-${Date.now()}.m4a`, durationSec: 7 });
      const fetched = await getEntry(created.id);
      await updateEntry(created.id, { transcript: 'smoke test transcript' });
      const afterUpdate = await getEntry(created.id);
      await deleteEntry(created.id);
      const afterDelete = await getEntry(created.id);
      const finalList = await listEntries();

      setStatus(
        [
          'CRUD OK',
          `Before count: ${before.length}`,
          `Created ID: ${created.id}`,
          `Fetched exists: ${Boolean(fetched)}`,
          `Updated transcript exists: ${Boolean(afterUpdate?.transcript)}`,
          `Deleted exists after delete: ${Boolean(afterDelete)}`,
          `After count: ${finalList.length}`,
        ].join('\n')
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'CRUD check failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const runQueue = async () => {
    setBusyAction('queue');
    setConfirmDeleteAll(false);
    setStatus(null);

    try {
      await runAiWorker((line) => pushLog(line));
      const jobs = await listAiJobs();
      setStatus(`AI worker finished. Jobs tracked: ${jobs.length}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Worker failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const deleteAll = async () => {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      setStatus('Tap "Delete all entries" again to confirm.');
      return;
    }

    setBusyAction('delete-all');
    setStatus(null);

    try {
      const removed = await deleteAllEntries();
      setStatus(`Deleted ${removed} entr${removed === 1 ? 'y' : 'ies'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Delete all failed.');
    } finally {
      setBusyAction(null);
      setConfirmDeleteAll(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Settings" subtitle="Export and diagnostics" titleVariant="h1" compact />

      <Card quiet>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Connectivity</Text>
        </View>
        <Text variant="caption" tone="secondary" compact>
          AI backend URL
        </Text>
        <Text variant="muted" numberOfLines={2} style={styles.urlText}>
          {currentAiUrl}
        </Text>
        <Button
          label={busyAction === 'ai-health' ? 'Checking...' : 'Test AI connection'}
          variant="secondary"
          onPress={() => void testAiConnection()}
          disabled={Boolean(busyAction)}
        />
      </Card>

      <Card quiet>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Data</Text>
        </View>
        <Button
          label={busyAction === 'export' ? 'Exporting...' : 'Export JSON'}
          onPress={() => void exportData()}
          disabled={Boolean(busyAction)}
        />
        <Button
          label={busyAction === 'delete-all' ? 'Deleting...' : confirmDeleteAll ? 'Confirm delete all entries' : 'Delete all entries'}
          variant="secondary"
          onPress={() => void deleteAll()}
          disabled={Boolean(busyAction)}
        />
      </Card>

      <Card quiet>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Diagnostics</Text>
        </View>
        <Button
          label={busyAction === 'crud' ? 'Running...' : 'Run CRUD check'}
          variant="secondary"
          onPress={() => void runCrudCheck()}
          disabled={Boolean(busyAction)}
        />
        <Button
          label={busyAction === 'queue' ? 'Running...' : 'Run AI worker now'}
          variant="secondary"
          onPress={() => void runQueue()}
          disabled={Boolean(busyAction)}
        />
      </Card>

      {status ? <InlineStatus message={status} tone={status.toLowerCase().includes('failed') ? 'error' : 'info'} /> : null}

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleMarker} />
          <Text variant="h2">Worker logs</Text>
        </View>
        {logs.length ? (
          <ScrollView style={styles.logBox}>
            {logs.map((line, idx) => (
              <Text key={`${idx}-${line}`} variant="caption" style={styles.logLine}>
                {line}
              </Text>
            ))}
          </ScrollView>
        ) : (
          <Text variant="muted">No logs yet.</Text>
        )}
      </Card>

      <View style={styles.bottomPad} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  logBox: {
    maxHeight: spacing[32] * 3,
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: radius.control,
    backgroundColor: color.surfaceSubtle,
    padding: space.controlGap,
  },
  logLine: {
    color: color.text,
    fontSize: typography.sizes[13],
    marginBottom: space.compactGap,
  },
  urlText: {
    lineHeight: typography.sizes[16] + spacing[4],
  },
  bottomPad: {
    height: space.sectionGap,
  },
});
