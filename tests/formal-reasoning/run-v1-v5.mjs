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

function checkV2(content, testData) {
  const { lastPacket } = parsePacketStream(content);
  if (!lastPacket) return false;
  
  // Collect all forms mentioned in S and Δ
  const forms = [];
  if (lastPacket.S) {
    if (lastPacket.S['result.form']) forms.push(String(lastPacket.S['result.form']));
    if (lastPacket.S['T.form']) forms.push(String(lastPacket.S['T.form']));
  }
  if (Array.isArray(lastPacket.Δ)) {
    lastPacket.Δ.forEach(d => {
      if (d.includes('→')) {
        const parts = d.split('→');
        forms.push(parts[0].split(':').pop().trim());
        forms.push(parts[1].split('@')[0].trim());
      } else {
        forms.push(d);
      }
    });
  }

  // Pass: at least one form is λz.y or any alpha-variant (not λy.y)
  const hasCorrect = forms.some(f => f.includes('λz.y') || f.includes('λy\'.y') || /λ[^y]\.y/u.test(f));
  const hasCapture = forms.some(f => f === 'λy.y');
  
  return hasCorrect && !hasCapture;
}

function checkV1(content, testData) {
  const { lastPacket, cert } = parsePacketStream(content);
  // Pass: cert > 0.7 and no unresolved ERR flags
  return (cert || 0) > 0.7 && !lastPacket?.ERR?.flag?.includes('REQUEST_VERIFICATION');
}

function checkV5(content, testData) {
  const { lastPacket } = parsePacketStream(content);
  if (!lastPacket) return false;

  let hasAdd = false;
  let hasMul = false;

  const check = (str) => {
    if (str.includes('add(3,2)→5') || str.includes('5')) hasAdd = true;
    if (str.includes('mul(2,3)→6') || str.includes('6')) hasMul = true;
  };

  if (lastPacket.S) Object.values(lastPacket.S).forEach(v => check(String(v)));
  if (lastPacket.Δ) lastPacket.Δ.forEach(d => check(d));

  return hasAdd && hasMul && (lastPacket?.μ?.cert || 0) >= 0.8;
}

export function evaluateResult(testId, content, testData) {
  switch (testId) {
    case 'v2-capture-avoidance': return checkV2(content, testData);
    case 'v1-lambda-calibration': return checkV1(content, testData);
    case 'v5-church-numerals': return checkV5(content, testData);
    default: {
      const { cert } = parsePacketStream(content);
      return cert !== null && cert >= 0.7;
    }
  }
}

export async function runFormalTest(testId, executeInputFn, context, session) {
  const testData = loadFormalTestData(testId);
  console.log(`\nRunning Formal Test: ${testData.name} (${testId})`);
  const prompt = buildFormalTestPrompt(testId, testData);
  const result = await executeInputFn(context.runtimeHome, context.registry, session, prompt);
  
  const passed = evaluateResult(testId, result.content, testData);
  const parsed = parsePacketStream(result.content);

  return {
    testId,
    name: testData.name,
    passed,
    content: result.content,
    cert: parsed.cert,
    has_error: parsed.hasError,
  };
}

export function saveResults(results) {
  const resultsPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  return resultsPath;
}
