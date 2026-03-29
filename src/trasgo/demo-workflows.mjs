#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..');
const generatedDir = path.join(repoRoot, 'demos', 'generated');

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value, digits = 1) {
  return `${round(value * 100, digits)}%`;
}

function estimateCodecTokens(packet) {
  return Math.ceil(JSON.stringify(packet).length / 4);
}

function buildCtxContext(packet, naturalContextTokens) {
  const codecContextTokens = estimateCodecTokens(packet);
  return {
    natural_context_tokens: naturalContextTokens,
    codec_context_tokens: codecContextTokens,
    compression_ratio: round(naturalContextTokens / codecContextTokens, 2),
    window_4k_share: round(codecContextTokens / 4096, 4),
    window_32k_share: round(codecContextTokens / 32768, 4),
    estimation_method: 'Narrative envelope estimate vs. codec JSON length / 4 heuristic.',
  };
}

function ensureGeneratedDir() {
  fs.mkdirSync(generatedDir, { recursive: true });
}

function factoryCopilotDemo() {
  const plannedStopMinutes = 90;
  const predictedOutageHours = 6.5;
  const hourlyLossUsd = 13000;
  const interventionCostUsd = 7600;
  const avoidedLossUsd = predictedOutageHours * hourlyLossUsd;
  const netSavingsUsd = avoidedLossUsd - interventionCostUsd;
  const roi = netSavingsUsd / interventionCostUsd;
  const riskScore = 0.83;

  const packet = {
    '§': 1,
    E: {
      L3: ['packing-line-3', 'asset'],
      BRG: ['drive-end-bearing', 'component'],
      INV: ['bearing-kit', 'inventory'],
      OPS: ['shift-supervisor', 'person'],
      QA: ['yield-monitor', 'service'],
    },
    S: {
      'L3.vibration_mm_s': 6.7,
      'L3.changeover_backlog_min': 57,
      'BRG.temp_c': 88,
      'INV.on_hand': 1,
      'QA.fp_yield_pct': 96.9,
    },
    R: ['BRG->L3:limits', 'OPS->L3:operates', 'QA->L3:measures', 'INV->BRG:replaces'],
    'Δ': [
      'L3.vibration_mm_s:5.1->6.7@2026-03-29T14:10Z',
      'BRG.temp_c:74->88@2026-03-29T14:12Z',
      'QA.fp_yield_pct:98.4->96.9@2026-03-29T14:14Z',
      'L3.changeover_backlog_min:42->57@2026-03-29T14:16Z',
    ],
    'μ': {
      scope: 'operations',
      urg: 0.86,
      cert: 0.91,
    },
  };

  const ctxContext = buildCtxContext(packet, 472);
  const functionalGain = {
    decision_latency_minutes_before: 18,
    decision_latency_minutes_after: 4,
    operator_surface_before: 'spreadsheet + maint. chat + QA dashboard',
    operator_surface_after: 'single codec brief + ranked action plan',
    avoided_downtime_hours: predictedOutageHours,
    net_savings_usd: netSavingsUsd,
  };

  return {
    id: 'factory-copilot',
    title: 'Factory Copilot',
    lane: 'operative usefulness',
    summary: 'Predictive maintenance triage for a packaging line before a bearing failure becomes a full-line outage.',
    intent_examples: [
      'run the factory copilot demo',
      'show me the downtime workflow',
      'launch the operations copilot',
    ],
    scenario: {
      line: 'Line 3 / packaging',
      trigger: 'Bearing vibration, thermal drift, and yield loss climbing in the same hour.',
      operator_goal: 'Schedule the smallest safe intervention before second shift absorbs the outage.',
    },
    ctx_context: ctxContext,
    scientific_view: {
      claim: 'The same operational state collapses into a smaller executable context without losing the action signal.',
      confirmation: `Factory Copilot compresses roughly ${ctxContext.natural_context_tokens} narrative tokens into roughly ${ctxContext.codec_context_tokens} codec tokens while preserving the same intervention decision.`,
    },
    functional_gain: functionalGain,
    metrics: {
      risk_score: riskScore,
      planned_stop_minutes: plannedStopMinutes,
      predicted_outage_hours: predictedOutageHours,
      avoided_loss_usd: avoidedLossUsd,
      intervention_cost_usd: interventionCostUsd,
      net_savings_usd: netSavingsUsd,
      roi_multiple: round(roi, 2),
    },
    packet,
    recommendations: [
      'Take a controlled 90-minute micro-stop before shift change and swap the drive-end bearing.',
      'Pull the only spare bearing now and reorder two kits before the night shift starts.',
      'Route QA to line-side verification for the first 20 pallets after restart to recover yield quickly.',
    ],
    economic_case: {
      headline: `${money(netSavingsUsd)} net same-day savings by preventing a ${predictedOutageHours}-hour outage.`,
      avoided_loss: money(avoidedLossUsd),
      intervention_cost: money(interventionCostUsd),
      roi: `${round(roi, 1)}x`,
    },
    output: {
      decision: 'Controlled stop now',
      rationale: 'The combined drift in vibration, temperature, backlog, and yield makes the failure mode operationally near-term and economically asymmetric.',
    },
  };
}

