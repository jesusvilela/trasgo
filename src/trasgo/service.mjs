import readline from 'node:readline';
import {
  bootSession,
  createSession,
  executeInput,
  initSessionContract,
  listSessions,
  loadSession,
  packSession,
  sessionState,
} from './runtime.mjs';

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
