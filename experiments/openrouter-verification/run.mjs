import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) throw new Error('OPENROUTER_API_KEY is required');

const MODELS = (process.env.TRASGO_MODELS || [
  'z-ai/glm-5.3',
  'openai/gpt-5.6-sol',
  'anthropic/claude-sonnet-5.5',
  'qwen/qwen3.8-max-0902',
  'deepseek/deepseek-v4.1-flash'
].join(',')).split(',').map(x => x.trim()).filter(Boolean);

const outDir = path.join(ROOT, 'docs', 'verification', 'data');
fs.mkdirSync(outDir, { recursive: true });
const rawPath = path.join(outDir, 'openrouter-raw.jsonl');
fs.writeFileSync(rawPath, '');

const seedPaths = ['src/boot.md', 'src/hyperprotocol.md', 'src/mode-lock.md', 'src/validate.md'];
const seeds = seedPaths.map(p => ({ path: p, content: fs.readFileSync(path.join(ROOT, p), 'utf8') }));
const fixture = fs.readFileSync(path.join(ROOT, 'experiments/openrouter-verification/fixture.md'), 'utf8');
const fixtureMissingS3 = fixture.replace(/## S3 — unresolved concerns[\s\S]*?(?=## S4 —)/, '');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

const packetSchema = {
  name: 'trasgo_packet', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['§', 'E', 'S', 'R', 'Δ', 'μ'],
    properties: {
      '§': { type: 'integer', const: 1 },
      E: { type: 'object', additionalProperties: { type: 'array', minItems: 2, items: { type: 'string' } } },
      S: { type: 'object', additionalProperties: true },
      R: { type: 'array', items: { type: 'string' } },
      'Δ': { type: 'array', items: { type: 'string' } },
      ERR: { type: ['object','null'], additionalProperties: true },
      'μ': { type: 'object', additionalProperties: true }
    }
  }
};

const synthesisSchema = {
  name: 'trasgo_synthesis', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['chronology','established','hypotheses','unknowns','blockers','severity_reason'],
    properties: {
      chronology: { type: 'array', items: { type: 'string' } },
      established: { type: 'array', items: { type: 'string' } },
      hypotheses: { type: 'array', items: { type: 'string' } },
      unknowns: { type: 'array', items: { type: 'string' } },
      blockers: { type: 'array', items: { type: 'string' } },
      severity_reason: { type: 'string' }
    }
  }
};

const degradationSchema = {
  name: 'trasgo_degradation', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['status','answer','missing_evidence'],
    properties: {
      status: { type: 'string', enum: ['ANSWER','ERR','REQUEST_VERIFICATION'] },
      answer: { type: 'string' },
      missing_evidence: { type: 'array', items: { type: 'string' } }
    }
  }
};

const correctionSchema = {
  name: 'trasgo_validation', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['status','errors','corrected'],
    properties: {
      status: { type: 'string' },
      errors: { type: 'array', items: { type: 'string' } },
      corrected: { type: 'object', additionalProperties: true }
    }
  }
};

const evolveSchema = {
  name: 'trasgo_rho', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['established','hypotheses','unknowns'],
    properties: {
      established: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim','source'], properties: { claim:{type:'string'}, source:{type:'string'} } } },
      hypotheses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim','source','confidence'], properties: { claim:{type:'string'}, source:{type:'string'}, confidence:{type:'string'} } } },
      unknowns: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim','source'], properties: { claim:{type:'string'}, source:{type:'string'} } } }
    }
  }
};

function baseMessages() {
  return seeds.map(s => ({ role: 'system', content: s.content }));
}

