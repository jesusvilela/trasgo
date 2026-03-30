export const fallbackStatus = {
  ok: false,
  runtime: 'preview',
  bridgeUrl: null,
  note: 'Bridge offline. Configure a local HTTP bridge to unlock live data.',
  endpoints: ['status', 'demos', 'machines', 'tokens', 'optimize', 'demo/run', 'machine/run'],
};

export const fallbackDemos = [
  {
    id: 'factory-copilot',
    title: 'Factory Copilot',
    lane: 'operative usefulness',
    summary: 'Predictive maintenance triage with avoided downtime economics.',
  },
  {
    id: 'revenue-guard',
    title: 'Revenue Guard',
    lane: 'economic usefulness',
    summary: 'Quote-governance workflow that protects margin and cash timing.',
  },
];

export const fallbackMachines = [
  {
    id: 'observatory',
    type: 'pipeline',
    description: 'Watch the runtime and refresh observability surfaces.',
  },
  {
    id: 'research-mesh',
    type: 'mesh',
    description: 'Run research, then synthesize the artifacts.',
  },
  {
    id: 'runtime-broker',
    type: 'broker',
    description: 'Negotiate local-vs-cloud routing from the current session contract.',
  },
];

export const fallbackQuickstart = [
  'Set the bridge URL in Status.',
  'Open Demos and run one workflow.',
  'Open Tokens and compare codec vs natural language.',
  'Open Machines and inspect the runnable registry.',
  'Open Home for the quickstart checklist.',
];
