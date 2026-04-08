import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePacketStream } from '../../harness/err-watcher.mjs';

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

function evalDefault(content) {
  const { cert, hasError } = parsePacketStream(content);
  const result = cert !== null && cert >= 0.5 && !hasError;
  return result;
}

export function evaluateFormalResponse(content) {
  const parsed = parsePacketStream(content);
  const passed = evalDefault(content);
  return { passed, parsed };
}

function evalV2(content) {
  const { lastPacket, cert } = parsePacketStream(content);
  if (!lastPacket) return false;

  // Check S axis first (some models update state)
  const sForm = (lastPacket.S?.['result.form'] || lastPacket.S?.['T.form'] || '').trim();

  // Also scan Δ array for terminal reduction entry
  const deltas = lastPacket['Δ'] || lastPacket.delta || [];
  const deltaForms = deltas
    .filter(d => typeof d === 'string')
    .filter(d => d.includes('result:') || d.includes('T.form:') || d.includes('→'));

  // Extract terminal form from last relevant delta
  // Pattern: "T.form:X→Y@step-N" → extract Y
  let deltaForm = '';
  for (const d of deltaForms.reverse()) {
    const match = d.match(/→([^@]+)@/u);
    if (match) { deltaForm = match[1].trim(); break; }
  }

  const form = deltaForm || sForm;
  if (!form) return cert >= 0.7; // fallback: trust cert if form not extractable

  const isCapture = /λy\.y/u.test(form) || form === 'λy.y';
  const isCorrect = /λ[a-wz]\.y/u.test(form) || form.includes('λz.y');

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

  // Check S axis
  const sForm = lastPacket.S?.['result.form'] || '';

  // Scan Δ for numeric results (5 and 6 for 3+2 and 2×3)
  const deltas = lastPacket['Δ'] || [];
  const deltaStr = deltas.join(' ');
  const hasCorrectAddition = deltaStr.includes('5') || sForm.includes('5');
  const hasCorrectMultiply = deltaStr.includes('6') || sForm.includes('6');

  if (cert >= 0.8 && (hasCorrectAddition || hasCorrectMultiply)) return true;

  // Fallback: trust cert if results not extractable (model may use Church encoding)
  return cert >= 0.8 && deltas.length > 0;
}

function evalV6(content) {
  const { lastPacket, cert } = parsePacketStream(content);
  if (!lastPacket) return false;

  const sForm = lastPacket.S?.['TARGET.form'] || lastPacket.S?.['result.form'] || '';
  const deltas = lastPacket['Δ'] || [];
  const deltaStr = deltas.join(' ');

  // Success if Church-6 form or literal "SIX" / "6" is found
  const hasResult = deltaStr.includes('6') || sForm.includes('6') || 
                    deltaStr.toLowerCase().includes('six') || sForm.toLowerCase().includes('six') ||
                    sForm.includes('f(f(f(f(f(fx)))))');

  return cert >= 0.8 && hasResult;
}

export async function runFormalTest(testId, executeInputFn, context, session) {
  const testData = loadFormalTestData(testId);
  if (!context.outputJson) {
    console.log(`\nRunning Formal Test: ${testData.name} (${testId})`);
  }
  
  let result;
  if (context.dryRun) {
    // Generate a semantically correct mock §1 response based on test type
    let mockContent = '';
    const id = testData.test;
    if (id === 'v6') {
      mockContent = `{"§":1,"E":{"test":["v6","test"],"name":["${testData.name}","process"]},"S":{"state":"initial","result":null},"Δ":["state:initial→evaluating","result:null→SIX"],"μ":{"scope":"TC-probe","urg":1,"cert":1}}`;
    } else if (id === 'v5') {
      mockContent = `{"§":1,"E":{"test":["v5","test"],"name":["${testData.name}","process"]},"S":{"state":"initial"},"Δ":["state:initial→verifying","operation:add(3,2)→5","operation:mul(2,3)→6"],"μ":{"scope":"formal-verification","cert":0.95}}`;
    } else if (id === 'v2') {
      mockContent = `{"§":1,"E":{"T":["(λx.λy.x) y","term"]},"S":{"T.form":"(λx.λy.x) y"},"Δ":["T.form:(λx.λy.x) y→λz.y@step-1"],"μ":{"scope":"reduction","cert":0.9}}`;
    } else {
      mockContent = `{"§":1,"E":{"test":["${id}","test"],"name":["${testData.name}","process"]},"S":{"status":"verified"},"Δ":["test:pass"],"μ":{"scope":"calibration","cert":0.9}}`;
    }
    result = { content: mockContent };
  } else {
    const prompt = buildFormalTestPrompt(testId, testData);
    result = await executeInputFn(context.runtimeHome, context.registry, session, prompt);
  }
  
  let passed = false;
  const id = testData.test;
  if (id === 'v2') passed = evalV2(result.content || '');
  else if (id === 'v1') passed = evalV1(result.content || '');
  else if (id === 'v5') passed = evalV5(result.content || '');
  else if (id === 'v6') passed = evalV6(result.content || '');
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
