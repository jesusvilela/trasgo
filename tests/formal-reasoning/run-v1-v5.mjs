import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runFormalTest(testId, executeInputFn, context, session) {
  const inputPath = path.join(__dirname, `${testId}-input.json`);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Test input not found: ${testId}`);
  }

  const testData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`\nRunning Formal Test: ${testData.name} (${testId})`);

  let prompt = '';
  if (testId === 'v2') {
    prompt = `Reduce T = ${testData.term} to normal form. Emit §1 deltas.`;
  } else if (testId === 'v1') {
    prompt = `Reduce the following terms to normal form: ${testData.terms.join(', ')}. Emit §1 deltas.`;
  } else {
    prompt = `Execute formal verification for ${testData.name}. Data: ${JSON.stringify(testData)}`;
  }

  const result = await executeInputFn(context.runtimeHome, context.registry, session, prompt);
  
  // Basic result extraction for reporting
  // In a real scenario, we'd parse the §1 packets more deeply
  const passed = result.content && !result.content.includes('error'); 

  return {
    testId,
    name: testData.name,
    passed,
    content: result.content
  };
}

export function saveResults(results) {
  const resultsPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
}
