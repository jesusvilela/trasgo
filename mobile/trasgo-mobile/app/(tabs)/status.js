import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fallbackStatus } from '../../src/fallback';
import { Card, Chip, Field, Hero, PrimaryButton, Row, Screen, Stack } from '../../src/ui';
import { normalizeBridgeUrl, useBridge } from '../../src/bridge';
import { theme } from '../../src/theme';

const LOCALHOST_HINTS = [
  'iOS simulator: http://127.0.0.1:8787',
  'Android emulator: http://10.0.2.2:8787',
  "Physical device: your machine's LAN IP",
];

export default function StatusScreen() {
  const { baseUrl, setBaseUrl, call, ready } = useBridge();
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [status, setStatus] = useState(fallbackStatus);
  const [message, setMessage] = useState('No bridge check has been run yet.');

  useEffect(() => {
    setDraftUrl(baseUrl);
  }, [baseUrl]);

  async function saveUrl() {
    const normalized = normalizeBridgeUrl(draftUrl);
    const saved = await setBaseUrl(normalized);
    setDraftUrl(saved);
    setMessage(`Saved bridge URL: ${saved}`);
  }

  async function checkBridge() {
    const response = await call('/status');
    if (response.ok) {
      setStatus(response.data);
      setMessage('Bridge responded successfully.');
      return;
    }
    setStatus({ ...fallbackStatus, bridgeUrl: baseUrl, note: response.error });
    setMessage(`Bridge check failed: ${response.error}`);
  }

  return (
    <Screen>
      <Hero
        kicker="Status and setup"
        title="Configure the bridge URL and verify the live control plane."
        subtitle="This tab is the app-side trust surface for local or remote bridge connections."
      />

      <Card title="Bridge settings" accentColor={theme.colors.accent}>
        <Stack>
          <Field label="Bridge base URL" value={draftUrl} onChangeText={setDraftUrl} placeholder="http://127.0.0.1:8787" />
          <Stack gap={10}>
            <PrimaryButton label="Save URL" onPress={saveUrl} />
            <PrimaryButton label="Check bridge" onPress={checkBridge} />
          </Stack>
          <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>
            {ready ? 'Settings loaded.' : 'Loading saved settings...'}
          </Text>
        </Stack>
      </Card>

      <Card title="Bridge status" accentColor={theme.colors.good}>
        <Stack>
          <Row label="Online" value={status.ok ? 'yes' : 'no'} />
          <Row label="Runtime" value={status.runtime || 'preview'} />
          <Row label="Bridge URL" value={status.bridgeUrl || baseUrl} />
          <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{status.note || fallbackStatus.note}</Text>
        </Stack>
      </Card>

      <Card title="Mobile notes" accentColor={theme.colors.warn}>
        <Stack>
          {LOCALHOST_HINTS.map(item => (
            <Row key={item} label="Hint" value={item} />
          ))}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip>Android</Chip>
            <Chip>iOS</Chip>
            <Chip>Bridge-driven</Chip>
          </View>
        </Stack>
      </Card>

      <Card title="Preview fallback" accentColor={theme.colors.bad}>
        <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>
          {fallbackStatus.note}
        </Text>
      </Card>
    </Screen>
  );
}
