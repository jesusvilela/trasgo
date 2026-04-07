import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildMcpMessages, mountMcp, unmountMcp } from './mcp-engine.mjs';
import { attachSkill, buildSkillMessages, detachSkill } from './skills-engine.mjs';
import { chatCompletion } from './provider.mjs';

const RUNTIME_ROOT = path.join('.trasgo-runtime');
const SESSIONS_DIR = path.join(RUNTIME_ROOT, 'sessions');
const PACKS_DIR = path.join(RUNTIME_ROOT, 'packs');

function roots(baseDir) {
  if (baseDir && typeof baseDir === 'object') {
    const assetDir = baseDir.assetDir || baseDir.baseDir || baseDir.stateDir || process.cwd();
    const stateDir = baseDir.stateDir || baseDir.baseDir || assetDir;
    return { assetDir, stateDir };
  }
  return { assetDir: baseDir, stateDir: baseDir };
}

function runtimePath(baseDir, ...parts) {
  return path.join(roots(baseDir).stateDir, ...parts);
}

function assetPath(baseDir, ...parts) {
  return path.join(roots(baseDir).assetDir, ...parts);
}

function ensureRuntimeDirs(baseDir) {
  fs.mkdirSync(runtimePath(baseDir, RUNTIME_ROOT), { recursive: true });
  fs.mkdirSync(runtimePath(baseDir, SESSIONS_DIR), { recursive: true });
  fs.mkdirSync(runtimePath(baseDir, PACKS_DIR), { recursive: true });
}

