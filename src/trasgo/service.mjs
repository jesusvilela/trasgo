import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import http from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import {
  bootSession,
  brokerDecision,
  createSession,
  executeInput,
  initSessionContract,
  listSessions,
  loadSession,
  packSession,
  sessionState,
} from './runtime.mjs';
import {
  buildDoctorReport,
  getCollection,
  listRunTraces,
  loadRunTrace,
  resolveBaseUrl,
  runMachineDetailed,
} from './control-plane.mjs';
import { getDemoWorkflow, listDemoWorkflows, runDemoWorkflow } from './demo-workflows.mjs';
import { runOptimizeReport, runTokenReport } from './token-science.mjs';


function roots(baseDir) {
  if (baseDir && typeof baseDir === 'object') {
    const assetDir = baseDir.assetDir || baseDir.baseDir || baseDir.stateDir || process.cwd();
    const stateDir = baseDir.stateDir || baseDir.baseDir || assetDir;
    return { assetDir, stateDir };
  }
  return { assetDir: baseDir, stateDir: baseDir };
}

const packageVersion = (() => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(moduleDir, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.version;
})();

async function respond(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export async function serveStdio(baseDir, registry) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let activeSession = null;

  await respond({ ok: true, type: 'ready' });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      await respond({ ok: false, error: 'invalid-json' });
      continue;
    }

    try {
      if (payload.cmd === 'status') {
        await respond({
          ok: true,
          type: 'status',
          sessions: listSessions(baseDir),
          active_session: activeSession?.id || null,
        });
        continue;
      }

      if (payload.cmd === 'session.new') {
        activeSession = createSession(baseDir, registry, payload.options || {});
        await respond({ ok: true, type: 'session', session: sessionState(activeSession) });
        continue;
      }

      if (payload.cmd === 'session.init') {
        activeSession = initSessionContract(baseDir, registry, payload.options || {});
        await respond({ ok: true, type: 'session.init', session: sessionState(activeSession) });
        continue;
      }

      if (payload.cmd === 'session.load') {
        activeSession = loadSession(baseDir, payload.id, registry);
        await respond({ ok: true, type: 'session', session: sessionState(activeSession) });
        continue;
      }

      if (payload.cmd === 'session.send') {
        if (!activeSession) {
          activeSession = createSession(baseDir, registry, {});
        }
        const result = await executeInput(baseDir, registry, activeSession, payload.input || '');
        activeSession = result.session;
        await respond({ ok: true, type: result.kind, result });
        continue;
      }

      if (payload.cmd === 'session.pack') {
        if (!activeSession) {
          activeSession = initSessionContract(baseDir, registry, payload.options || {});
        }
        const result = packSession(baseDir, registry, activeSession, payload.options || {});
        activeSession = result.session;
        await respond({
          ok: true,
          type: 'session.pack',
          session: sessionState(activeSession),
          pack_path: result.outputPath,
          bundle: result.bundle,
        });
        continue;
      }

      if (payload.cmd === 'session.boot') {
        const result = bootSession(baseDir, registry, {
          ...(payload.options || {}),
          sessionId: payload.options?.sessionId || activeSession?.id || null,
        });
        activeSession = result.session;
        await respond({
          ok: true,
          type: 'session.boot',
          session: sessionState(activeSession),
          decision: result.decision,
          pack_path: result.packPath,
        });
        continue;
      }

      await respond({ ok: false, error: 'unknown-command' });
    } catch (error) {
      await respond({ ok: false, error: error.message });
    }
  }
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  if (!body.trim()) {
    return {};
  }
  return JSON.parse(body);
}

function registryStatus(baseDir, registry, activeSession) {
  return {
    ok: true,
    kind: 'trasgo-status',
    runtime: activeSession?.active_runtime || null,
    note: 'Trasgo local bridge is reachable.',
    registry: {
      path: registry.path,
      state_dir: roots(baseDir).stateDir,
      runtimes: getCollection(registry, 'runtimes').length,
      tools: getCollection(registry, 'tools').length,
      machines: getCollection(registry, 'machines').length,
      mcp: getCollection(registry, 'mcp').length,
      skills: getCollection(registry, 'skills').length,
    },
    sessions: listSessions(baseDir),
    active_session: activeSession ? sessionState(activeSession) : null,
  };
}

