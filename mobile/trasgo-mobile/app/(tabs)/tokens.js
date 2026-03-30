import { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, Chip, Field, Hero, PrimaryButton, Row, Screen, Stack } from '../../src/ui';
import { useBridge } from '../../src/bridge';
import { theme } from '../../src/theme';

const DEFAULT_CODEC = '{"§":1,"Δ":["A->B"],"μ":{"scope":"ops"}}';
const DEFAULT_NATURAL = 'Operator state transition metadata envelope';

export default function TokensScreen() {
  const { call } = useBridge();
  const [codec, setCodec] = useState(DEFAULT_CODEC);
  const [natural, setNatural] = useState(DEFAULT_NATURAL);
  const [models, setModels] = useState('all');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('Enter a packet and compare codec vs natural language.');

  async function analyze() {
    const response = await call('/tokens', {
      method: 'POST',
      body: { codec, natural, models },
    });
    if (response.ok) {
      setResult(response.data);
      setMessage('Live token report loaded from the bridge.');
      return;
    }
    setResult(null);
    setMessage(`Offline or unavailable: ${response.error}`);
  }

  async function optimize() {
    const response = await call('/optimize', {
      method: 'POST',
      body: { codec, models },
    });
    if (response.ok) {
      setResult(response.data);
      setMessage('Live optimization report loaded from the bridge.');
      return;
    }
    setResult(null);
    setMessage(`Offline or unavailable: ${response.error}`);
  }

  return (
    <Screen>
      <Hero
        kicker="Exact token battery"
        title="Measure codec cost, compare narratives, and score alias forms."
        subtitle="The wrapper is configured to talk to the same tokenizer-aware bridge the CLI will use."
      />

      <Card title="Inputs" accentColor={theme.colors.accent}>
        <Stack>
          <Field label="Codec packet" value={codec} onChangeText={setCodec} multiline />
          <Field label="Natural language" value={natural} onChangeText={setNatural} multiline />
          <Field label="Models" value={models} onChangeText={setModels} placeholder="all" />
          <Stack gap={10}>
            <PrimaryButton label="Analyze" onPress={analyze} />
            <PrimaryButton label="Optimize" onPress={optimize} />
          </Stack>
        </Stack>
      </Card>

      <Card title="Bridge note" accentColor={theme.colors.warn}>
        <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{message}</Text>
      </Card>

      {result ? (
        <Card title="Report" accentColor={theme.colors.good}>
          <Stack>
            <Row label="Kind" value={result.kind || 'bridge-report'} />
            {result.summary ? <Row label="Summary" value={result.summary.best_codec_family || result.summary.recommended?.id || 'available'} /> : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {Array.isArray(result.models)
                ? result.models.map(model => <Chip key={model.id || model.name || model}>{model.id || model.name || String(model)}</Chip>)
                : null}
            </View>
            <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>
              {JSON.stringify(result, null, 2)}
            </Text>
          </Stack>
        </Card>
      ) : null}
    </Screen>
  );
}
