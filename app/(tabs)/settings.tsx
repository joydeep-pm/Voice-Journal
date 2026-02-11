import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { checkAiBackendHealth, getAiBackendBaseUrl } from '@/src/ai/client';
import { runAiWorker } from '@/src/ai/worker';
import { createEntry, deleteAllEntries, deleteEntry, exportJournalData, getEntry, listEntries, updateEntry } from '@/src/db/entries';
import { listAiJobs } from '@/src/db/jobs';
import {
  getReminderPreferences,
  getSafetyPlan,
  getSyncState,
  listGad2Assessments,
  listRecentStressCheckIns,
  updateReminderPreferences,
  updateSafetyPlan,
  updateSyncState,
} from '@/src/db/wellness';
import type { ReminderPreferences, SyncState } from '@/src/db/types';
import { AppHeader, Button, Card, InlineStatus, Screen, Text } from '@/src/ui/components';
import { border, color, radius, space, spacing, typography } from '@/src/ui/tokens';
import { useWorkspace } from '@/src/workspace/WorkspaceContext';
import { formatMinutes } from '@/src/wellness/utils';

export default function SettingsScreen() {
  const { activeWorkspace } = useWorkspace();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [reminders, setReminders] = useState<ReminderPreferences | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [copingDraft, setCopingDraft] = useState('');
  const [contactDraft, setContactDraft] = useState('');
  const aiToken = process.env.EXPO_PUBLIC_AI_API_TOKEN;
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

  const personalApiBase = currentAiUrl.replace(/\/ai$/, '');
  const personalApiHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (aiToken) {
    personalApiHeaders.Authorization = `Bearer ${aiToken}`;
  }

  useEffect(() => {
    if (activeWorkspace !== 'personal') {
      return;
    }

    void (async () => {
      try {
        const [prefs, safety, sync] = await Promise.all([getReminderPreferences(), getSafetyPlan(), getSyncState()]);
        setReminders(prefs);
        setSyncState(sync);
        setCopingDraft(safety.copingText);
        setContactDraft(safety.trustedContact);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load personal settings.');
      }
    })();
  }, [activeWorkspace]);

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
      const path = `${FileSystem.cacheDirectory}voice-journal-${activeWorkspace}-export-${Date.now()}.json`;
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

  const saveReminderPatch = async (patch: Partial<ReminderPreferences>) => {
    if (activeWorkspace !== 'personal') {
      return;
    }
    setBusyAction('personal-reminders');
    setStatus(null);
    try {
      const next = await updateReminderPreferences({
        enabled: patch.enabled,
        adaptive: patch.adaptive,
        quietStartMin: patch.quietStartMin,
        quietEndMin: patch.quietEndMin,
        maxPerDay: patch.maxPerDay,
      });
      setReminders(next);
      setStatus('Reminder preferences updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update reminders.');
    } finally {
      setBusyAction(null);
    }
  };

  const saveSafety = async () => {
    if (activeWorkspace !== 'personal') {
      return;
    }
    setBusyAction('personal-safety');
    setStatus(null);
    try {
      const saved = await updateSafetyPlan({
        copingText: copingDraft.trim(),
        trustedContact: contactDraft.trim(),
      });
      setCopingDraft(saved.copingText);
      setContactDraft(saved.trustedContact);
      setStatus('Safety plan saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save safety plan.');
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSync = async () => {
    if (!syncState || activeWorkspace !== 'personal') {
      return;
    }
    setBusyAction('personal-sync-toggle');
    setStatus(null);
    try {
      const next = await updateSyncState({ enabled: !syncState.enabled, lastError: null });
      setSyncState(next);
      setStatus(next.enabled ? 'Cloud sync enabled (personal only).' : 'Cloud sync disabled.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to update sync setting.');
    } finally {
      setBusyAction(null);
    }
  };

  const runPersonalSyncNow = async () => {
    if (activeWorkspace !== 'personal') {
      return;
    }
    setBusyAction('personal-sync');
    setStatus(null);
    try {
      const pull = await fetch(`${personalApiBase}/v1/personal/sync/pull`, {
        method: 'POST',
        headers: personalApiHeaders,
      });
      const push = await fetch(`${personalApiBase}/v1/personal/sync/push`, {
        method: 'POST',
        headers: personalApiHeaders,
      });

      if (!pull.ok || !push.ok) {
        throw new Error(`Sync failed: pull=${pull.status}, push=${push.status}`);
      }

      const next = await updateSyncState({ lastSyncAt: Date.now(), lastError: null });
      setSyncState(next);
      setStatus('Personal sync completed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.';
      await updateSyncState({ lastError: message });
      setSyncState((prev) => (prev ? { ...prev, lastError: message } : prev));
      setStatus(message);
    } finally {
      setBusyAction(null);
    }
  };

  const shareWeeklyWellnessReport = async () => {
    if (activeWorkspace !== 'personal') {
      return;
    }
    setBusyAction('personal-report');
    setStatus(null);
    try {
      const [entries, checkIns, gad2] = await Promise.all([
        listEntries(),
        listRecentStressCheckIns(10),
        listGad2Assessments(4),
      ]);
      const lines = [
        'Voice Journal Personal Weekly Report',
        `Generated: ${new Date().toISOString()}`,
        '',
        `Entries this week: ${entries.length}`,
        '',
        'Recent stress check-ins:',
        ...checkIns.map(
          (item) =>
            `- ${new Date(item.createdAt).toLocaleString()}: ${item.stressIntensity}/10 (${item.recommendedTool})`
        ),
        '',
        'Recent GAD-2:',
        ...gad2.map(
          (item) => `- ${new Date(item.createdAt).toLocaleDateString()}: total ${item.totalScore}/6`
        ),
        '',
        'Personal safety plan:',
        copingDraft.trim() || '(empty)',
        '',
        'Trusted contact:',
        contactDraft.trim() || '(empty)',
      ].join('\n');

      const path = `${FileSystem.cacheDirectory}voice-journal-personal-report-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(path, lines);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus(`Report saved at ${path}.`);
        return;
      }

      await Sharing.shareAsync(path, {
        mimeType: 'text/plain',
        dialogTitle: 'Share Personal Weekly Report',
      });
      setStatus('Personal report generated and shared.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to share report.');
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

      {activeWorkspace === 'personal' && reminders ? (
        <Card quiet>
          <View style={styles.titleRow}>
            <View style={styles.titleMarker} />
            <Text variant="h2">Personal reminders</Text>
          </View>
          <Text variant="muted">
            Quiet hours: {formatMinutes(reminders.quietStartMin)} - {formatMinutes(reminders.quietEndMin)}
          </Text>
          <View style={styles.buttonGrid}>
            <Button
              label={reminders.enabled ? 'Disable reminders' : 'Enable reminders'}
              variant="secondary"
              compact
              onPress={() => void saveReminderPatch({ enabled: !reminders.enabled })}
              disabled={Boolean(busyAction)}
            />
            <Button
              label={reminders.adaptive ? 'Adaptive: On' : 'Adaptive: Off'}
              variant="secondary"
              compact
              onPress={() => void saveReminderPatch({ adaptive: !reminders.adaptive })}
              disabled={Boolean(busyAction)}
            />
            <Button
              label={`Max/day: ${reminders.maxPerDay}`}
              variant="secondary"
              compact
              onPress={() => void saveReminderPatch({ maxPerDay: reminders.maxPerDay >= 3 ? 1 : reminders.maxPerDay + 1 })}
              disabled={Boolean(busyAction)}
            />
            <Button
              label="Quiet: 10PM-8AM"
              variant="secondary"
              compact
              onPress={() => void saveReminderPatch({ quietStartMin: 1320, quietEndMin: 480 })}
              disabled={Boolean(busyAction)}
            />
          </View>
        </Card>
      ) : null}

      {activeWorkspace === 'personal' ? (
        <Card quiet>
          <View style={styles.titleRow}>
            <View style={styles.titleMarker} />
            <Text variant="h2">Safety resources</Text>
          </View>
          <Text variant="muted">If you are in immediate danger, call emergency services now.</Text>
          <View style={styles.buttonGrid}>
            <Button label="Call 988" compact onPress={() => void Linking.openURL('tel:988')} />
            <Button label="Text 988" compact variant="secondary" onPress={() => void Linking.openURL('sms:988')} />
            <Button
              label="988 web"
              compact
              variant="secondary"
              onPress={() => void Linking.openURL('https://988lifeline.org/')}
            />
          </View>
          <Text variant="caption" tone="secondary">Personal coping steps</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            value={copingDraft}
            onChangeText={setCopingDraft}
            placeholder="Add short steps that help you calm down."
            placeholderTextColor={color.textSecondary}
          />
          <Text variant="caption" tone="secondary">Trusted contact</Text>
          <TextInput
            style={styles.input}
            value={contactDraft}
            onChangeText={setContactDraft}
            placeholder="Name + phone"
            placeholderTextColor={color.textSecondary}
          />
          <Button
            label={busyAction === 'personal-safety' ? 'Saving...' : 'Save safety plan'}
            variant="secondary"
            onPress={() => void saveSafety()}
            disabled={Boolean(busyAction)}
          />
        </Card>
      ) : null}

      {activeWorkspace === 'personal' && syncState ? (
        <Card quiet>
          <View style={styles.titleRow}>
            <View style={styles.titleMarker} />
            <Text variant="h2">Personal cloud sync</Text>
          </View>
          <Text variant="muted">
            {syncState.enabled ? 'Enabled' : 'Disabled'}
            {syncState.lastSyncAt ? ` - Last sync: ${new Date(syncState.lastSyncAt).toLocaleString()}` : ''}
          </Text>
          {syncState.lastError ? <InlineStatus tone="error" message={syncState.lastError} /> : null}
          <View style={styles.buttonGrid}>
            <Button
              label={syncState.enabled ? 'Disable sync' : 'Enable sync'}
              variant="secondary"
              compact
              onPress={() => void toggleSync()}
              disabled={Boolean(busyAction)}
            />
            <Button
              label={busyAction === 'personal-sync' ? 'Syncing...' : 'Sync now'}
              compact
              onPress={() => void runPersonalSyncNow()}
              disabled={Boolean(busyAction) || !syncState.enabled}
            />
          </View>
        </Card>
      ) : null}

      {activeWorkspace === 'personal' ? (
        <Card quiet>
          <View style={styles.titleRow}>
            <View style={styles.titleMarker} />
            <Text variant="h2">Reports</Text>
          </View>
          <Button
            label={busyAction === 'personal-report' ? 'Preparing...' : 'Share personal weekly report'}
            onPress={() => void shareWeeklyWellnessReport()}
            disabled={Boolean(busyAction)}
          />
        </Card>
      ) : null}

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
  input: {
    borderWidth: border.width,
    borderColor: color.border,
    borderRadius: radius.control,
    backgroundColor: color.surfaceSubtle,
    color: color.text,
    paddingHorizontal: space.controlGap,
    paddingVertical: space.controlGap,
    fontSize: typography.sizes[13],
  },
  multiline: {
    minHeight: spacing[32] + spacing[24],
    textAlignVertical: 'top',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
});