function nativeStatus(baseDir, registry) {
  return {
    ok: true,
    kind: 'trasgo-native-status',
    repo_root: baseDir,
    node_fallback: true,
    cargo_manifest: `${baseDir}\\rust\\trasgo\\Cargo.toml`,
    runtimes: registry.runtimes.map(entry => ({
      id: entry.id,
      kind: entry.kind,
      base_url: resolveBaseUrl(entry),
    })),
  };
}

function explainBalance(session) {
  return {
    kind: 'trasgo-explain-balance',
    contract: session.contract,
    note: 'Balance contract governs target runtimes, priorities, fallback mode, and locality/privacy constraints.',
  };
}

function explainRoute(session, registry) {
  const decision = brokerDecision(session, registry);
  return {
    kind: 'trasgo-explain-route',
    contract: session.contract,
    decision,
    note: 'Route selection is scored from seeded capability footprints plus observed failures and latency.',
  };
}

function adviseCodec(body) {
  const report = runTokenReport(body);
  const codecMedian = report.summary.codec_tokens.median;
  const naturalMedian = report.summary.natural_tokens?.median ?? null;
  const delta = naturalMedian === null ? null : Math.round(codecMedian - naturalMedian);
  let verdict = 'codec-only';
  let recommendation = 'Natural baseline missing; only codec cost was measured.';

  if (naturalMedian !== null) {
    if (codecMedian < naturalMedian) {
      verdict = 'use-codec';
      recommendation = 'Codec is cheaper than the natural baseline across the median tokenizer view.';
    } else if (codecMedian > naturalMedian) {
      verdict = 'prefer-natural';
      recommendation = 'Natural language is cheaper for this packet; codec overhead likely outweighs structural gains at this size.';
    } else {
      verdict = 'neutral';
      recommendation = 'Codec and natural language are roughly tied at the median; use codec only if downstream structure is valuable.';
    }
  }

  return {
    kind: 'trasgo-advise',
    verdict,
    recommendation,
    break_even_delta_tokens: delta,
    report,
  };
}