export function listSessions(baseDir) {
  ensureRuntimeDirs(baseDir);
  return fs.readdirSync(runtimePath(baseDir, SESSIONS_DIR))
    .filter(name => name.endsWith('.json'))
    .map(name => {
      try {
        const fullPath = runtimePath(baseDir, SESSIONS_DIR, name);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          id: data.id,
          title: data.title,
          updated_at: data.updated_at,
          active_runtime: data.active_runtime,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

function sessionFilePath(baseDir, sessionId) {
  return runtimePath(baseDir, SESSIONS_DIR, `${sessionId}.json`);
}

function packFilePath(baseDir, sessionId) {
  return runtimePath(baseDir, PACKS_DIR, `${sessionId}.json`);
}

function defaultWorkflowState() {
  return {
    initialized_at: null,
    last_pack_at: null,
    last_pack_path: null,
    last_boot_at: null,
  };
}

function defaultBootState() {
  return {
    status: 'cold',
    booted_at: null,
    active_pack: null,
    runtime: null,
  };
}

function seededFootprints(registry) {
  const map = {};
  for (const runtime of registry.runtimes) {
    map[runtime.id] = {
      seed: { ...(runtime.footprint || {}) },
      observed: {
        calls: 0,
        failures: 0,
        avg_latency_ms: null,
        last_status: 'unknown',
      },
    };
  }
  return map;
}

function normalizeSession(session, registry) {
  session.messages ||= [];
  session.boot_messages ||= [];
  session.skills ||= ['boot-loader'];
  session.skill_state ||= {};
  session.skill_state.injected ||= [];
  session.mcp_mounts ||= ['runtime-registry'];
  session.history ||= [];
  session.checkpoints ||= [];
  session.error_history ||= [];
  session.cert_trajectory ||= [];
  session.evolved_axes ||= [];
  session.evolved_fms ||= [];
  session.footprints ||= seededFootprints(registry);
  session.contract ||= defaultContract(registry);
  session.workflow ||= defaultWorkflowState();
  session.boot ||= defaultBootState();

  for (const runtime of registry.runtimes) {
    session.footprints[runtime.id] ||= seededFootprints({ runtimes: [runtime] })[runtime.id];
    session.footprints[runtime.id].seed ||= { ...(runtime.footprint || {}) };
    session.footprints[runtime.id].observed ||= {
      calls: 0,
      failures: 0,
      avg_latency_ms: null,
      last_status: 'unknown',
    };
  }

  return session;
}

function defaultContract(registry) {
  return {
    policy: 'manifested',
    persist: 'session',
    mode: 'single',
    fallback: 'handoff',
    targets: registry.runtimes.map(runtime => runtime.id),
    priorities: {
      calibration: 1.0,
      transfer: 1.0,
      delta: 1.0,
      protocol: 1.1,
      structured: 0.8,
      efficiency: 0.4,
      locality: 0.8,
      privacy: 0.8,
      cost: 0.6,
      stability: 0.9,
    },
    constraints: {
      require_local: false,
      allow_cloud: true,
      max_latency_ms: null,
    },
  };
}

export function createSession(baseDir, registry, options = {}) {
  ensureRuntimeDirs(baseDir);
  const session = normalizeSession({
    id: options.id || randomUUID(),
    title: options.title || 'trasgo-session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active_runtime: options.activeRuntime || null,
    messages: [],
    boot_messages: [],
    skills: ['boot-loader'],
    skill_state: {
      injected: [],
    },
    mcp_mounts: ['runtime-registry'],
    footprints: {},
    contract: defaultContract(registry),
    history: [],
    workflow: defaultWorkflowState(),
    boot: defaultBootState(),
  }, registry);
  saveSession(baseDir, session);
  return session;
}

export function loadSession(baseDir, sessionId, registry) {
  const fullPath = sessionFilePath(baseDir, sessionId);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`session not found: ${sessionId}`);
  }
  return normalizeSession(JSON.parse(fs.readFileSync(fullPath, 'utf-8')), registry);
}

export function saveSession(baseDir, session) {
  ensureRuntimeDirs(baseDir);
  session.updated_at = new Date().toISOString();
  fs.writeFileSync(sessionFilePath(baseDir, session.id), JSON.stringify(session, null, 2));
}

function skillEntry(registry, skillId) {
  return registry.skills.find(entry => entry.id === skillId) || null;
}

function mcpEntry(registry, mcpId) {
  return registry.mcp.find(entry => entry.id === mcpId) || null;
}

function ensureWorkflowDefaults(session) {
  for (const skillId of ['boot-loader', 'hyperprotocol', 'mode-lock']) {
    attachSkill(session, skillId);
  }
  for (const mcpId of ['runtime-registry', 'codec-docs']) {
    mountMcp(session, mcpId);
  }
}

function setContractFromOptions(session, options = {}) {
  if (options.targets?.length) {
    session.contract.targets = [...options.targets];
  }
  if (options.mode) {
    session.contract.mode = options.mode;
  }
  if (options.fallback) {
    session.contract.fallback = options.fallback;
  }
  if (typeof options.requireLocal === 'boolean') {
    session.contract.constraints.require_local = options.requireLocal;
  }
  if (typeof options.allowCloud === 'boolean') {
    session.contract.constraints.allow_cloud = options.allowCloud;
  }
}

export function balancePacketForSession(session) {
  return {
    '§P': 'balance',
    policy: session.contract.policy,
    targets: session.contract.targets,
    mode: session.contract.mode,
    fallback: session.contract.fallback,
    persist: session.contract.persist,
    priorities: session.contract.priorities,
    constraints: session.contract.constraints,
  };
}

export function initSessionContract(baseDir, registry, options = {}) {
  const session = options.sessionId
    ? loadSession(baseDir, options.sessionId, registry)
    : createSession(baseDir, registry, { title: options.title || 'trasgo-session' });

  if (options.title) {
    session.title = options.title;
  }

  ensureWorkflowDefaults(session);
  setContractFromOptions(session, options);
  session.workflow.initialized_at ||= new Date().toISOString();
  session.boot.status = session.boot.status === 'booted' ? 'booted' : 'initialized';
  saveSession(baseDir, session);
  return session;
}

function packSummary(session, registry, baseDir) {
  return {
    skills: session.skills
      .map(skillId => {
        const skill = skillEntry(registry, skillId);
        if (!skill) return null;
        return {
          id: skill.id,
          kind: skill.kind,
          entry: skill.entry,
          description: skill.description,
          content: fs.readFileSync(assetPath(baseDir, skill.entry), 'utf-8'),
        };
      })
      .filter(Boolean),
    mcp: session.mcp_mounts
      .map(mcpId => {
        const mcp = mcpEntry(registry, mcpId);
        if (!mcp) return null;
        return {
          id: mcp.id,
          transport: mcp.transport,
          root: mcp.root,
          resources: mcp.resources || [],
          description: mcp.description,
        };
      })
      .filter(Boolean),
  };
}

function packPrompt(session, registry, baseDir) {
  const bootSkill = skillEntry(registry, 'boot-loader');
  return {
    boot: bootSkill ? fs.readFileSync(assetPath(baseDir, bootSkill.entry), 'utf-8') : null,
    balance: balancePacketForSession(session),
    mcp_messages: buildMcpMessages(session, registry, baseDir),
  };
}

export function packSession(baseDir, registry, session, options = {}) {
  ensureWorkflowDefaults(session);
  const createdAt = new Date().toISOString();
  const summary = packSummary(session, registry, baseDir);
  const prompt = packPrompt(session, registry, baseDir);
  const bundle = {
    kind: 'trasgo-pack',
    version: 1,
    created_at: createdAt,
    session: {
      id: session.id,
      title: session.title,
    },
    contract: session.contract,
    skills: summary.skills,
    mcp: summary.mcp,
    prompt,
  };

  const outputPath = options.outPath
    ? path.resolve(roots(baseDir).stateDir, options.outPath)
    : packFilePath(baseDir, session.id);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2));

  session.workflow.last_pack_at = createdAt;
  session.workflow.last_pack_path = outputPath;
  saveSession(baseDir, session);

  return {
    session,
    bundle,
    outputPath,
  };
}

