import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTokenReport } from '../src/trasgo/token-science.mjs';
import { executeInput, createSession } from '../src/trasgo/runtime.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(moduleDir, '..');

const VERBOSE_CONTEXT = `
Trasgo §1 is a context compression protocol that factors verbose natural language into a compact, multidimensional JSON representation.
The core axes are:
- Entities (E): Who/what nodes.
- State (S): Current attribute values.
- Relations (R): Causal and structural edges.
- Deltas (Δ): State transitions.
- Meta (μ): Uncertainty (cert), urgency, and scope.

Recent project critique highlights:
1. The "mirage" risk: heavy CLI infrastructure (Rust/Node) surrounding a 3KB protocol might look like bloat if not grounded in real utility.
2. Adoption ceiling: users need to see what they can *do* in 10 minutes, not just self-referential demos.
3. Quality vs. Speed: bugs in the 'verify' parser were hurting first impressions at the moment the repo became public.
4. Pivot: shifting from simulated demos to "Formal Code Reasoning" using oracles (compilers/test-runners) to ground 'cert' values.

Current Status:
- Phase 7 (Parser Fix) completed with 100% PASS rate on formal benchmarks.
- Harness now intercepts ERR blocks and executes autonomous Correction Turns (CT).
- Roadmap moving toward "Code as §1" where source files are the formal substrate.
`;

async function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(repoDir, 'src', 'trasgo', 'registry.json'), 'utf-8'));
  const runtimeHome = { stateDir: repoDir, assetDir: repoDir };
  
  // Create a temporary session
  const session = createSession(repoDir, registry, { title: 'omni-run' });
  
  console.log('\n--- Trasgo Scientific Omni Runner ---');
  console.log('Targeting SOTA models for dimensional mapping...\n');

  // Use runtimes that are likely to have keys or be available
  const targets = ['openai']; 
  if (process.env.DEEPSEEK_API_KEY) targets.push('deepseek');

  const results = [];

  for (const runtimeId of targets) {
    process.stdout.write(`[Run] Evaluating ${runtimeId}... `);
    session.contract.targets = [runtimeId];
    session.contract.mode = 'single';

    const prompt = `Encode the following context into a §1 JSON packet. Focus on high informational density and axis fidelity. Context: ${VERBOSE_CONTEXT} |out:codec`;
    
    try {
      const result = await executeInput(repoDir, registry, session, prompt);
      const codec = result.content;
      
      const tokenReport = runTokenReport({ codec, natural: VERBOSE_CONTEXT });
      
      results.push({
        runtime: runtimeId,
        codec,
        tokens: tokenReport.summary
      });
      
      process.stdout.write('OK\n');
    } catch (err) {
      process.stdout.write(`FAIL: ${err.message}\n`);
    }
  }

  if (results.length === 0) {
    console.error('\nNo results collected. Ensure API keys are set.');
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('TRASGO SCIENTIFIC VISIBILITY REPORT');
  console.log('='.repeat(70));
  
  const tableData = results.map(r => ({
    Runtime: r.runtime,
    'NL Tokens (Med)': r.tokens.natural_tokens.median,
    '§1 Tokens (Med)': r.tokens.codec_tokens.median,
    'Compression Ratio': r.tokens.compression_ratio.median.toFixed(2) + 'x',
    'Best family': r.tokens.best_codec_family
  }));

  console.table(tableData);
  
  console.log('\nInformational Dimensions (Sample §1 from primary model):');
  console.log('-'.repeat(70));
  console.log(results[0].codec);
  console.log('-'.repeat(70));
  
  const p = JSON.parse(results[0].codec.match(/\{[\s\S]*\}/)[0]);
  console.log(`\nAxis Density (E: ${Object.keys(p.E || {}).length}, S: ${Object.keys(p.S || {}).length}, R: ${(p.R || []).length}, Δ: ${(p.Δ || []).length})`);
}

main().catch(console.error);
