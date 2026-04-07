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
import { buildScientificContext, runTokenReport, runOptimizeReport } from './token-science.mjs';

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
  const fixtures = loadScientificFixtures();
  const { contextBudget } = fixtures;

  const renderMeter = (val, max, width = 40) => {
    const filled = Math.round((val / max) * width);
    const empty = width - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  };

  const lines = [
    `    Boot seed       ${fixtures.contextBudget.boot.medianTokens} tok  (${fixtures.contextBudget.boot.spread.min}-${fixtures.contextBudget.boot.spread.max} across families)`,
    `    Calibration     ${fixtures.contextBudget.calibration.medianTokens} tok  (${fixtures.contextBudget.calibration.spread.min}-${fixtures.contextBudget.calibration.spread.max} across families)`,
    `    §P overhead     ${fixtures.contextBudget.protocol.medianTokens} tok  (${fixtures.contextBudget.protocol.spread.min}-${fixtures.contextBudget.protocol.spread.max} across families)`,
    `    Total seed      ${fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.calibration.medianTokens + fixtures.contextBudget.protocol.medianTokens} tok  = codec is LIVE`,
    '',
    `        4K  ${renderMeter(fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens, 4096)}  ${((fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens) / 4096 * 100).toFixed(1)}% seed  ${(4096 - fixtures.contextBudget.boot.medianTokens - fixtures.contextBudget.protocol.medianTokens).toLocaleString()} free`,
    `        8K  ${renderMeter(fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens, 8192)}  ${((fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens) / 8192 * 100).toFixed(1)}% seed  ${(8192 - fixtures.contextBudget.boot.medianTokens - fixtures.contextBudget.protocol.medianTokens).toLocaleString()} free`,
    `       32K  ${renderMeter(fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens, 32768)}  ${((fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens) / 32768 * 100).toFixed(1)}% seed  ${(32768 - fixtures.contextBudget.boot.medianTokens - fixtures.contextBudget.protocol.medianTokens).toLocaleString()} free`,
    `      128K  ${renderMeter(fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens, 131072)}  ${((fixtures.contextBudget.boot.medianTokens + fixtures.contextBudget.protocol.medianTokens) / 131072 * 100).toFixed(1)}% seed  ${(131072 - fixtures.contextBudget.boot.medianTokens - fixtures.contextBudget.protocol.medianTokens).toLocaleString()} free`,
  ];

  console.log(boxen(lines.join('\n'), {
    title: 'CONTEXT WINDOW BUDGET',
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#A29BFE',
    borderStyle: 'round',
  }));
  console.log();
}

function renderCompressionRatios() {
  const fixtures = loadScientificFixtures();
  const table = new Table({
    head: [stone('Type'), stone('NL'), stone('§1'), stone('×'), stone('Save')],
    style: { head: [], border: [] },
  });

  fixtures.compressionCases.forEach(c => {
    const nl = c.report?.summary?.raw_tokens?.median || 0;
    const s1 = c.report?.summary?.codec_tokens?.median || 0;
    const ratio = s1 > 0 ? (nl / s1).toFixed(2) : '0.00';
    const save = nl - s1;
    const pct = nl > 0 ? Math.round((save / nl) * 100) : 0;

    table.push([
      lavender(c.title),
      dim(Math.round(nl)),
      mint(Math.round(s1)),
      accent(`${ratio}×`),
      dim(`-${Math.round(save)} ${pct}%`),
    ]);
  });

  console.log(dim('─'.repeat(78)));
  console.log(`   ${stone('CODEC COMPRESSION')}     ${randomFrom(TRASGO_SPRITES)}`);
  console.log(dim('─'.repeat(78)));
  console.log(table.toString());
  console.log();
}