export async function serveHttp(baseDir, registry, runtime, options = {}) {
  let activeSession = null;
  const port = Number.parseInt(String(options.port || process.env.TRASGO_HTTP_PORT || '8787'), 10);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const pathName = url.pathname;

      if (req.method === 'GET' && pathName === '/health') {
        return jsonResponse(res, 200, { ok: true, kind: 'trasgo-health', status: 'ready' });
      }

      if (req.method === 'GET' && pathName === '/version') {
        return jsonResponse(res, 200, { ok: true, kind: 'trasgo-version', version: packageVersion });
      }

      if (req.method === 'GET' && pathName === '/status') {
        return jsonResponse(res, 200, registryStatus(baseDir, registry, activeSession));
      }

      if (req.method === 'GET' && pathName === '/native-status') {
        return jsonResponse(res, 200, nativeStatus(baseDir, registry));
      }

      if (req.method === 'GET' && pathName === '/doctor') {
        const report = await buildDoctorReport(registry, runtime, {
          probe: url.searchParams.get('probe') === '1',
        });
        return jsonResponse(res, 200, { ok: true, kind: 'trasgo-doctor', ...report });
      }

      if (req.method === 'GET' && pathName === '/demos') {
        return jsonResponse(res, 200, { ok: true, demos: listDemoWorkflows() });
      }

      if (req.method === 'GET' && pathName.startsWith('/demos/')) {
        const id = decodeURIComponent(pathName.slice('/demos/'.length));
        const demo = getDemoWorkflow(id);
        if (!demo) {
          return jsonResponse(res, 404, { ok: false, error: 'demo-not-found' });
        }
        return jsonResponse(res, 200, { ok: true, demo });
      }

      if (req.method === 'POST' && pathName.startsWith('/demos/')) {
        const id = decodeURIComponent(pathName.slice('/demos/'.length));
        const body = await readJsonBody(req);
        const demo = runDemoWorkflow(id, body || {});
        return jsonResponse(res, 200, { ok: true, demo });
      }

      if (req.method === 'POST' && pathName === '/demo/run') {
        const body = await readJsonBody(req);
        const demo = runDemoWorkflow(body.id, body || {});
        return jsonResponse(res, 200, { ok: true, demo });
      }

      if (req.method === 'POST' && pathName === '/tokens') {
        const body = await readJsonBody(req);
        return jsonResponse(res, 200, { ok: true, report: runTokenReport(body) });
      }

      if (req.method === 'POST' && pathName === '/optimize') {
        const body = await readJsonBody(req);
        return jsonResponse(res, 200, { ok: true, report: runOptimizeReport(body) });
      }

      if (req.method === 'POST' && pathName === '/advise') {
        const body = await readJsonBody(req);
        return jsonResponse(res, 200, { ok: true, ...adviseCodec(body) });
      }

      if (req.method === 'GET' && pathName === '/machines') {
        return jsonResponse(res, 200, { ok: true, machines: getCollection(registry, 'machines') });
      }

      if (req.method === 'POST' && pathName.startsWith('/machines/')) {
        const remainder = pathName.slice('/machines/'.length);
        if (!remainder.endsWith('/run')) {
          return jsonResponse(res, 404, { ok: false, error: 'unknown-endpoint' });
        }
        const id = decodeURIComponent(remainder.slice(0, -4));
        const body = await readJsonBody(req);
        const trace = await runMachineDetailed(registry, id, body.args || [], runtime, { capture: true });
        return jsonResponse(res, trace.exit_code === 0 ? 200 : 500, { ok: trace.exit_code === 0, trace });
      }

      if (req.method === 'POST' && pathName === '/machine/run') {
        const body = await readJsonBody(req);
        const trace = await runMachineDetailed(registry, body.id, body.args || [], runtime, { capture: true });
        return jsonResponse(res, trace.exit_code === 0 ? 200 : 500, { ok: trace.exit_code === 0, trace });
      }

      if (req.method === 'GET' && pathName === '/runs') {
        return jsonResponse(res, 200, { ok: true, runs: listRunTraces(baseDir) });
      }

      if (req.method === 'GET' && pathName.startsWith('/runs/')) {
        const runId = decodeURIComponent(pathName.slice('/runs/'.length));
        const trace = loadRunTrace(baseDir, runId);
        if (!trace) {
          return jsonResponse(res, 404, { ok: false, error: 'run-not-found' });
        }
        return jsonResponse(res, 200, { ok: true, trace });
      }

      if (req.method === 'POST' && pathName === '/session/new') {
        const body = await readJsonBody(req);
        activeSession = createSession(baseDir, registry, body || {});
        return jsonResponse(res, 200, { ok: true, session: sessionState(activeSession) });
      }

      if (req.method === 'POST' && pathName === '/session/init') {
        const body = await readJsonBody(req);
        activeSession = initSessionContract(baseDir, registry, body || {});
        return jsonResponse(res, 200, { ok: true, session: sessionState(activeSession) });
      }

      if (req.method === 'POST' && pathName === '/session/boot') {
        const body = await readJsonBody(req);
        const result = bootSession(baseDir, registry, {
          ...(body || {}),
          sessionId: body?.sessionId || activeSession?.id || null,
        });
        activeSession = result.session;
        return jsonResponse(res, 200, {
          ok: true,
          session: sessionState(activeSession),
          decision: result.decision,
          pack_path: result.packPath,
        });
      }

      if (req.method === 'POST' && pathName === '/session/send') {
        const body = await readJsonBody(req);
        if (!activeSession) {
          activeSession = createSession(baseDir, registry, {});
        }
        const result = await executeInput(baseDir, registry, activeSession, body.input || '');
        activeSession = result.session;
        return jsonResponse(res, 200, { ok: true, result });
      }

      if (req.method === 'GET' && pathName === '/session/explain/balance') {
        if (!activeSession) {
          activeSession = initSessionContract(baseDir, registry, {});
        }
        return jsonResponse(res, 200, { ok: true, ...explainBalance(activeSession) });
      }

      if (req.method === 'GET' && pathName === '/session/explain/route') {
        if (!activeSession) {
          activeSession = initSessionContract(baseDir, registry, {});
        }
        return jsonResponse(res, 200, { ok: true, ...explainRoute(activeSession, registry) });
      }

      return jsonResponse(res, 404, { ok: false, error: 'unknown-endpoint' });
    } catch (error) {
      return jsonResponse(res, 500, { ok: false, error: error.message });
    }
  });

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      process.stdout.write(`${JSON.stringify({ ok: true, type: 'http-ready', port })}\n`);
      resolve(server);
    });
  });
}
