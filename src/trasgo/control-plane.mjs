import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const REGISTRY_PATH = path.join('src', 'trasgo', 'registry.json');
const RUNS_DIR = path.join('.trasgo-runtime', 'runs');


function runtimeRoots(baseDir) {
  if (baseDir && typeof baseDir === 'object') {
    const assetDir = baseDir.assetDir || baseDir.baseDir || baseDir.stateDir || process.cwd();
    const stateDir = baseDir.stateDir || baseDir.baseDir || assetDir;
    return { assetDir, stateDir };
  }
  return { assetDir: baseDir, stateDir: baseDir };
}

export function loadRegistry(baseDir) {
  const fullPath = path.join(baseDir, REGISTRY_PATH);
  return {
    path: fullPath,
    ...JSON.parse(fs.readFileSync(fullPath, 'utf-8')),
  };
}

export function resolveBaseUrl(runtime) {
  if (!runtime) return null;
  if (runtime.base_url_env && process.env[runtime.base_url_env]) {
    return process.env[runtime.base_url_env];
  }
  return runtime.base_url || null;
}

export function getCollection(registry, name) {
  return registry[name] || [];
}

export function getEntry(registry, name, id) {
  return getCollection(registry, name).find(entry => entry.id === id) || null;
}

function fit(value, width) {
  const text = String(value ?? '');
  if (text.length <= width) return text.padEnd(width);
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function printTable(title, columns, rows, print) {
  print(title);
  const header = columns.map(col => fit(col.label, col.width)).join('  ');
  print(`  ${header}`);
  print(`  ${columns.map(col => '-'.repeat(col.width)).join('  ')}`);

  for (const row of rows) {
    const line = columns.map(col => fit(row[col.key], col.width)).join('  ');
    print(`  ${line}`);
  }

  print('');
}

export function summarizeRegistry(registry) {
  return {
    runtimes: getCollection(registry, 'runtimes').length,
    tools: getCollection(registry, 'tools').length,
    machines: getCollection(registry, 'machines').length,
    mcp: getCollection(registry, 'mcp').length,
    skills: getCollection(registry, 'skills').length,
  };
}

export function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : (options.stdio || 'inherit'),
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    if (options.capture) {
      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('exit', code => resolve({
      code: code ?? 0,
      stdout,
      stderr,
    }));
  });
}

export async function runTool(registry, toolId, extraArgs, runtime) {
  const result = await runToolDetailed(registry, toolId, extraArgs, runtime);
  return result.exit_code;
}

export async function runToolDetailed(registry, toolId, extraArgs, runtime, options = {}) {
  const tool = getEntry(registry, 'tools', toolId);
  if (!tool) {
    throw new Error(`unknown tool: ${toolId}`);
  }

  const command = tool.runner === 'python'
    ? (runtime.pythonBin || 'python')
    : (runtime.nodeBin || process.execPath);

  const entry = path.join(runtime.assetDir || runtime.baseDir, tool.entry);
  const args = [...(tool.args || []), ...extraArgs];
  const processArgs = tool.runner === 'python' ? [entry, ...args] : [entry, ...args];
  const startedAt = new Date().toISOString();
  const result = await spawnProcess(command, processArgs, {
    cwd: runtime.assetDir || runtime.baseDir,
    capture: options.capture,
  });

  return {
    tool: tool.id,
    runner: tool.runner,
    entry: tool.entry,
    args,
    command,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function runMachine(registry, machineId, extraArgs, runtime) {
  const result = await runMachineDetailed(registry, machineId, extraArgs, runtime);
  return result.exit_code;
}

function ensureRunsDir(baseDir) {
  fs.mkdirSync(path.join(runtimeRoots(baseDir).stateDir, RUNS_DIR), { recursive: true });
}

function writeMachineTrace(baseDir, trace) {
  ensureRunsDir(baseDir);
  const tracePath = path.join(runtimeRoots(baseDir).stateDir, RUNS_DIR, `${trace.run_id}.json`);
  fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2));
  return tracePath;
}

