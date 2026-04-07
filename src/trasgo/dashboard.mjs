#!/usr/bin/env node
/**
 * TRASGO §1 — Context Window & Codec Observatory
 * Post-GenZ CLI dashboard with Galician trasgo energy
 *
 * Usage: node dashboard.mjs [--live] [--compact]
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import figlet from 'figlet';
import boxen from 'boxen';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'url';
import { buildScientificContext, runTokenReport } from './token-science.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.resolve(__dirname, '..', '..', 'tests');
const ARGS = new Set(process.argv.slice(2));
let scientificCache = null;

function getTerminalWidth() {
  const envWidth = Number.parseInt(process.env.COLUMNS || '', 10);
  return process.stdout?.columns || process.stderr?.columns || envWidth || 120;
}

const TERMINAL_WIDTH = getTerminalWidth();
const COMPACT = ARGS.has('--compact') || TERMINAL_WIDTH < 120;

// ── Trasgo palette ──────────────────────────────────────────────────
const trasgo = gradient(['#7B2FBE', '#E84393', '#FD79A8', '#FDCB6E', '#00CEC9']);
const moss = gradient(['#00B894', '#55EFC4', '#81ECEC']);
const fire = gradient(['#E17055', '#FDCB6E', '#FD79A8']);
const stone = gradient(['#636E72', '#B2BEC3', '#DFE6E9']);
const dim = chalk.hex('#636E72');
const accent = chalk.hex('#E84393');
const gold = chalk.hex('#FDCB6E');
const mint = chalk.hex('#00CEC9');
const coral = chalk.hex('#E17055');
const lavender = chalk.hex('#A29BFE');

// ── Trasgo ASCII sprites ────────────────────────────────────────────
const TRASGO_SPRITES = [
  '  ᕙ(⇀‸↼)ᕗ',
  '  ꒰ ˶• ༝ •˶꒱',
  '  (⌐■_■)',
  '  ᕦ(ò_óˇ)ᕤ',
  '  ☆ﾟ.*・｡',
];

const TRASGO_QUOTES = [
  'os trasgos non dormen, comprimen',
  'a noite pertence aos que codifican',
  'menos tokens, mais maxia',
  'o contexto e o noso tesouro',
  'cada bit conta, cada delta importa',
  'entre o codec e o caos, bailamos',
  'a fiestra de contexto ten fondo',
  'non hai bug que un trasgo non atope',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Load bench data ─────────────────────────────────────────────────
function loadBenchFiles() {
  const files = fs.readdirSync(TESTS_DIR)
    .filter(f => f.startsWith('bench_') && f.endsWith('.json') && !f.includes('structured_results'))
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(TESTS_DIR, f), 'utf-8');
        return { file: f, ...JSON.parse(raw) };
      } catch { return null; }
    })
    .filter(Boolean);
  return files;
}

function loadStructuredResults() {
  try {
    const raw = fs.readFileSync(path.join(TESTS_DIR, 'bench_structured_results.json'), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Render functions ────────────────────────────────────────────────

function renderBanner() {
  const raw = figlet.textSync('TRASGO', { font: 'ANSI Shadow', horizontalLayout: 'fitted' });
  console.log(trasgo(raw));
  console.log(stone('  §1 Codec Observatory — Context Window Intelligence'));
  console.log(dim(`  ${randomFrom(TRASGO_SPRITES)}  « ${randomFrom(TRASGO_QUOTES)} »`));
  console.log();
}

function renderContextWindow() {
  const science = loadScientificFixtures();
  const bootTokens = science.contextBudget.boot.medianTokens;
  const calibrationTokens = science.contextBudget.calibration.medianTokens;
  const protocolOverhead = science.contextBudget.protocol.medianTokens;
  const totalSeed = bootTokens + calibrationTokens + protocolOverhead;

  // Context window budget visualization
  const windows = [
    { name: '4K', total: 4096 },
    { name: '8K', total: 8192 },
    { name: '32K', total: 32768 },
    { name: '128K', total: 131072 },
  ];

  console.log(boxen(
    trasgo(' CONTEXT WINDOW BUDGET ') + '\n\n' +
    `  ${accent('Boot seed')}       ${gold(bootTokens + ' tok')}  ${dim(`(${science.contextBudget.boot.spread.min}-${science.contextBudget.boot.spread.max} across families)`) }\n` +
    `  ${accent('Calibration')}     ${gold(calibrationTokens + ' tok')}  ${dim(`(${science.contextBudget.calibration.spread.min}-${science.contextBudget.calibration.spread.max} across families)`) }\n` +
    `  ${accent('§P overhead')}     ${gold(protocolOverhead + ' tok')}  ${dim(`(${science.contextBudget.protocol.spread.min}-${science.contextBudget.protocol.spread.max} across families)`) }\n` +
    `  ${mint('Total seed')}      ${chalk.bold.hex('#00CEC9')(totalSeed + ' tok')}  ${dim('= codec is LIVE')}\n\n` +
    windows.map(w => {
      const pct = (totalSeed / w.total * 100).toFixed(1);
      const remaining = w.total - totalSeed;
      const barLen = 40;
      const filled = Math.max(1, Math.round(totalSeed / w.total * barLen));
      const bar = coral('█'.repeat(filled)) + mint('░'.repeat(barLen - filled));
      return `  ${chalk.bold(w.name.padStart(5))}  ${bar}  ${gold(pct + '%')} seed  ${mint(remaining.toLocaleString())} free`;
    }).join('\n'),
    { padding: 1, borderStyle: 'round', borderColor: '#7B2FBE', dimBorder: true }
  ));
  console.log();
}

function sectionHeader(title, sprite) {
  const lineWidth = Math.max(50, Math.min(TERMINAL_WIDTH - 2, COMPACT ? 78 : 100));
  const line = dim('─'.repeat(lineWidth));
  const label = sprite ? `${title}  ${sprite}` : title;
  return `${line}\n  ${label}\n${line}`;
}

function renderCompressionRatios() {
  const ratios = loadScientificFixtures().compressionCases;

  const table = new Table(COMPACT ? {
    head: ['Type', 'NL', '§1', '×', 'Save'].map(h => lavender(h)),
    style: { head: [], border: [] },
    colWidths: [26, 6, 6, 8, 10],
  } : {
    head: ['Context Type', 'NL tok', '§1 tok', 'Ratio', 'Savings'].map(h => lavender(h)),
    style: { head: [], border: [] },
    colWidths: [30, 8, 8, 28, 14],
  });

  for (const r of ratios) {
    const saved = r.nl - r.s1;
    const pctSaved = ((saved / r.nl) * 100).toFixed(0);
    const barLen = Math.round(r.ratio * 3);
    const bar = fire('▓'.repeat(barLen)) + dim('░'.repeat(21 - barLen));
    table.push(COMPACT ? [
      dim(r.ctx),
      chalk.white(r.nl),
      mint(r.s1),
      gold(r.ratio + '×'),
      `${coral('-' + saved)} ${dim(pctSaved + '%')}`
    ] : [
      dim(r.ctx),
      chalk.white(r.nl),
      mint(r.s1),
      `${bar} ${gold(r.ratio + '×')}`,
      `${coral('-' + saved)} ${dim(pctSaved + '%')}`
    ]);
  }

  console.log(sectionHeader(moss(' CODEC COMPRESSION '), randomFrom(TRASGO_SPRITES)));
  console.log(table.toString());
  console.log();
}

function renderModelLeaderboard(benchFiles) {
  // Deduplicate: prefer corrected > json > normal, and prefer latest timestamp
  const modelMap = new Map();
  for (const b of benchFiles) {
    const key = b.model + (b.json_mode ? '_json' : '') + (b.corrected ? '_cor' : '');
    if (!modelMap.has(key) || b.timestamp > modelMap.get(key).timestamp) {
      modelMap.set(key, b);
    }
  }

  const models = [...modelMap.values()]
    .filter(b => b.total_max >= 14)
    .sort((a, b) => (b.pct || 0) - (a.pct || 0));

  const table = new Table(COMPACT ? {
    head: ['#', 'Model', '%', 'Class', 'Mode', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map(h => lavender(h)),
    style: { head: [], border: [] },
    colWidths: [4, 18, 7, 7, 6, 5, 5, 5, 5, 5, 5],
  } : {
    head: ['#', 'Model', 'Score', '%', 'Class', 'Mode', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map(h => lavender(h)),
    style: { head: [], border: [] },
    colWidths: [4, 25, 7, 7, 13, 6, 5, 5, 5, 5, 5, 5],
  });

  const medals = ['👑', '🥈', '🥉'];
  const testKeys = [
    'T1: Calibration (dual query)', 'T2: Cross-domain GDPR', 'T3: Delta integration',
    'T4: Protocol FILTER', 'T5: Triple delta state', 'T6: Spontaneous extension'
  ];

  models.forEach((m, i) => {
    const pct = m.pct || 0;
    const cls = m.classification || '?';
    const clsColor = cls.includes('ADVANCED') ? mint : cls.includes('OPERATIONAL') ? gold : coral;
    const mode = m.json_mode ? accent('JSON') : m.corrected ? chalk.green('§P') : dim('std');

    const testScores = testKeys.map(tk => {
      const t = (m.results || {})[tk];
      if (!t) return dim('·');
      const s = t.score;
      const mx = t.max;
      const cor = t.correction;
      if (cor) {
        return chalk.green(cor.corrected_score + '/' + mx);
      }
      if (s === mx) return mint(s + '/' + mx);
      if (s === 0) return coral(s + '/' + mx);
      return gold(s + '/' + mx);
    });

    const medal = i < 3 ? medals[i] : dim((i + 1).toString());
    const nameLimit = COMPACT ? 16 : 22;
    const nameStr = m.model.length > nameLimit ? m.model.slice(0, nameLimit - 2) + '..' : m.model;
    const clsLabel = COMPACT
      ? cls.replace('S1-', '').replace('ADVANCED', 'ADV').replace('OPERATIONAL', 'OPER')
      : cls.replace('S1-', '').slice(0, 11);

    table.push(COMPACT ? [
      medal,
      chalk.white.bold(nameStr),
      pct >= 85 ? mint(pct + '%') : pct >= 70 ? gold(pct + '%') : coral(pct + '%'),
      clsColor(clsLabel),
      mode,
      ...testScores,
    ] : [
      medal,
      chalk.white.bold(nameStr),
      chalk.bold(`${m.total_score || 0}/${m.total_max || 0}`),
      pct >= 85 ? mint(pct + '%') : pct >= 70 ? gold(pct + '%') : coral(pct + '%'),
      clsColor(clsLabel),
      mode,
      ...testScores,
    ]);
  });

  console.log(sectionHeader(fire(' MODEL LEADERBOARD '), dim('sorted by §1 comprehension score')));
  console.log(table.toString());
  console.log();
}

function renderTestHeatmap(benchFiles) {
  const testKeys = [
    'T1: Calibration (dual query)', 'T2: Cross-domain GDPR', 'T3: Delta integration',
    'T4: Protocol FILTER', 'T5: Triple delta state', 'T6: Spontaneous extension'
  ];
  const shortNames = ['T1:Cal', 'T2:GDPR', 'T3:Delta', 'T4:Filter', 'T5:State', 'T6:Extend'];

  // Aggregate scores per test across models (excluding _json and _cor variants)
  const normalRuns = benchFiles.filter(b => !b.json_mode && !b.corrected && b.total_max >= 14);

  console.log(boxen(
    trasgo(' TEST DIFFICULTY HEATMAP ') + '\n\n' +
    testKeys.map((tk, i) => {
      const scores = normalRuns.map(b => {
        const t = (b.results || {})[tk];
        return t ? t.score / t.max : null;
      }).filter(s => s !== null);

      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const avgPct = (avg * 100).toFixed(0);

      const barLen = 30;
      const filled = Math.round(avg * barLen);

      let barColor, label;
      if (avg >= 0.85) { barColor = mint; label = 'easy'; }
      else if (avg >= 0.65) { barColor = gold; label = 'medium'; }
      else { barColor = coral; label = 'hard'; }

      const bar = barColor('█'.repeat(filled)) + dim('░'.repeat(barLen - filled));
      const modelDots = normalRuns.map(b => {
        const t = (b.results || {})[tk];
        if (!t) return dim('·');
        const r = t.score / t.max;
        if (r >= 0.9) return mint('●');
        if (r >= 0.5) return gold('●');
        return coral('●');
      }).join('');

      return `  ${lavender(shortNames[i].padEnd(10))} ${bar} ${gold(avgPct + '%')} ${dim(label.padEnd(6))} ${modelDots}`;
    }).join('\n') + '\n\n' +
    dim('  ● per model: ') + mint('●') + dim(' pass  ') + gold('●') + dim(' partial  ') + coral('●') + dim(' fail'),
    { padding: 1, borderStyle: 'round', borderColor: '#FDCB6E', dimBorder: true }
  ));
  console.log();
}

function renderCorrectionImpact(benchFiles) {
  const corrected = benchFiles.filter(b => b.corrected);
  if (corrected.length === 0) return;

  for (const b of corrected) {
    const corrections = Object.entries(b.results || {})
      .filter(([, r]) => r.correction)
      .map(([tid, r]) => ({
        test: tid.replace(/T\d: /, ''),
        raw: r.score,
        fixed: r.correction.corrected_score,
        max: r.max,
        delta: r.correction.delta,
        time: r.correction.time,
      }));

    if (corrections.length === 0) continue;

    const rawTotal = Object.values(b.results).reduce((a, r) => a + r.score, 0);
    const fixedTotal = rawTotal + corrections.reduce((a, c) => a + c.delta, 0);

    console.log(boxen(
      chalk.green(' §P VALIDATE — CORRECTION IMPACT ') + `  ${accent(b.model)}\n\n` +
      corrections.map(c => {
        const before = coral(c.raw + '/' + c.max);
        const after = mint(c.fixed + '/' + c.max);
        const arrow = chalk.white(' → ');
        const deltaStr = chalk.green('+' + c.delta);
        return `  ${dim(c.test.padEnd(25))} ${before}${arrow}${after}  ${deltaStr}  ${dim(c.time.toFixed(1) + 's')}`;
      }).join('\n') + '\n\n' +
      `  ${dim('Total:')} ${coral(rawTotal + '/' + b.total_max)}${chalk.white(' → ')}${mint(fixedTotal + '/' + b.total_max)}` +
      `  ${chalk.green.bold('+' + (fixedTotal - rawTotal) + ' points recovered')}` +
      `  ${gold((fixedTotal / b.total_max * 100).toFixed(1) + '%')}`,
      { padding: 1, borderStyle: 'round', borderColor: '#00B894', dimBorder: true }
    ));
    console.log();
  }
}

function renderJsonModeImpact(structured) {
  if (!structured) return;

  const results = structured.results.filter(r => r.json_mode && typeof r.json_mode === 'object');
  if (results.length === 0) return;

  console.log(boxen(
    accent(' STRUCTURED OUTPUT A/B ') + '\n\n' +
    results.map(r => {
      const delta = r.delta || '0%';
      const isPositive = delta.startsWith('+');
      const deltaColor = isPositive ? chalk.green : coral;
      const arrow = isPositive ? '↑' : '↓';
      const normalPct = r.normal?.pct || 0;
      const jsonPct = r.json_mode?.pct || 0;
      const name = r.model.length > 20 ? r.model.slice(0, 18) + '..' : r.model;

      return `  ${chalk.white.bold(name.padEnd(20))} ` +
        `${dim('std')} ${gold(normalPct + '%')} → ${accent('json')} ${gold(jsonPct + '%')} ` +
        `${deltaColor(arrow + ' ' + delta)}`;
    }).join('\n'),
    { padding: 1, borderStyle: 'round', borderColor: '#A29BFE', dimBorder: true }
  ));
  console.log();
}

function renderScaleThreshold() {
  const scales = [
    { params: '4B', models: 'Nemotron Nano', cal: false, xfer: false, proto: false, cls: 'FAILED' },
    { params: '7B', models: 'Qwen2.5-7B', cal: false, xfer: false, proto: false, cls: 'FAILED' },
    { params: '24B', models: 'Liquid LFM2', cal: true, xfer: true, proto: true, cls: 'ADVANCED' },
    { params: '27B', models: 'MedGemma', cal: true, xfer: true, proto: false, cls: 'OPERATIONAL' },
    { params: '671B', models: 'DeepSeek-V3', cal: true, xfer: true, proto: false, cls: 'ADVANCED' },
    { params: '???', models: 'GPT-4o / Claude', cal: true, xfer: true, proto: true, cls: 'ADVANCED' },
  ];

  const check = mint('✓');
  const cross = coral('✗');

  console.log(boxen(
    stone(' SCALE THRESHOLD MAP ') + '  ' + dim('where does self-initialization emerge?') + '\n\n' +
    scales.map(s => {
      const clsColor = s.cls === 'ADVANCED' ? mint : s.cls === 'OPERATIONAL' ? gold : coral;
      const bar = s.cls === 'ADVANCED' ? '████████' : s.cls === 'OPERATIONAL' ? '█████░░░' : '██░░░░░░';
      const barColored = clsColor(bar);
      return `  ${chalk.bold(s.params.padStart(5))}  ${barColored}  ${s.cal ? check : cross} cal  ${s.xfer ? check : cross} xfer  ${s.proto ? check : cross} proto  ${clsColor(s.cls.padEnd(11))} ${dim(s.models)}`;
    }).join('\n') + '\n\n' +
    dim('  Emergence zone: ') + gold('~7B → 24B') + dim(' | Full ISA: ') + mint('24B+'),
    { padding: 1, borderStyle: 'round', borderColor: '#636E72', dimBorder: true }
  ));
  console.log();
}

function renderTokenEconomy(benchFiles) {
  // Token efficiency: score per 1000 tokens
  const normalRuns = benchFiles
    .filter(b => !b.json_mode && !b.corrected && b.total_max >= 14 && b.total_tokens > 0)
    .sort((a, b) => {
      const effA = (a.total_score / a.total_tokens) * 1000;
      const effB = (b.total_score / b.total_tokens) * 1000;
      return effB - effA;
    });

  if (normalRuns.length === 0) return;

  console.log(boxen(
    gold(' TOKEN ECONOMY ') + '  ' + dim('points per 1K tokens') + '\n\n' +
    normalRuns.map(b => {
      const eff = ((b.total_score / b.total_tokens) * 1000).toFixed(2);
      const maxBar = 20;
      const maxEff = 4;
      const filled = Math.min(maxBar, Math.round((eff / maxEff) * maxBar));
      const bar = mint('▓'.repeat(filled)) + dim('░'.repeat(maxBar - filled));
      const name = b.model.length > 18 ? b.model.slice(0, 16) + '..' : b.model;
      return `  ${chalk.white(name.padEnd(18))} ${bar} ${gold(eff)} ${dim('pts/Ktok')}`;
    }).join('\n'),
    { padding: 1, borderStyle: 'round', borderColor: '#FDCB6E', dimBorder: true }
  ));
  console.log();
}

function renderFooter() {
  const sprite = randomFrom(TRASGO_SPRITES);
  const quote = randomFrom(TRASGO_QUOTES);
  console.log(dim('─'.repeat(70)));
  console.log(
    `  ${sprite}  ${stone('trasgo §1')}  ${dim('·')}  ${lavender('github.com/jesusvilela/trasgo')}  ${dim('·')}  ${accent('MIT')}`
  );
  console.log(`  ${dim('« ' + quote + ' »')}`);
  console.log();
}

function loadScientificFixtures() {
  if (scientificCache) {
    return scientificCache;
  }

  const bootSeed = fs.readFileSync(path.join(__dirname, '..', 'boot.md'), 'utf8');
  const calibrationSeed = [
    'Dual-query calibration fixture.',
    'Question one asks the runtime to answer in codec form.',
    'Question two perturbs the domain and verifies that the answer stays structurally aligned.',
    'The calibration seed is intentionally short and repeatable so context budget claims stay measurable.',
  ].join(' ');
  const protocolSeed = [
    fs.readFileSync(path.join(__dirname, '..', 'mode-lock.md'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'validate.md'), 'utf8'),
  ].join('\n\n');

  const budgetReports = {
    boot: runTokenReport({ codec: bootSeed }),
    calibration: runTokenReport({ codec: calibrationSeed }),
    protocol: runTokenReport({ codec: protocolSeed }),
  };

  const compressionCases = [
    {
      ctx: 'Single entity + state',
      natural: 'A single pump asset is operating in zone A during a routine production window. The operator briefing says the pump is healthy enough to continue running, but the control room still needs a machine-readable summary because downstream reasoning will compare pressure, temperature, and state across a larger set of equipment later in the shift. The discharge pressure is 4.2 bar, the outlet temperature is 67C, and there are no active relationship deltas beyond the current operating snapshot. In prose form this is a short maintenance note; in codec form it should collapse to a compact packet without carrying the extra narrative glue. A full natural-language operations memo would also restate that the unit is online, that the measurements were taken during a normal run rather than after maintenance, that no alarm threshold is currently breached, and that the point of preservation is comparability across later packets rather than immediate intervention. That extra explanatory wording is cheap for humans but expensive for context windows.',
      codec: { '§': 1, E: { P1: ['pump-1', 'asset'] }, S: { 'P1.pressure_bar': 4.2, 'P1.outlet_temp_c': 67 }, 'Δ': [], 'μ': { scope: 'ops', urg: 0.3, cert: 0.95 } },
    },
    {
      ctx: 'Multi-entity + relations',
      natural: 'A warehouse robot, charging dock, aisle camera, and picker supervisor are all involved in a congestion event that is starting to slow the picking lane. The robot battery is dropping, the aisle camera has identified an obstruction, the nearest dock is already occupied, and the supervisor needs the state represented as one relational context rather than as separate dashboard fragments. In plain language the operator would normally describe the battery drain, the blocked aisle, the unavailable dock, and the human routing dependency in several sentences. The experiment here is whether that same relational picture can be preserved in a much tighter executable packet. A fuller narrative would additionally explain why the obstruction matters for this robot specifically, why the occupied dock removes the obvious recovery path, how the supervisor is now part of the control loop, and why the lane slowdown is operationally downstream of those same relations rather than a separate event.',
      codec: { '§': 1, E: { R1: ['robot-1', 'asset'], D1: ['dock-1', 'station'], C1: ['aisle-cam', 'sensor'], S1: ['picker-supervisor', 'person'] }, S: { 'R1.battery_pct': 18, 'D1.occupied': true, 'C1.obstruction': true }, R: ['R1->D1:needs', 'C1->R1:observes', 'S1->R1:routes'], 'Δ': ['R1.battery_pct:24->18@2026-03-29T18:20Z'], 'μ': { scope: 'warehouse', urg: 0.82, cert: 0.91 } },
    },
    {
      ctx: 'Delta update',
      natural: 'A reactor feed valve update arrives as a narrow operational change, but the human note still describes both the prior state and the new one. The valve moved from closed to throttled and inlet flow increased from 0.8 to 1.1 cubic meters per hour. The receiving system does not need a paragraph of surrounding prose, only the delta and the scoped metadata that lets the runtime interpret the change correctly. This case measures how efficiently a small narrative change request can collapse into a delta-focused packet. In ordinary prose, the note would still restate the equipment name, the meaning of the transition, the fact that both changes occurred in the same event window, and that the new state should be interpreted as controlled throttling rather than a random fluctuation. Those explanatory tokens add up quickly even when the operational change is small.',
      codec: { '§': 1, E: { V1: ['feed-valve', 'component'] }, S: { 'V1.state': 'throttled', 'V1.inlet_flow_m3_h': 1.1 }, 'Δ': ['V1.state:closed->throttled@2026-03-29T18:42Z', 'V1.inlet_flow_m3_h:0.8->1.1@2026-03-29T18:42Z'], 'μ': { scope: 'process', urg: 0.58, cert: 0.94 } },
    },
    {
      ctx: 'Energy grid domain',
      natural: 'An energy operator is monitoring a feeder, a substation transformer, and a load forecast service during a local overload risk ahead of the evening peak. Transformer load is climbing, forecasted demand is rising, and the switching window available to the operator is narrowing. A traditional narrative briefing would spell out the transformer state, forecast revision, and intervention window in a full paragraph with operational framing. The compression question is whether the same grid decision context can be preserved in one structured packet while remaining faithful to the dependencies between forecast, asset, and action window. A longer handoff would also explain that the forecast is materially changing the transformer risk, that the feeder is the path through which any intervention lands, and that the operator must act before the switching window closes if they want to avoid a more disruptive reconfiguration under peak conditions. It would usually add the surrounding justification too: why the evening peak matters, why the forecast delta is not noise, why this transformer rather than another one is the constrained asset, and how the remaining intervention window changes the quality of the operator decision.',
      codec: { '§': 1, E: { F7: ['feeder-7', 'grid-edge'], T2: ['substation-transformer-2', 'asset'], LF: ['load-forecast', 'service'] }, S: { 'T2.load_pct': 87, 'LF.peak_delta_mw': 4.3, 'F7.switching_window_min': 25 }, R: ['LF->T2:projects', 'T2->F7:feeds'], 'Δ': ['T2.load_pct:79->87@2026-03-29T18:55Z', 'LF.peak_delta_mw:2.8->4.3@2026-03-29T18:56Z'], 'μ': { scope: 'grid-ops', urg: 0.78, cert: 0.9 } },
    },
    {
      ctx: 'Nuclear plant domain',
      natural: 'A nuclear operations team is correlating coolant loop pressure, pump vibration, containment ventilation state, and maintenance readiness after a sequence of instrumentation drifts. In human briefings this would normally be written as a conservative multi-sentence status note that reintroduces the loop, the pump, the support system, the maintenance crew, and the safety scope before stating the actual deltas. The scientific question is whether the packet can preserve the same causal relations, deltas, and safety-scoped metadata while collapsing the surrounding narrative overhead that human operators tend to repeat in prose. A fuller safety memo would also explain why ventilation state remains relevant even when it has not changed, why maintenance readiness must be visible before escalation, and why the pressure and vibration drifts should be treated as one monitoring picture rather than independent anomalies. It would add conservative redundancy as well: restating that the loop is still operating, that the pump relation to the loop is the reason vibration matters, that maintenance readiness determines how quickly the state can be stabilized, and that the safety scope changes how every drift should be interpreted by downstream readers.',
      codec: { '§': 1, E: { CL: ['coolant-loop-a', 'system'], P3: ['pump-3', 'asset'], CV: ['containment-vent', 'system'], MT: ['maintenance-team', 'crew'] }, S: { 'CL.pressure_bar': 152.4, 'P3.vibration_mm_s': 5.6, 'CV.mode': 'standby', 'MT.ready': true }, R: ['P3->CL:circulates', 'CV->CL:supports', 'MT->P3:repairs'], 'Δ': ['CL.pressure_bar:148.9->152.4@2026-03-29T19:02Z', 'P3.vibration_mm_s:4.7->5.6@2026-03-29T19:03Z'], 'μ': { scope: 'safety-ops', urg: 0.74, cert: 0.93 } },
    },
  ].map(entry => {
    const report = runTokenReport({
      codec: JSON.stringify(entry.codec),
      natural: entry.natural,
    });
    const scientific = buildScientificContext(report);
    return {
      ctx: entry.ctx,
      nl: scientific.natural_context_tokens,
      s1: scientific.codec_context_tokens,
      ratio: scientific.compression_ratio,
    };
  });

  scientificCache = {
    contextBudget: {
      boot: summarizeBudgetReport(budgetReports.boot),
      calibration: summarizeBudgetReport(budgetReports.calibration),
      protocol: summarizeBudgetReport(budgetReports.protocol),
    },
    compressionCases,
  };

  return scientificCache;
}

function summarizeBudgetReport(report) {
  return {
    medianTokens: Math.round(report.summary.codec_tokens.median),
    spread: {
      min: report.summary.codec_tokens.min,
      max: report.summary.codec_tokens.max,
    },
  };
}

function renderLiveStatus(note = 'watching tests/*.json') {
  console.log(dim('─'.repeat(70)));
  console.log(
    `  ${mint('live')} ${dim('watching')} ${lavender('tests/*.json')} ${dim('·')} ${note}`
  );
  console.log(
    `  ${dim('controls:')} ${gold('r')} ${dim('refresh')}  ${gold('q')} ${dim('quit')}  ${gold('ctrl+c')} ${dim('exit')}`
  );
  console.log();
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  console.clear();
  console.log();

  renderBanner();
  renderContextWindow();
  renderCompressionRatios();

  const benchFiles = loadBenchFiles();
  const structured = loadStructuredResults();

  renderModelLeaderboard(benchFiles);
  renderTestHeatmap(benchFiles);
  renderCorrectionImpact(benchFiles);
  renderJsonModeImpact(structured);
  renderScaleThreshold();
  renderTokenEconomy(benchFiles);
  renderFooter();
}

function runLiveDashboard() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    main();
    console.log(dim('live mode requires an interactive TTY; rendered dashboard once.'));
    console.log();
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let timer = null;
    let closed = false;
    let lastNote = 'watching tests/*.json';

    const render = (note = lastNote) => {
      lastNote = note;
      main();
      renderLiveStatus(lastNote);
    };

    const scheduleRender = note => {
      clearTimeout(timer);
      timer = setTimeout(() => render(note), 120);
    };

    const testsWatcher = fs.watch(TESTS_DIR, { persistent: true }, (eventType, filename) => {
      if (!filename || filename.endsWith('.json') || filename.endsWith('.md')) {
        scheduleRender(filename ? `${eventType}: ${filename}` : 'tests updated');
      }
    });

    const dashboardWatcher = fs.watch(path.join(__dirname, 'dashboard.mjs'), { persistent: true }, () => {
      scheduleRender('dashboard.mjs updated');
    });

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      testsWatcher.close();
      dashboardWatcher.close();
      process.stdout.off?.('resize', onResize);
      process.stdin.off('keypress', onKeypress);
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      console.log();
      resolve();
    };

    const onResize = () => render('terminal resized');
    const onKeypress = (_, key) => {
      if (key?.ctrl && key.name === 'c') {
        cleanup();
        return;
      }

      if (key?.name === 'q') {
        cleanup();
        return;
      }

      if (key?.name === 'r') {
        render('manual refresh');
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
    process.stdout.on?.('resize', onResize);
    process.once('SIGINT', cleanup);

    render();
  });
}

if (ARGS.has('--live')) {
  await runLiveDashboard();
} else {
  main();
}
