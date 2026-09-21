#!/usr/bin/env node
import assert from 'node:assert/strict';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { compareInvariants, stateDigest } from '../machine/kernel.mjs';

const sizes = process.argv.includes('--quick') ? [32, 256] : [32, 256, 1_024, 4_096];
const samples = process.argv.includes('--quick') ? 5 : 25;
const invariant = { kind: 'relation-topology', relation: 'mesh' };
const report = {
  schema_version: 1,
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  cpu: os.cpus()[0]?.model ?? 'unknown',
  samples,
  clock: 'performance.now',
  results: [],
};

for (const size of sizes) {
  const original = cycleState(size, false, 'node');
  const relabelled = cycleState(size, false, 'renamed');
  const disconnected = cycleState(size, true, 'node');
  const reordered = { ...structuredClone(original), R: [...original.R].reverse() };
  const reversedPins = { ...structuredClone(original), R: original.R.map(([kind, ...pins]) => [kind, ...pins.reverse()]) };
  const unrelated = { ...structuredClone(original), R: [...original.R, ['other', 'outside-a', 'outside-b']] };
  const missingEdge = { ...structuredClone(original), R: original.R.slice(1) };

  const controls = [
    ['identity', original, true],
    ['vertex-relabel', relabelled, true],
    ['edge-reorder', reordered, true],
    ['pin-reorder', reversedPins, true],
    ['unrelated-relation', unrelated, true],
    ['edge-removal', missingEdge, false],
    ['degree-preserving-component-split', disconnected, false],
  ];
  for (const [name, candidate, expected] of controls) {
    assert.equal(compareInvariants(original, candidate, [invariant])[0].preserved, expected,
      `${name} control failed at n=${size}`);
  }

  const topologyTimes = measure(samples, () => compareInvariants(original, relabelled, [invariant]));
  const digestTimes = measure(samples, () => stateDigest(original));
  report.results.push({
    vertices: size,
    hyperedges: size,
    correctness_controls: `${controls.length}/${controls.length}`,
    topology_compare_ms: summarize(topologyTimes),
    topology_compares_per_second: throughput(topologyTimes),
    canonical_digest_ms: summarize(digestTimes),
    canonical_digests_per_second: throughput(digestTimes),
  });
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function cycleState(size, split, prefix) {
  const name = index => `${prefix}-${index}`;
  const relations = [];
  const span = split ? size / 2 : size;
  for (let index = 0; index < size; index += 1) {
    const base = split && index >= span ? span : 0;
    const local = index - base;
    relations.push(['mesh', name(index), name(base + ((local + 1) % span)), name(base + ((local + 2) % span))]);
  }
  return {
    '§': 1,
    E: Object.fromEntries(Array.from({ length: size }, (_, index) => [name(index), ['vertex']])),
    S: { phase: 'benchmark' },
    R: relations,
    Δ: [],
    μ: { cert: 1 },
  };
}

function measure(count, operation) {
  for (let index = 0; index < 3; index += 1) operation();
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const start = performance.now();
    operation();
    values.push(performance.now() - start);
  }
  return values;
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
  return {
    median: round(percentile(0.5)),
    p95: round(percentile(0.95)),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
  };
}

function round(value) {
  return Number(value.toFixed(3));
}

function throughput(values) {
  return round(1_000 / (values.reduce((sum, value) => sum + value, 0) / values.length));
}