export function listRunTraces(baseDir) {
  const dir = path.join(runtimeRoots(baseDir).stateDir, RUNS_DIR);
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const trace = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
      return {
        run_id: trace.run_id,
        machine: trace.machine.id,
        exit_code: trace.exit_code,
        started_at: trace.started_at,
        finished_at: trace.finished_at,
        trace_path: path.join(dir, name),
      };
    })
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
}

export function loadRunTrace(baseDir, runId) {
  const tracePath = path.join(runtimeRoots(baseDir).stateDir, RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(tracePath)) {
    throw new Error(`run trace not found: ${runId}`);
  }
  return JSON.parse(fs.readFileSync(tracePath, 'utf-8'));
}

export async function runMachineDetailed(registry, machineId, extraArgs, runtime, options = {}) {
  const machine = getEntry(registry, 'machines', machineId);
  if (!machine) {
    throw new Error(`unknown machine: ${machineId}`);
  }

  const trace = {
    kind: 'trasgo-machine-run',
    run_id: randomUUID(),
    started_at: new Date().toISOString(),
    machine: {
      id: machine.id,
      type: machine.type,
      description: machine.description,
    },
    passthrough_args: extraArgs,
    steps: [],
  };

  let exitCode = 0;
  for (const step of machine.steps || []) {
    const args = step.passthrough ? extraArgs : [...(step.args || [])];
    const stepResult = await runToolDetailed(registry, step.tool, args, runtime, options);
    trace.steps.push(stepResult);
    exitCode = stepResult.exit_code;
    if (exitCode !== 0) {
      trace.finished_at = new Date().toISOString();
      trace.exit_code = exitCode;
      trace.trace_path = writeMachineTrace(runtime.stateDir || runtime.baseDir, trace);
      return trace;
    }
  }

  trace.finished_at = new Date().toISOString();
  trace.exit_code = exitCode;
  trace.trace_path = writeMachineTrace(runtime.stateDir || runtime.baseDir, trace);
  return trace;
}

export async function commandVersion(command, args = ['--version']) {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let output = '';

    child.stdout.on('data', chunk => {
      output += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      output += chunk.toString();
    });

    child.on('error', () => resolve(null));
    child.on('exit', code => {
      resolve(code === 0 ? output.trim() : null);
    });
  });
}

export async function probeRuntime(runtime, timeoutMs = 1500) {
  const baseUrl = resolveBaseUrl(runtime);
  if (!baseUrl || !runtime.probe_path) {
    return { ok: false, detail: 'no probe configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${runtime.probe_path}`, {
      method: 'GET',
      signal: controller.signal,
      headers: runtime.api_key_env && process.env[runtime.api_key_env]
        ? { Authorization: `Bearer ${process.env[runtime.api_key_env]}` }
        : undefined,
    });

    clearTimeout(timer);
    return {
      ok: response.ok,
      detail: response.ok ? `reachable (${response.status})` : `http ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, detail: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}

export async function buildDoctorReport(registry, runtime, options = {}) {
  const nodeVersion = await commandVersion(runtime.nodeBin, ['--version']);
  const pythonVersion = await commandVersion(runtime.pythonBin, ['--version']);
  const tools = getCollection(registry, 'tools').map(tool => ({
    id: tool.id,
    exists: fs.existsSync(path.join(runtime.assetDir || runtime.baseDir, tool.entry)),
  }));
  const skills = getCollection(registry, 'skills').map(skill => ({
    id: skill.id,
    exists: fs.existsSync(path.join(runtime.assetDir || runtime.baseDir, skill.entry)),
  }));

  const probes = [];
  if (options.probe) {
    for (const entry of getCollection(registry, 'runtimes')) {
      probes.push({
        id: entry.id,
        ...(await probeRuntime(entry)),
      });
    }
  }

  return {
    nodeVersion,
    pythonVersion,
    tools,
    skills,
    env: [
      'OPENAI_API_KEY',
      'DEEPSEEK_API_KEY',
      'GLM_API_KEY',
      'TRASGO_LMSTUDIO_URL',
      'TRASGO_PYTHON',
    ].map(key => ({ key, set: Boolean(process.env[key]) })),
    probes,
  };
}