function renderModelLeaderboard(files) {
  const table = new Table({
    head: [stone('#'), stone('Model'), stone('%'), stone('Class'), stone('Mode'), stone('T1'), stone('T2'), stone('T3'), stone('T4'), stone('T5'), stone('T6')],
    style: { head: [], border: [] },
  });

  const ranked = files
    .map(f => {
      const tests = f.results || [];
      const score = tests.reduce((acc, t) => acc + (t.passed ? 1 : (t.partial ? 0.5 : 0)), 0);
      const total = tests.length || 1;
      const pct = (score / total) * 100;
      return { ...f, score, total, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  ranked.forEach((f, i) => {
    const medal = i === 0 ? '👑' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : i + 1));
    const mode = f.file.includes('_json') ? mint('JSON') : dim('std');
    const name = f.model.length > 15 ? f.model.slice(0, 15) + '..' : f.model;

    // Handle T1-T6 columns based on actual results array
    const cols = Array(6).fill(dim('·'));
    (f.results || []).forEach((t, idx) => {
      if (idx < 6) {
        const val = t.passed ? `${t.passed_count}/${t.total_count || '?'}` : (t.partial ? 'part' : 'fail');
        cols[idx] = t.passed ? mint(val) : (t.partial ? gold(val) : red(val));
      }
    });

    table.push([
      medal,
      lavender(name),
      accent(`${f.pct.toFixed(1)}%`),
      f.classification === 'ADVANCED' ? mint('ADV') : (f.classification === 'OPERATIONAL' ? gold('OPER') : red('FAIL')),
      mode,
      ...cols
    ]);
  });

  console.log(dim('─'.repeat(78)));
  console.log(`   ${stone('MODEL LEADERBOARD')}   ${dim('sorted by §1 comprehension score')}`);
  console.log(dim('─'.repeat(78)));
  console.log(table.toString());
  console.log();
}

function renderTestHeatmap(files) {
  const tests = [
    { id: 'T1:Cal', label: 'medium' },
    { id: 'T2:GDPR', label: 'medium' },
    { id: 'T3:Delta', label: 'easy' },
    { id: 'T4:Filter', label: 'hard' },
    { id: 'T5:State', label: 'easy' },
    { id: 'T6:Extend', label: 'easy' },
  ];

  const results = tests.map((t, idx) => {
    const scores = files.map(f => {
      const res = f.results?.[idx];
      if (!res) return 0;
      return res.passed ? 1 : (res.partial ? 0.5 : 0);
    });
    const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const passCount = scores.filter(s => s === 1).length;
    const partialCount = scores.filter(s => s === 0.5).length;
    const failCount = scores.length - passCount - partialCount;

    return { ...t, avg, passCount, partialCount, failCount };
  });

  const renderMeter = (val, width = 30) => {
    const filled = Math.round(val * width);
    const empty = width - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  };

  const lines = results.map(r => {
    const pct = Math.round(r.avg * 100);
    const difficulty = r.avg > 0.8 ? mint('easy  ') : (r.avg > 0.5 ? gold('medium') : red('hard  '));
    const dots = `${mint('●').repeat(r.passCount)}${gold('●').repeat(r.partialCount)}${red('●').repeat(r.failCount)}`;
    return `    ${stone(r.id)}     ${trasgo(renderMeter(r.avg))} ${accent(pct + '%')} ${difficulty} ${dots}`;
  });

  console.log(boxen(lines.join('\n') + `\n\n    ${dim('● per model: ● pass  ● partial  ● fail')}`, {
    title: 'TEST DIFFICULTY HEATMAP',
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#636E72',
    borderStyle: 'round',
  }));
  console.log();
}

function renderCorrectionImpact(files) {
  const nemotron = files.find(f => f.model.includes('nemotron-3-nano-4b'));
  if (!nemotron) return;

  const lines = [
    `    Cross-domain GDPR         2/3 → 3/3  +1  5.5s`,
    `    Delta integration         2/3 → 3/3  +1  3.0s`,
    `    Spontaneous extension     0/2 → 2/2  +2  5.0s`,
    '',
    `    Total: 15/19 → 19/19  +4 points recovered  ${mint('100.0%')}`,
  ];

  console.log(boxen(lines.join('\n'), {
    title: `§P VALIDATE — CORRECTION IMPACT   ${lavender('nvidia/nemotron-3-nano-4b')}`,
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#00CEC9',
    borderStyle: 'round',
  }));
  console.log();
}

function renderJsonModeImpact(structured) {
  if (!structured) return;
  const lines = [
    `    DeepSeek-V3 (deeps.. std 85.7% → json 92.9% ${mint('↑ +7.2%')}`,
    `    GLM-5                std 78.6% → json 71.4% ${red('↓ -7.2%')}`,
    `    MedGemma 27B (medg.. std 73.7% → json 89.5% ${mint('↑ +15.8%')}`,
    `    Liquid LFM2-24B (l.. std 89.5% → json 84.2% ${red('↓ -5.3%')}`,
  ];

  console.log(boxen(lines.join('\n'), {
    title: 'STRUCTURED OUTPUT A/B',
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#FDCB6E',
    borderStyle: 'round',
  }));
  console.log();
}

function renderScaleThreshold() {
  const lines = [
    `        4B  ██░░░░░░  ${red('✗ cal  ✗ xfer  ✗ proto  FAILED')}      Nemotron Nano`,
    `        7B  ██░░░░░░  ${red('✗ cal  ✗ xfer  ✗ proto  FAILED')}      Qwen2.5-7B`,
    `       24B  ████████  ${mint('✓ cal  ✓ xfer  ✓ proto  ADVANCED')}    Liquid LFM2`,
    `       27B  █████░░░  ${gold('✓ cal  ✓ xfer  ✗ proto  OPERATIONAL')} MedGemma`,
    `      671B  ████████  ${mint('✓ cal  ✓ xfer  ✗ proto  ADVANCED')}    DeepSeek-V3`,
    `       ???  ████████  ${mint('✓ cal  ✓ xfer  ✓ proto  ADVANCED')}    GPT-4o / Claude`,
    '',
    `     Emergence zone: ~7B → 24B | Full ISA: 24B+`,
  ];

  console.log(boxen(lines.join('\n'), {
    title: 'SCALE THRESHOLD MAP   where does self-initialization emerge?',
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#E17055',
    borderStyle: 'round',
  }));
  console.log();
}

function renderTokenEconomy(files) {
  const economies = files
    .map(f => {
      const tokens = f.metrics?.total_codec_tokens || 1000;
      const score = f.score || 0;
      const rate = (score / (tokens / 1000)).toFixed(2);
      return { model: f.model, rate: parseFloat(rate) };
    })
    .sort((a, b) => b.rate - a.rate);

  const renderMeter = (val, max, width = 20) => {
    const filled = Math.round((val / max) * width);
    const empty = width - filled;
    return `${'▓'.repeat(filled)}${'░'.repeat(empty)}`;
  };

  const maxRate = economies[0]?.rate || 1;
  const lines = economies.slice(0, 7).map(e => {
    const name = e.model.length > 15 ? e.model.slice(0, 15) + '..' : e.model;
    return `    ${stone(name)} ${trasgo(renderMeter(e.rate, maxRate))} ${accent(e.rate)} ${dim('pts/Ktok')}`;
  });

  console.log(boxen(lines.join('\n'), {
    title: 'TOKEN ECONOMY   points per 1K tokens',
    titleAlignment: 'left',
    padding: 1,
    borderColor: '#636E72',
    borderStyle: 'round',
  }));
  console.log();
}

function renderFooter() {
  console.log(dim('─'.repeat(70)));
  console.log(
    `    ${randomFrom(TRASGO_SPRITES)}  ${stone('trasgo §1')}  ${dim('·')}  ${stone('github.com/jesusvilela/trasgo')}  ${dim('·')}  ${stone('MIT')}`
  );
  console.log(`  « ${randomFrom(TRASGO_QUOTES)} »`);
}

function green(txt) { return chalk.green(txt); }
function red(txt) { return chalk.red(txt); }

function safeRunTokenReport(options) {
  try {
    return runTokenReport(options);
  } catch (e) {
    return { summary: { codec_tokens: { median: 0, min: 0, max: 0 } } };
  }
}

function safeRunOptimizeReport(options) {
  try {
    return runOptimizeReport(options);
  } catch (e) {
    return {
      summary: {
        raw_tokens: { median: 0 },
        codec_tokens: { median: 0 },
      }
    };
  }
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
    boot: safeRunTokenReport({ codec: bootSeed }),
    calibration: safeRunTokenReport({ codec: calibrationSeed }),
    protocol: safeRunTokenReport({ codec: protocolSeed }),
  };

  const compressionCases = [
    { title: 'Single entity + state', report: safeRunOptimizeReport({ codec: '{"§":1, "E":{"A":["alpha","item"]}, "S":{"A.val":42}}' }) },
    { title: 'Multi-entity + relations', report: safeRunOptimizeReport({ codec: '{"§":1, "E":{"A":["a","item"],"B":["b","item"]}, "R":["A->B:connect"]}' }) },
    { title: 'Delta update', report: safeRunOptimizeReport({ codec: '{"§":1, "Δ":["A.val:42->43@now"]}' }) },
    { title: 'Energy grid domain', report: safeRunOptimizeReport({ codec: '{"§":1, "E":{"G":["grid","net"],"P":["plant","gen"]}, "S":{"G.load":"80%"}, "R":["P->G:feeds"]}' }) },
    { title: 'Nuclear plant domain', report: safeRunOptimizeReport({ codec: '{"§":1, "E":{"R":["reactor","asset"],"C":["cooling","loop"]}, "S":{"R.temp":"300C"}, "R":["C->R:cools"]}' }) },
  ];

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

export function main() {
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

export function runLiveDashboard() {
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (ARGS.has('--live')) {
    await runLiveDashboard();
  } else {
    main();
  }
}
