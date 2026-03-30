import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { fallbackMachines } from '../../src/fallback';
import { Card, Chip, Hero, PrimaryButton, Row, Screen, Stack } from '../../src/ui';
import { useBridge } from '../../src/bridge';
import { theme } from '../../src/theme';

export default function MachinesScreen() {
  const { call, ready, baseUrl } = useBridge();
  const [machines, setMachines] = useState(fallbackMachines);
  const [message, setMessage] = useState('Use machine runs to replay registry-backed workflows.');

  async function refresh() {
    const response = await call('/machines');
    if (response.ok && Array.isArray(response.data?.machines || response.data)) {
      setMachines(response.data.machines || response.data);
      setMessage('Live machine registry loaded from the bridge.');
      return;
    }
    setMachines(fallbackMachines);
    setMessage(response.error || 'Offline preview mode.');
  }

  async function runMachine(id) {
    const response = await call('/machine/run', {
      method: 'POST',
      body: { id },
    });
    setMessage(response.ok ? `Ran machine ${id}.` : `Could not run ${id}: ${response.error}`);
  }

  useEffect(() => {
    if (ready) {
      refresh();
    }
  }, [ready, baseUrl]);

  return (
    <Screen>
      <Hero
        kicker="Machine registry"
        title="Pipeline, mesh, and broker runs exposed as mobile tasks."
        subtitle="This is the wrapper entrypoint for the same machine catalog the CLI publishes."
      />

      <Card title="Bridge note" accentColor={theme.colors.warn}>
        <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{message}</Text>
      </Card>

      <Stack gap={14}>
        {machines.map(machine => (
          <Card key={machine.id} title={machine.id} accentColor={theme.colors.accent}>
            <Stack>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip tone="good">{machine.type}</Chip>
              </View>
              <Text style={{ color: theme.colors.text, lineHeight: 20 }}>{machine.description}</Text>
              {machine.steps ? (
                <Row label="Steps" value={machine.steps.map(step => step.tool || step.id).join(' -> ')} />
              ) : null}
              <PrimaryButton label={`Run ${machine.id}`} onPress={() => runMachine(machine.id)} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
