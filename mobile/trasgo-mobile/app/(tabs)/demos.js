import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fallbackDemos } from '../../src/fallback';
import { Card, Chip, Hero, PrimaryButton, Row, Screen, SectionTitle, Stack } from '../../src/ui';
import { useBridge } from '../../src/bridge';
import { theme } from '../../src/theme';

export default function DemosScreen() {
  const { call, ready, baseUrl } = useBridge();
  const [demos, setDemos] = useState(fallbackDemos);
  const [message, setMessage] = useState('Use the bridge to run live demos.');

  async function refresh() {
    const result = await call('/demos');
    if (result.ok && Array.isArray(result.data?.demos || result.data)) {
      setDemos(result.data.demos || result.data);
      setMessage('Live demo registry loaded from the bridge.');
      return;
    }
    setDemos(fallbackDemos);
    setMessage(result.error || 'Offline preview mode.');
  }

  async function runDemo(id) {
    const result = await call('/demo/run', {
      method: 'POST',
      body: { id },
    });
    setMessage(result.ok ? `Ran ${id}.` : `Could not run ${id}: ${result.error}`);
  }

  useEffect(() => {
    if (ready) {
      refresh();
    }
  }, [ready, baseUrl]);

  return (
    <Screen>
      <Hero
        kicker="Demo registry"
        title="Operator and economic demos that stay readable on a phone."
        subtitle="The mobile shell only needs the bridge to expose demo metadata and a run action."
      />

      <Card title="Bridge note" accentColor={theme.colors.warn}>
        <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{message}</Text>
      </Card>

      <Stack gap={14}>
        {demos.map(demo => (
          <Card key={demo.id} title={demo.title} accentColor={theme.colors.accent}>
            <Stack>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip>{demo.id}</Chip>
                {demo.lane ? <Chip tone="good">{demo.lane}</Chip> : null}
              </View>
              <Text style={{ color: theme.colors.text, lineHeight: 20 }}>{demo.summary || demo.description || 'Bridge-provided demo payload.'}</Text>
              {demo.intent_examples ? (
                <View style={{ gap: 6 }}>
                  <SectionTitle>Intent examples</SectionTitle>
                  {demo.intent_examples.map(item => (
                    <Row key={item} label="trasgo" value={item} />
                  ))}
                </View>
              ) : null}
              <PrimaryButton label={`Run ${demo.id}`} onPress={() => runDemo(demo.id)} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