export function loadPack(baseDir, packPath) {
  const resolvedPath = path.resolve(roots(baseDir).stateDir, packPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`pack not found: ${resolvedPath}`);
  }
  return {
    path: resolvedPath,
    bundle: JSON.parse(fs.readFileSync(resolvedPath, 'utf-8')),
  };
}

function hydrateSessionFromPack(session, bundle) {
  if (bundle.session?.title && !session.title) {
    session.title = bundle.session.title;
  }

  if (bundle.contract) {
    session.contract = {
      ...session.contract,
      ...bundle.contract,
      priorities: {
        ...session.contract.priorities,
        ...(bundle.contract.priorities || {}),
      },
      constraints: {
        ...session.contract.constraints,
        ...(bundle.contract.constraints || {}),
      },
    };
  }

  for (const skill of bundle.skills || []) {
    attachSkill(session, skill.id);
  }

  for (const mcp of bundle.mcp || []) {
    mountMcp(session, mcp.id);
  }
}

function buildBootMessages(bundle, decision) {
  const bootMessages = [];

  for (const message of bundle.prompt?.mcp_messages || []) {
    bootMessages.push(message);
  }

  for (const skill of bundle.skills || []) {
    bootMessages.push({
      role: 'user',
      content: skill.content,
    });
  }

  if (bundle.prompt?.balance) {
    bootMessages.push({
      role: 'system',
      content: `Trasgo balance contract:\n${JSON.stringify(bundle.prompt.balance)}`,
    });
  }

  bootMessages.push({
    role: 'system',
    content: `Trasgo broker decision:\n${JSON.stringify(decision)}`,
  });

  return bootMessages;
}

