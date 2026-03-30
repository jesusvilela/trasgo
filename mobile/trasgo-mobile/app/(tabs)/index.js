import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { fallbackQuickstart, fallbackStatus } from '../../src/fallback';
import { Card, Chip, Hero, PrimaryButton, Row, Screen, SectionTitle, Stack } from '../../src/ui';
import { useBridge } from '../../src/bridge';
import { theme } from '../../src/theme';

export default function HomeScreen() {
  const { baseUrl, ready, call, fallbackStatus: fallback } = useBridge();
  const [status, setStatus] = useState(fallback);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const result = await call('/status');
    setStatus(result.ok ? result.data : { ...fallbackStatus, note: result.error || fallbackStatus.note, bridgeUrl: baseUrl });
    setLoading(false);
  }

  useEffect(() => {
    if (ready) {
      refresh();
    }
  }, [ready, baseUrl]);

  return (
    <Screen>
      <Hero
        kicker="Trasgo mobile"
        title="Quickstart, runtime status, and exact token science in one wrapper."
        subtitle="This app is a thin Expo shell over the same bridge the CLI will use. It stays data-driven even when the bridge is offline."
      />

      <Card title="Quickstart" accentColor={theme.colors.good}>
        <Stack>
          {fallbackQuickstart.map(step => (
            <Row key={step} label="Step" value={step} />
          ))}
          <PrimaryButton label="Open Status" onPress={() => router.push('/status')} />
        </Stack>
      </Card>

      <Card title="Bridge" accentColor={theme.colors.accent}>
        <Stack>
          <Row label="Base URL" value={baseUrl} />
          <Row label="Connection" value={loading ? 'checking…' : status?.ok ? 'online' : 'offline'} />
          <Row label="Runtime" value={status?.runtime || 'preview'} />
          <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{status?.note || fallbackStatus.note}</Text>
        </Stack>
      </Card>

      <Card title="Live surfaces" accentColor={theme.colors.warn}>
        <Stack>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip>Home / Quickstart</Chip>
            <Chip>Demos</Chip>
            <Chip>Tokens</Chip>
            <Chip>Machines</Chip>
            <Chip>Status</Chip>
          </View>
          <Row label="Expected endpoints" value={(status?.endpoints || fallbackStatus.endpoints).join(', ')} />
        </Stack>
      </Card>
    </Screen>
  );
}
