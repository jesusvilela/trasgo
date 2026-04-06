import fs from 'node:fs';
import path from 'node:path';

function roots(baseDir) {
  if (baseDir && typeof baseDir === 'object') {
    const assetDir = baseDir.assetDir || baseDir.baseDir || baseDir.stateDir || process.cwd();
    const stateDir = baseDir.stateDir || baseDir.baseDir || assetDir;
    return { assetDir, stateDir };
  }
  return { assetDir: baseDir, stateDir: baseDir };
}

function latestBenchSummaries(baseDir) {
  const testsDir = path.join(roots(baseDir).assetDir, 'tests');
  if (!fs.existsSync(testsDir)) {
    return [];
  }

  return fs.readdirSync(testsDir)
    .filter(name => name.startsWith('bench_') && name.endsWith('.json') && !name.includes('structured_results'))
    .map(name => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(testsDir, name), 'utf-8'));
        return {
          model: data.model,
          pct: data.pct,
          classification: data.classification,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.pct || 0) - (a.pct || 0))
    .slice(0, 5);
}

function codecDocCatalog(registry) {
  return registry.skills.map(skill => `${skill.id}: ${skill.entry}`).join('; ');
}

function runtimeRegistrySummary(registry) {
  return registry.runtimes.map(runtime => {
    const caps = (runtime.capabilities || []).join(',');
    return `${runtime.id}[${runtime.kind}] caps=${caps}`;
  }).join('; ');
}

export function mountMcp(session, mcpId) {
  if (!session.mcp_mounts.includes(mcpId)) {
    session.mcp_mounts.push(mcpId);
  }
}

export function unmountMcp(session, mcpId) {
  session.mcp_mounts = session.mcp_mounts.filter(id => id !== mcpId);
}

export function buildMcpMessages(session, registry, baseDir) {
  const blocks = [];

  for (const mountId of session.mcp_mounts) {
    if (mountId === 'bench-artifacts') {
      const summaries = latestBenchSummaries(baseDir);
      const text = summaries.length
        ? summaries.map(entry => `${entry.model} ${entry.pct}% ${entry.classification}`).join(' | ')
        : 'no bench artifacts available';
      blocks.push(`[bench-artifacts] ${text}`);
      continue;
    }

    if (mountId === 'codec-docs') {
      blocks.push(`[codec-docs] ${codecDocCatalog(registry)}`);
      continue;
    }

    if (mountId === 'runtime-registry') {
      blocks.push(`[runtime-registry] ${runtimeRegistrySummary(registry)}`);
    }
  }

  if (blocks.length === 0) {
    return [];
  }

  return [{
    role: 'system',
    content: `Mounted MCP context:\n${blocks.join('\n')}`,
  }];
}
