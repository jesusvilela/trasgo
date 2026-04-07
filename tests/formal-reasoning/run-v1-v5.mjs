import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePacketStream } from '../../src/harness/err-watcher.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function listFormalTestIds() {
  if (!fs.existsSync(__dirname)) return [];
  return fs.readdirSync(__dirname)
    .filter(name => /-input\.json$/u.test(name))
    .map(name => name.replace(/-input\.json$/u, ''))
    .sort();
}

export function loadFormalTestData(testId) {
  const inputPath = path.join(__dirname, `${testId}-input.json`);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Test input not found: ${testId}`);
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
}

export function buildFormalTestPrompt(testId, testData) {
  const family = (testData?.test || testId || '').toLowerCase();
  let basePrompt = '';
  if (family === 'v1' && Array.isArray(testData?.terms)) {
    basePrompt = `Reduce the following terms to normal form: ${testData.terms.join(', ')}. Emit §1 deltas.`;
  } else if (family === 'v2' && testData?.term) {
    basePrompt = `Reduce T = ${testData.term} to normal form. Emit §1 deltas.`;
  } else {
    basePrompt = `Execute formal verification for ${testData?.name || testId}. Data: ${JSON.stringify(testData)}`;
  }
  return `${basePrompt} |out:codec`;
}

function evalV2(content) {
  const { lastPacket, cert } = parsePacketStream(content);
  if (!lastPacket) return false;
  const form = (lastPacket.S?.['result.form'] || lastPacket.S?.['T.form'] || '').trim();
  const isCapture = /λy\.y/.test(form) || form === 'λy.y';
  const isCorrect = /λ[^y]\.y/.test(form) || form.includes('λz.y');
  return isCorrect && !isCapture;
}

function evalV1(content) {
  const { cert, hasError } = parsePacketStream(content);
  return cert !== null && cert >= 0.7 && !hasError;
}

function evalV5(content) {
  const { lastPacket } = parsePacketStream(content);
  if (!lastPacket) return false;
  const cert = lastPacket.μ?.cert ?? 0;
  const form = lastPacket.S?.['result.form'] || '';
  return cert >= 0.8 && form.length > 0;
}

function evalDefault(content) {
  const { cert, hasError } = parsePacketStream(content);
  return cert !== null && cert >= 0.5 && !hasError;
}

export async function runFormalTest(testId, executeInputFn, context, session) {
  const testData = loadFormalTestData(testId);
  console.log(`\nRunning Formal Test: ${testData.name} (${testId})`);
  const prompt = buildFormalTestPrompt(testId, testData);
  const result = await executeInputFn(context.runtimeHome, context.registry, session, prompt);
  
  let passed = false;
  const id = testData.test;
  if (id === 'v2') passed = evalV2(result.content || '');
  else if (id === 'v1') passed = evalV1(result.content || '');
  else if (id === 'v5') passed = evalV5(result.content || '');
  else passed = evalDefault(result.content || '');

  return {
    testId,
    name: testData.name,
    passed,
    cert: parsePacketStream(result.content || '').cert,
    content: result.content
  };
}

export function saveResults(results) {
  const resultsPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  return resultsPath;
}
