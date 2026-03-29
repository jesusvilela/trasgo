import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REGISTRY_PATH = path.join('src', 'trasgo', 'registry.json');

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
      stdio: options.stdio || 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 0));
  });
}

export async function runTool(registry, toolId, extraArgs, runtime) {
  const tool = getEntry(registry, 'tools', toolId);
  if (!tool) {
    throw new Error(`unknown tool: ${toolId}`);
  }

  const command = tool.runner === 'python'
    ? (runtime.pythonBin || 'python')
    : (runtime.nodeBin || process.execPath);

  const entry = path.join(runtime.baseDir, tool.entry);
  const args = [...(tool.args || []), ...extraArgs];
  const processArgs = tool.runner === 'python' ? [entry, ...args] : [entry, ...args];

  return spawnProcess(command, processArgs, { cwd: runtime.baseDir });
}

export async function runMachine(registry, machineId, extraArgs, runtime) {
  const machine = getEntry(registry, 'machines', machineId);
  if (!machine) {
    throw new Error(`unknown machine: ${machineId}`);
  }

  let exitCode = 0;
  for (const step of machine.steps || []) {
    const args = step.passthrough ? extraArgs : [...(step.args || [])];
    exitCode = await runTool(registry, step.tool, args, runtime);
    if (exitCode !== 0) return exitCode;
  }

  return exitCode;
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
    exists: fs.existsSync(path.join(runtime.baseDir, tool.entry)),
  }));
  const skills = getCollection(registry, 'skills').map(skill => ({
    id: skill.id,
    exists: fs.existsSync(path.join(runtime.baseDir, skill.entry)),
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
