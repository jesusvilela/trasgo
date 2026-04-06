import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BOOT_PATH = path.join('src', 'cot.md');
const FILLER_PREFIX = /^(?:first|second|third|fourth|next|then|after that|afterwards|therefore|thus|so|because|given that|given|we|i|let me|let's|now)\s+/iu;
const CONNECTOR_SPLIT = /\s+(?:then|therefore|thus|so|because|after that|afterwards|next)\s+/iu;

function squashWhitespace(text) {
  return text.replace(/\s+/gu, ' ').trim();
}

function stripOuterPunctuation(text) {
  return text.replace(/^[\s,;:.!?-]+|[\s,;:.!?-]+$/gu, '').trim();
}

export function loadCotBoot(baseDir) {
  return fs.readFileSync(path.join(baseDir, DEFAULT_BOOT_PATH), 'utf8');
}

export function compileCot(naturalText, options = {}) {
  const cleaned = squashWhitespace(naturalText || '');
  const answer = stripOuterPunctuation(options.answer || inferAnswer(cleaned));
  const clauses = toClauses(cleaned);
  const steps = clauses.map((clause, index) => ({
    id: index + 1,
    op: classifyClause(clause, index, clauses.length),
    payload: compressClause(clause),
  }));

  if (answer) {
    const alreadyEmitsAnswer = steps.some(step => step.op === 'EMIT' && /^answer:/iu.test(step.payload));
    if (!alreadyEmitsAnswer) {
      steps.push({
        id: steps.length + 1,
        op: 'EMIT',
        payload: `answer:${answer}`,
      });
    }
  }

  return {
    kind: 'trasgo-cot-compile',
    input_text: cleaned,
    answer: answer || null,
    step_count: steps.length,
    steps,
    codec: renderCot(steps),
  };
}

export function expandCot(codecText) {
  const parsed = parseCot(codecText);
  return {
    kind: 'trasgo-cot-expand',
    codec: parsed.codec,
    steps: parsed.steps,
    answer: parsed.answer,
    natural: parsed.steps.map(step => `${step.id}. ${expandStep(step)}`).join(' ').trim(),
  };
}

export function parseCot(codecText) {
  const codec = squashWhitespace(codecText || '');
  const body = codec.replace(/^§CoT\[/u, '').replace(/\]$/u, '').trim();
  const stepMatches = [...body.matchAll(/(\d+):([A-Z]+)\|(.+?)(?=(?:\s+\d+:[A-Z]+\|)|$)/gu)];
  const steps = stepMatches.map(match => ({
    id: Number.parseInt(match[1], 10),
    op: match[2],
    payload: stripOuterPunctuation(match[3]),
  }));
  const emit = steps.find(step => step.op === 'EMIT' && /^answer:/iu.test(step.payload));

  return {
    codec,
    steps,
    answer: emit ? stripOuterPunctuation(emit.payload.replace(/^answer:/iu, '')) : null,
  };
}

export function renderCot(steps) {
  return `§CoT[\n${steps.map(step => `${step.id}:${step.op}|${step.payload}`).join('\n')}\n]`;
}

function toClauses(text) {
  if (!text) return [];
  const seeded = text
    .replace(/\r?\n+/gu, '. ')
    .replace(/\s{2,}/gu, ' ')
    .trim();

  const parts = seeded
    .split(/(?<=[.!?;])\s+/u)
    .flatMap(part => part.split(CONNECTOR_SPLIT))
    .map(part => stripOuterPunctuation(part))
    .filter(Boolean);

  return parts.length > 0 ? parts : [seeded];
}

function classifyClause(clause, index, total) {
  const lower = clause.toLowerCase();
  if (/^answer[:=]/u.test(lower) || /\banswer\b/u.test(lower) || (index === total - 1 && /(?:=|equals|therefore|thus|so)\b/u.test(lower))) {
    return 'EMIT';
  }
  if (/\b(check|verify|confirm|ensure|sanity)\b/u.test(lower)) return 'CHECK';
  if (/\b(apply|use|compute|calculate|derive|multiply|divide|add|subtract|sum|combine)\b/u.test(lower)) return 'APPLY';
  if (/\b(infer|implies|conclude|deduce)\b/u.test(lower)) return 'INFER';
  return index === total - 1 ? 'INFER' : 'OBSERVE';
}

function compressClause(clause) {
  let compact = squashWhitespace(clause);
  while (FILLER_PREFIX.test(compact)) {
    compact = compact.replace(FILLER_PREFIX, '');
  }

  return stripOuterPunctuation(
    compact
      .replace(/\bthe answer is\b/giu, 'answer:')
      .replace(/\btherefore\b/giu, '')
      .replace(/\bthus\b/giu, '')
      .replace(/\bbecause\b/giu, 'cause:')
      .replace(/\s+/gu, ' '),
  );
}

function inferAnswer(text) {
  if (!text) return '';
  const explicit = text.match(/\banswer(?:\s+is|:|=)\s*([^.;!?]+)/iu);
  if (explicit?.[1]) return explicit[1];

  const equalsMatches = [...text.matchAll(/=\s*([^.;!?]+)/gu)];
  if (equalsMatches.length > 0) return equalsMatches.at(-1)[1];

  const numberMatch = text.match(/(-?\d+(?:\.\d+)?)\s*$/u);
  if (numberMatch?.[1]) return numberMatch[1];

  const boolMatch = text.match(/\b(yes|no|true|false)\b(?!.*\b(?:yes|no|true|false)\b)/iu);
  if (boolMatch?.[1]) return boolMatch[1];

  return '';
}

function expandStep(step) {
  if (step.op === 'EMIT' && /^answer:/iu.test(step.payload)) {
    return `Emit final answer ${step.payload.replace(/^answer:/iu, '').trim()}.`;
  }
  return `${step.op.toLowerCase()} ${step.payload}.`;
}
