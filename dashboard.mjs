#!/usr/bin/env node
/**
 * TRASGO §1 — Context Window & Codec Observatory
 * Post-GenZ CLI dashboard with Galician trasgo energy
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
import { buildScientificContext, runTokenReport, runOptimizeReport } from './src/trasgo/token-science.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname;
const TESTS_DIR = path.join(REPO_ROOT, 'src', 'tests');
const ARGS = new Set(process.argv.slice(2));
let scientificCache = null;

function getTerminalWidth() {
  const envWidth = Number.parseInt(process.env.COLUMNS || '', 10);
  return process.stdout?.columns || process.stderr?.columns || envWidth || 120;
}

const TERMINAL_WIDTH = getTerminalWidth();

// ── Trasgo palette ──────────────────────────────────────────────────
const trasgo = gradient(['#7B2FBE', '#E84393', '#FD79A8', '#FDCB6E', '#00CEC9']);
const stone = gradient(['#636E72', '#B2BEC3', '#DFE6E9']);
const dim = chalk.hex('#636E72');
const accent = chalk.hex('#E84393');
const mint = chalk.hex('#00CEC9');
const gold = chalk.hex('#FDCB6E');
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

function green(txt) { return chalk.green(txt); }
function red(txt) { return chalk.red(txt); }

// ── Load bench data ─────────────────────────────────────────────────
function loadBenchFiles() {
  if (!fs.existsSync(TESTS_DIR)) return [];
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
      let pct = f.pct || 0;
      let classification = f.classification || 'UNKNOWN';
      
      if (typeof f.results === 'object' && !Array.isArray(f.results)) {
        // Handle object-based results structure
        const values = Object.values(f.results);
        const total = values.length || 1;
        const passed = values.filter(v => v.score === v.max).length;
        pct = f.pct || (passed / total) * 100;
      } else if (Array.isArray(f.results)) {
        // Handle array-based results structure
        const total = f.results.length || 1;
        const score = f.results.reduce((acc, t) => acc + (t.passed ? 1 : (t.partial ? 0.5 : 0)), 0);
        pct = (score / total) * 100;
      }

      return { ...f, pct, classification };
    })
    .sort((a, b) => b.pct - a.pct);

  ranked.forEach((f, i) => {
    const medal = i === 0 ? '👑' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : i + 1));
    const mode = f.json_mode ? mint('JSON') : dim('std');
    const name = f.model ? (f.model.length > 15 ? f.model.slice(0, 15) + '..' : f.model) : 'unknown';

    const cols = Array(6).fill(dim('·'));
    if (Array.isArray(f.results)) {
      f.results.forEach((t, idx) => {
        if (idx < 6) {
          const val = t.passed ? `${t.passed_count}/${t.total_count || '?'}` : (t.partial ? 'part' : 'fail');
          cols[idx] = t.passed ? mint(val) : (t.partial ? gold(val) : red(val));
        }
      });
    } else if (typeof f.results === 'object' && f.results !== null) {
      Object.values(f.results).forEach((t, idx) => {
        if (idx < 6) {
          const val = `${t.score}/${t.max}`;
          cols[idx] = t.score === t.max ? mint(val) : (t.score > 0 ? gold(val) : red(val));
        }
      });
    }

    table.push([
      medal,
      lavender(name),
      accent(`${f.pct.toFixed(1)}%`),
      f.classification.includes('ADVANCED') ? mint('ADV') : (f.classification.includes('OPERATIONAL') ? gold('OPER') : red('FAIL')),
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

function renderFooter() {
  console.log(dim('─'.repeat(70)));
  console.log(
    `    ${randomFrom(TRASGO_SPRITES)}  ${stone('trasgo §1')}  ${dim('·')}  ${stone('github.com/jesusvilela/trasgo')}  ${dim('·')}  ${stone('MIT')}`
  );
  console.log(`  « ${randomFrom(TRASGO_QUOTES)} »`);
}

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

  const loadFile = (relPath) => {
    const fullPath = path.join(REPO_ROOT, relPath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
  };

  const bootSeed = loadFile('src/boot.md');
  const calibrationSeed = 'Dual-query calibration fixture.';
  const protocolSeed = loadFile('src/hyperprotocol.md');

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

export function main() {
  console.clear();
  console.log();

  renderBanner();
  renderContextWindow();
  renderCompressionRatios();

  const benchFiles = loadBenchFiles();
  renderModelLeaderboard(benchFiles);
  renderFooter();
}

export function runLiveDashboard() {
  return new Promise(resolve => {
    main();
    resolve();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