function revenueGuardDemo() {
  const arrUsd = 180000;
  const baseGrossMargin = 0.28;
  const originalDiscount = 0.18;
  const requestedDiscount = 0.29;
  const customSlaCostUsd = 12000;
  const onboardingCostUsd = 22000;
  const termDaysBefore = 30;
  const termDaysAfter = 75;

  const baselineGrossProfitUsd = arrUsd * baseGrossMargin;
  const discountedRevenueUsd = arrUsd * (1 - requestedDiscount);
  const currentGrossProfitUsd = discountedRevenueUsd - customSlaCostUsd - onboardingCostUsd - (arrUsd * (1 - baseGrossMargin));
  const currentMargin = currentGrossProfitUsd / discountedRevenueUsd;
  const targetDiscount = 0.2;
  const remediatedRevenueUsd = arrUsd * (1 - targetDiscount) + onboardingCostUsd;
  const remediatedGrossProfitUsd = remediatedRevenueUsd - customSlaCostUsd - (arrUsd * (1 - baseGrossMargin));
  const recoveredGrossProfitUsd = remediatedGrossProfitUsd - currentGrossProfitUsd;
  const cashGapUsd = arrUsd * 0.5 * ((termDaysAfter - termDaysBefore) / 365);

  const packet = {
    '§': 1,
    E: {
      DEAL: ['enterprise-renewal', 'quote'],
      BUY: ['northwind-biotech', 'customer'],
      SLA: ['custom-sla', 'service'],
      FIN: ['collections-team', 'function'],
      CS: ['onboarding-squad', 'service'],
    },
    S: {
      'DEAL.arr_usd': arrUsd,
      'DEAL.discount_pct': 29,
      'DEAL.payment_terms_days': termDaysAfter,
      'SLA.cost_usd': customSlaCostUsd,
      'CS.onboarding_cost_usd': onboardingCostUsd,
    },
    R: ['BUY->DEAL:requests', 'SLA->DEAL:loads', 'FIN->DEAL:collects', 'CS->DEAL:launches'],
    'Δ': [
      `DEAL.discount_pct:${originalDiscount * 100}->${requestedDiscount * 100}@2026-03-29T09:20Z`,
      `DEAL.payment_terms_days:${termDaysBefore}->${termDaysAfter}@2026-03-29T09:22Z`,
      `SLA.cost_usd:0->${customSlaCostUsd}@2026-03-29T09:24Z`,
      `CS.onboarding_cost_usd:0->${onboardingCostUsd}@2026-03-29T09:25Z`,
    ],
    'μ': {
      scope: 'revenue-operations',
      urg: 0.81,
      cert: 0.9,
    },
  };

  const ctxContext = buildCtxContext(packet, 508);
  const functionalGain = {
    review_cycles_before: 3,
    review_cycles_after: 1,
    operator_surface_before: 'quote doc + finance notes + Slack exceptions',
    operator_surface_after: 'single codec brief + guardrail recommendations',
    recovered_gross_profit_usd: recoveredGrossProfitUsd,
    cash_gap_usd: cashGapUsd,
  };

  return {
    id: 'revenue-guard',
    title: 'Revenue Guard',
    lane: 'economic usefulness',
    summary: 'Quote-approval guardrail that catches discount creep, unpaid services, and cash drag before signature.',
    intent_examples: [
      'run the revenue guard demo',
      'launch the margin workflow',
      'show me the deal desk demo',
    ],
    scenario: {
      account: 'Northwind Biotech renewal',
      trigger: 'Procurement asks for deeper discounting, custom SLA coverage, and slower payment terms in the same revision.',
      operator_goal: 'Protect gross margin while keeping the deal winnable.',
    },
    ctx_context: ctxContext,
    scientific_view: {
      claim: 'Quote governance becomes faster when pricing, services, and cash deltas share one executable context.',
      confirmation: `Revenue Guard compresses roughly ${ctxContext.natural_context_tokens} narrative tokens into roughly ${ctxContext.codec_context_tokens} codec tokens while preserving the guardrail verdict and economics.`,
    },
    functional_gain: functionalGain,
    metrics: {
      arr_usd: arrUsd,
      baseline_margin: round(baseGrossMargin, 3),
      requested_discount: round(requestedDiscount, 3),
      current_margin: round(currentMargin, 3),
      remediated_margin: round(remediatedGrossProfitUsd / remediatedRevenueUsd, 3),
      recovered_gross_profit_usd: round(recoveredGrossProfitUsd, 0),
      cash_gap_usd: round(cashGapUsd, 0),
    },
    packet,
    recommendations: [
      'Cap the discount at 20% unless the custom SLA is billed as a separate premium line item.',
      'Recover onboarding cost explicitly instead of burying it inside ARR.',
      'Hold payment terms at 45 days or require annual prepay to offset working-capital drag.',
    ],
    economic_case: {
      headline: `${money(recoveredGrossProfitUsd)} gross profit recovered and ${money(cashGapUsd)} less cash drag with a guarded quote revision.`,
      current_margin: pct(currentMargin),
      remediated_margin: pct(remediatedGrossProfitUsd / remediatedRevenueUsd),
      recovered_gross_profit: money(recoveredGrossProfitUsd),
    },
    output: {
      decision: 'Revise quote before approval',
      rationale: 'The requested revision combines price leakage, unfunded service load, and cash delay into one unattractive deal shape.',
    },
  };
}