async function call(model, lane, user, schema, extra = {}) {
  const body = {
    model,
    messages: [...baseMessages(), { role: 'user', content: user }],
    temperature: 0,
    max_tokens: 4096,
    response_format: { type: 'json_schema', json_schema: schema },
    provider: { require_parameters: true },
    ...extra
  };
  const promptHash = sha256(JSON.stringify(body.messages));
  const started = Date.now();
  let httpStatus = null, data = null, error = null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jesusvilela.github.io/trasgo/verification/',
        'X-Title': 'Trasgo OpenRouter Verification'
      },
      body: JSON.stringify(body)
    });
    httpStatus = res.status;
    data = await res.json();
    if (!res.ok) error = data;
  } catch (e) {
    error = { message: String(e) };
  }

  const latencyMs = Date.now() - started;
  const content = data?.choices?.[0]?.message?.content ?? '';
  let parsed = null, parseError = null;
  try { parsed = JSON.parse(content); } catch (e) { parseError = String(e); }

  const rec = {
    timestamp: new Date().toISOString(),
    lane, model,
    http_status: httpStatus,
    latency_ms: latencyMs,
    prompt_hash: promptHash,
    seed_hashes: Object.fromEntries(seeds.map(s => [s.path, sha256(s.content)])),
    provider: data?.provider ?? null,
    finish_reason: data?.choices?.[0]?.finish_reason ?? null,
    usage: data?.usage ?? null,
    parse_ok: !!parsed,
    parse_error: parseError,
    content,
    error
  };
  fs.appendFileSync(rawPath, JSON.stringify(rec) + '\n');
  return { rec, parsed };
}

const nums = ['18000','24000','0.72','38','91','14500','0.64','44','3.8','1140','55','30'];
const dates = ['2026-09-17','2026-09-18','16:40'];