export function bootSession(baseDir, registry, options = {}) {
  const session = options.sessionId
    ? loadSession(baseDir, options.sessionId, registry)
    : initSessionContract(baseDir, registry, { title: options.title || 'trasgo-session' });

  let packPath = options.packPath || session.workflow.last_pack_path;
  let bundle;

  if (packPath) {
    ({ path: packPath, bundle } = loadPack(baseDir, packPath));
    hydrateSessionFromPack(session, bundle);
  } else {
    const packed = packSession(baseDir, registry, session, {});
    bundle = packed.bundle;
    packPath = packed.outputPath;
  }

  setContractFromOptions(session, options);
  const decision = brokerDecision(session, registry);
  session.boot_messages = buildBootMessages(bundle, decision);
  session.skill_state.injected = session.skills.filter(skillId => bundle.skills?.some(skill => skill.id === skillId));
  session.active_runtime = decision.selected[0]?.runtime || null;
  session.workflow.last_pack_path = packPath;
  session.workflow.last_pack_at ||= bundle.created_at || new Date().toISOString();
  session.boot = {
    status: 'booted',
    booted_at: new Date().toISOString(),
    active_pack: packPath,
    runtime: session.active_runtime,
  };
  session.workflow.last_boot_at = session.boot.booted_at;
  saveSession(baseDir, session);

  return {
    session,
    bundle,
    decision,
    packPath,
  };
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseBalancePacket(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const json = parseJson(trimmed);
  if (json?.['§P'] === 'balance') {
    return json;
  }

  if (trimmed.startsWith('§P|BALANCE')) {
    const start = trimmed.indexOf('{');
    if (start >= 0) {
      const packet = parseJson(trimmed.slice(start));
      if (packet?.['§P'] === 'balance') {
        return packet;
      }
    }
  }

  return null;
}

export function applyBalancePacket(session, packet) {
  session.contract = {
    ...session.contract,
    ...Object.fromEntries(
      Object.entries(packet).filter(([key]) => key !== '§P')
    ),
  };
  if (packet.targets) {
    session.contract.targets = [...packet.targets];
  }
  if (packet.mode) {
    session.contract.mode = packet.mode;
  }
  if (packet.fallback) {
    session.contract.fallback = packet.fallback;
  }
  if (packet.persist) {
    session.contract.persist = packet.persist;
  }
  if (packet.priorities) {
    session.contract.priorities = {
      ...session.contract.priorities,
      ...packet.priorities,
    };
  }
  if (packet.constraints) {
    session.contract.constraints = {
      ...session.contract.constraints,
      ...packet.constraints,
    };
  }
}

function effectiveMetric(seedValue, observed, metric) {
  if (metric === 'stability') {
    if (observed.calls === 0) return 0.7;
    return Math.max(0.05, 1 - observed.failures / observed.calls);
  }
  return seedValue ?? 0;
}

function runtimeScore(entry, contract, observed) {
  const priorities = contract.priorities || {};
  const footprint = entry.footprint || {};
  let score = 0;

  for (const [metric, weight] of Object.entries(priorities)) {
    score += effectiveMetric(footprint[metric], observed, metric) * weight;
  }

  if (contract.constraints?.require_local && entry.kind !== 'local') {
    score -= 100;
  }

  if (contract.constraints?.allow_cloud === false && entry.kind === 'cloud') {
    score -= 100;
  }

  if (
    contract.constraints?.max_latency_ms &&
    observed.avg_latency_ms &&
    observed.avg_latency_ms > contract.constraints.max_latency_ms
  ) {
    score -= 5;
  }

  return score;
}

export function brokerDecision(session, registry) {
  const targets = session.contract.targets?.length
    ? session.contract.targets
    : registry.runtimes.map(runtime => runtime.id);

  const ranked = registry.runtimes
    .filter(runtime => targets.includes(runtime.id))
    .map(runtime => ({
      runtime: runtime.id,
      score: runtimeScore(runtime, session.contract, session.footprints[runtime.id]?.observed || {}),
      kind: runtime.kind,
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    throw new Error('no runtimes available for current balance contract');
  }

  const selected = session.contract.mode === 'parallel' ? ranked.slice(0, 2) : [ranked[0]];
  return {
    mode: session.contract.mode,
    fallback: session.contract.fallback,
    ranked,
    selected,
  };
}

function updateObservation(session, runtimeId, result) {
  const observed = session.footprints[runtimeId].observed;
  observed.calls += 1;
  observed.last_status = result.ok ? 'ok' : 'error';
  if (!result.ok) {
    observed.failures += 1;
  }

  if (result.latencyMs) {
    observed.avg_latency_ms = observed.avg_latency_ms === null
      ? result.latencyMs
      : Math.round((observed.avg_latency_ms * (observed.calls - 1) + result.latencyMs) / observed.calls);
  }
}

function buildSystemMessages(session) {
  return [
    {
      role: 'system',
      content: [
        'You are operating inside a Trasgo runtime session.',
        'Use the attached Trasgo skills and runtime contract.',
        'When receiving §1 or §P packets, stay in codec mode unless explicitly asked otherwise.',
      ].join(' '),
    },
    {
      role: 'system',
      content: `Session contract: ${JSON.stringify(session.contract)}`,
    },
  ];
}

function buildPrompt(session, registry, baseDir, input) {
  const mountedMessages = session.boot_messages?.length
    ? session.boot_messages
    : [
        ...buildMcpMessages(session, registry, baseDir),
        ...buildSkillMessages(session, registry, baseDir),
      ];
  const messages = [
    ...buildSystemMessages(session),
    ...mountedMessages,
    ...session.messages,
    {
      role: 'user',
      content: input,
    },
  ];

  return messages;
}

async function invokeRuntime(session, registry, baseDir, runtimeId, input) {
  const runtimeEntry = registry.runtimes.find(entry => entry.id === runtimeId);
  if (!runtimeEntry) {
    throw new Error(`unknown runtime: ${runtimeId}`);
  }

  const messages = buildPrompt(session, registry, baseDir, input);
  const response = await chatCompletion(runtimeEntry, messages);

  return {
    runtime: runtimeId,
    model: response.model,
    latencyMs: response.latencyMs,
    content: response.content,
    raw: response.raw,
  };
}

export async function executeInput(baseDir, registry, session, input) {
  const balancePacket = parseBalancePacket(input);
  if (balancePacket) {
    applyBalancePacket(session, balancePacket);
    saveSession(baseDir, session);
    return {
      kind: 'balance',
      session,
      message: 'balance contract updated',
    };
  }

  const decision = brokerDecision(session, registry);
  const attempts = [];

  for (const choice of decision.selected) {
    try {
      const result = await invokeRuntime(session, registry, baseDir, choice.runtime, input);
      updateObservation(session, choice.runtime, { ok: true, latencyMs: result.latencyMs });
      attempts.push(result);
    } catch (error) {
      updateObservation(session, choice.runtime, { ok: false });
      attempts.push({
        runtime: choice.runtime,
        error: error.message,
      });
    }
  }

  let primary = attempts.find(entry => !entry.error) || null;

  if (!primary && decision.fallback === 'handoff') {
    for (const choice of decision.ranked.slice(decision.selected.length)) {
      try {
        const result = await invokeRuntime(session, registry, baseDir, choice.runtime, input);
        updateObservation(session, choice.runtime, { ok: true, latencyMs: result.latencyMs });
        attempts.push(result);
        primary = result;
        break;
      } catch (error) {
        updateObservation(session, choice.runtime, { ok: false });
        attempts.push({
          runtime: choice.runtime,
          error: error.message,
        });
      }
    }
  }

  if (!primary) {
    saveSession(baseDir, session);
    throw new Error(attempts.map(entry => `${entry.runtime}: ${entry.error || 'unknown error'}`).join(' | '));
  }

  session.active_runtime = primary.runtime;
  session.messages.push({ role: 'user', content: input });
  session.messages.push({ role: 'assistant', content: primary.content });
  session.history.push({
    at: new Date().toISOString(),
    input,
    decision,
    attempts: attempts.map(entry => ({
      runtime: entry.runtime,
      latencyMs: entry.latencyMs || null,
      error: entry.error || null,
      model: entry.model || null,
    })),
    selected_runtime: primary.runtime,
  });
  saveSession(baseDir, session);

  return {
    kind: 'response',
    session,
    decision,
    attempts,
    response: primary,
    content: primary.content,
  };
}

export function sessionState(session) {
  return {
    id: session.id,
    title: session.title,
    active_runtime: session.active_runtime,
    skills: session.skills,
    mcp_mounts: session.mcp_mounts,
    contract: session.contract,
    history_size: session.history.length,
    workflow: session.workflow,
    boot: session.boot,
  };
}

export function setBalanceValue(session, field, value) {
  if (field === 'mode') {
    session.contract.mode = value;
    return;
  }

  if (field === 'fallback') {
    session.contract.fallback = value;
    return;
  }

  if (field === 'targets') {
    session.contract.targets = value.split(',').map(item => item.trim()).filter(Boolean);
    return;
  }

  if (field === 'require_local') {
    session.contract.constraints.require_local = value === 'true';
    return;
  }

  if (field === 'allow_cloud') {
    session.contract.constraints.allow_cloud = value !== 'false';
    return;
  }

  if (field.startsWith('priority.')) {
    const metric = field.slice('priority.'.length);
    session.contract.priorities[metric] = Number(value);
    return;
  }

  throw new Error(`unknown balance field: ${field}`);
}

export {
  attachSkill,
  detachSkill,
  mountMcp,
  unmountMcp,
};