const DEMOS = {
  'factory-copilot': factoryCopilotDemo,
  'revenue-guard': revenueGuardDemo,
};

export function listDemoWorkflows() {
  return Object.keys(DEMOS).map(id => DEMOS[id]());
}

export function getDemoWorkflow(id) {
  return DEMOS[id]?.() || null;
}

export function runDemoWorkflow(id, options = {}) {
  const demo = getDemoWorkflow(id);
  if (!demo) {
    throw new Error(`unknown demo workflow: ${id}`);
  }

  ensureGeneratedDir();
  const artifactPath = options.outPath
    ? path.resolve(repoRoot, options.outPath)
    : path.join(generatedDir, `${demo.id}.json`);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(demo, null, 2));

  return {
    ...demo,
    artifact_path: artifactPath,
  };
}

function printHumanDemo(result) {
  console.log(`${result.title} Demo`);
  console.log(`  lane        ${result.lane}`);
  console.log(`  decision    ${result.output.decision}`);
  console.log(`  impact      ${result.economic_case.headline}`);
  console.log(`  packet      §1 packet with ${result.packet['Δ'].length} deltas`);
  console.log();
  console.log('CTX_CONTEXT');
  console.log(`  natural     ~${result.ctx_context.natural_context_tokens} tok`);
  console.log(`  codec       ~${result.ctx_context.codec_context_tokens} tok`);
  console.log(`  compression ~${result.ctx_context.compression_ratio}x`);
  console.log(`  4k share    ${pct(result.ctx_context.window_4k_share)}`);
  console.log(`  method      ${result.ctx_context.estimation_method}`);
  console.log();
  console.log('Functional Gain');
  for (const [key, value] of Object.entries(result.functional_gain)) {
    console.log(`  ${key.padEnd(28)} ${value}`);
  }
  console.log();
  console.log('Scientific View');
  console.log(`  ${result.scientific_view.confirmation}`);
  console.log();
  console.log('Action Plan');
  result.recommendations.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`);
  });
  console.log();
  console.log('Artifact');
  console.log(`  ${result.artifact_path}`);
  console.log();
}

function main() {
  const [, , command = 'list', maybeId, ...rest] = process.argv;
  const args = new Set(rest);

  if (command === 'list') {
    for (const demo of listDemoWorkflows()) {
      console.log(`${demo.id}\t${demo.title}\t${demo.summary}`);
    }
    return;
  }

  if (command === 'run') {
    const id = maybeId;
    if (!id) {
      throw new Error('usage: demo-workflows.mjs run <factory-copilot|revenue-guard> [--json]');
    }
    const result = runDemoWorkflow(id);
    if (args.has('--json')) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    printHumanDemo(result);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