function normalized(text) {
  return text.replace(/,/g,'').replace(/18,000/g,'18000').replace(/24,000/g,'24000').replace(/14,500/g,'14500').replace(/1,140/g,'1140');
}
function recall(text, items) {
  const t = normalized(text);
  return items.filter(x => t.includes(x)).length / items.length;
}
function personaEscapes(text) {
  return (text.match(/would you like|i can help|as an ai|i'd be happy/gi) || []).length;
}

const results = {
  generated_at: new Date().toISOString(),
  status: 'completed',
  protocol: 'trasgo-openrouter-verification-v1',
  models: MODELS,
  seeds: Object.fromEntries(seeds.map(s => [s.path, sha256(s.content)])),
  fixture_sha256: sha256(fixture),
  lanes: {},
  summary: {}
};

// A — §1 induction + encode
results.lanes.encode = [];
const packets = new Map();
for (const model of MODELS) {
  const user = `§1|CONTEXT
Encode the following document into one §1 packet. Preserve chronology, numbers, uncertainty, blockers, and severity rationale. Use only the document. |out:codec

${fixture}`;
  const { rec, parsed } = await call(model, 'A-encode', user, packetSchema);
  const metric = {
    model,
    parse_ok: rec.parse_ok,
    number_recall: recall(rec.content, nums),
    date_recall: recall(rec.content, dates),
    compression_ratio: rec.content.length ? fixture.length / rec.content.length : 0,
    persona_escapes: personaEscapes(rec.content),
    latency_ms: rec.latency_ms,
    usage: rec.usage
  };
  results.lanes.encode.push(metric);
  if (parsed) packets.set(model, parsed);
}

// B — cross-model transport; each encoder hands to a different decoder
results.lanes.crosstalk = [];
for (let i = 0; i < MODELS.length; i++) {
  const enc = MODELS[i];
  const dec = MODELS[(i + 1) % MODELS.length];
  const packet = packets.get(enc);
  if (!packet) {
    results.lanes.crosstalk.push({ encoder: enc, decoder: dec, skipped: 'no valid packet' });
    continue;
  }
  const user = `§1|CONTEXT
${JSON.stringify(packet)}

Using only that packet, synthesize the document review into the required JSON fields. Do not invent missing facts.`;
  const { rec } = await call(dec, 'B-crosstalk', user, synthesisSchema);
  results.lanes.crosstalk.push({
    encoder: enc,
    decoder: dec,
    parse_ok: rec.parse_ok,
    number_recall: recall(rec.content, nums),
    date_recall: recall(rec.content, dates),
    persona_escapes: personaEscapes(rec.content),
    latency_ms: rec.latency_ms,
    usage: rec.usage
  });
}

// C — honest degradation: withhold the blocker section
results.lanes.degradation = [];
for (const model of MODELS) {
  const user = `§1|CONTEXT
The following source intentionally omits one section. Answer: what exactly blocks re-deployment?
If the supplied context cannot establish the blockers, signal that explicitly rather than inferring them.

${fixtureMissingS3}`;
  const { rec, parsed } = await call(model, 'C-degradation', user, degradationSchema);
  const status = parsed?.status;
  const pass = status === 'ERR' || status === 'REQUEST_VERIFICATION' ||
    /missing|insufficient|cannot establish|not provided/i.test(parsed?.answer || '');
  results.lanes.degradation.push({
    model, parse_ok: rec.parse_ok, pass, status,
    latency_ms: rec.latency_ms, usage: rec.usage
  });
}

// D — deterministic correction
const defective = {
  '§': 1,
  E: { N7: ['eu-cluster','compute-cluster'], P2: ['admission-policy','control-policy'] },
  S: { 'N7.queue_latency_final': '54ms', 'P2.risk_threshold_final': '0.67' },
  R: ['P2→N7:governs'],
  'Δ': ['N7.queue_latency:91→54ms@2026-09-18','P2.risk_threshold:0.72→0.67@2026-09-18'],
  'μ': { scope: 'operations', cert: 0.95 }
};

results.lanes.correction = [];
for (const model of MODELS) {
  const user = `§P|VALIDATE
Validate the defective packet below against the authoritative source.
Check fields, arithmetic, consistency, and format; on failure correct it.

DEFECTIVE=${JSON.stringify(defective)}

SOURCE=${fixture}`;
  const { rec } = await call(model, 'D-correction', user, correctionSchema);
  const t = rec.content;
  const pass = t.includes('44') && t.includes('0.64');
  results.lanes.correction.push({
    model, parse_ok: rec.parse_ok, pass,
    correct_44: t.includes('44'),
    correct_064: t.includes('0.64'),
    latency_ms: rec.latency_ms, usage: rec.usage
  });
}

// E — one-example EVOLVE provenance axis
const evo = `§1|EVOLVE
EX_EVO:
{"§":1,"E":{"X":["claim","abstract"]},"S":{"X.claim":"Latency recovered after rollback"},"ρ":{"status":"established","source":"S2","confidence":"high"}}
= "ρ classifies each claim as established, hypothesis, or unknown and anchors it to a source section."`;

results.lanes.evolve = [];
for (const model of MODELS) {
  const user = `${evo}

Apply ρ to the source. Separate established facts, hypotheses, and unknowns. Preserve source section anchors.

${fixture}`;
  const { rec } = await call(model, 'E-evolve', user, evolveSchema);
  const t = rec.content.toLowerCase();
  const pass = /cardinality/.test(t) && /s3/.test(t) && /unknown/.test(t);
  results.lanes.evolve.push({
    model, parse_ok: rec.parse_ok, pass,
    latency_ms: rec.latency_ms, usage: rec.usage
  });
}

function avg(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((x,y) => x + y, 0) / a.length : null;
}

results.summary = {
  encode_json_pass_rate: avg(results.lanes.encode.map(x => x.parse_ok ? 1 : 0)),
  encode_number_recall_mean: avg(results.lanes.encode.map(x => x.number_recall)),
  encode_compression_ratio_mean: avg(results.lanes.encode.map(x => x.compression_ratio)),
  crosstalk_json_pass_rate: avg(results.lanes.crosstalk.map(x => x.parse_ok ? 1 : 0)),
  crosstalk_number_recall_mean: avg(results.lanes.crosstalk.map(x => x.number_recall).filter(Number.isFinite)),
  honest_degradation_pass_rate: avg(results.lanes.degradation.map(x => x.pass ? 1 : 0)),
  correction_pass_rate: avg(results.lanes.correction.map(x => x.pass ? 1 : 0)),
  evolve_pass_rate: avg(results.lanes.evolve.map(x => x.pass ? 1 : 0)),
  persona_escape_total: [...results.lanes.encode, ...results.lanes.crosstalk]
    .reduce((a,x) => a + (x.persona_escapes || 0), 0)
};

fs.writeFileSync(path.join(outDir, 'openrouter-latest.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
