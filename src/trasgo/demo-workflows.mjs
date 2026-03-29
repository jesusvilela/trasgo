#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildScientificContext, runTokenReport } from './token-science.mjs';

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

function buildCtxContext(packet, naturalNarrative) {
  const report = runTokenReport({
    codec: JSON.stringify(packet),
    natural: naturalNarrative,
  });
  return buildScientificContext(report);
}

function buildCompressionConfirmation(label, ctxContext, preservedSignal) {
  const naturalRange = ctxContext.family_spread.natural_tokens;
  const codecRange = ctxContext.family_spread.codec_tokens;
  const ratioRange = ctxContext.family_spread.compression_ratio;
  const naturalText = naturalRange
    ? `${naturalRange.min}-${naturalRange.max} natural tokens`
    : `${ctxContext.natural_context_tokens} natural tokens`;
  const codecText = `${codecRange.min}-${codecRange.max} codec tokens`;
  const ratioText = ratioRange
    ? `${ratioRange.min}x-${ratioRange.max}x`
    : `${ctxContext.compression_ratio}x`;

  return `${label} compresses ${naturalText} into ${codecText} across the tokenizer battery, yielding ${ratioText} compression while preserving ${preservedSignal}. Best codec family: ${ctxContext.best_family}. Worst codec family: ${ctxContext.worst_family}. ${ctxContext.effective_context_note}`;
}

function printBatteryRows(ctxContext) {
  for (const entry of ctxContext.battery) {
    const natural = entry.natural_tokens ?? '-';
    const ratio = entry.compression_ratio ?? '-';
    console.log(`  ${entry.id.padEnd(14)} ${String(natural).padStart(4)} -> ${String(entry.codec_tokens).padStart(4)} tok  ${String(ratio).padStart(5)}x`);
  }
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

  const naturalNarrative = [
    'Line 3 on the packaging floor is showing a coupled failure pattern before second shift and the operating team is trying to decide whether to intervene now or keep the line running through the backlog.',
    'The drive-end bearing has been warming steadily for the last hour. What started as a routine thermal drift at 74C is now sitting at 88C, which places the component close to the upper edge of the line-specific operating envelope.',
    'At the same time, vibration on the line has moved from 5.1 to 6.7 millimeters per second. Maintenance history on this asset says that when temperature and vibration rise together, the probability of an uncontrolled stop goes up sharply, especially if the next changeover is already under pressure.',
    'Operations is also watching a backlog problem. Changeover delay has moved from 42 minutes to 57 minutes, which means the line is more exposed to a disruption because there is less slack to absorb a failure during the current production window.',
    'QA has independently reported that first-pass yield is down from 98.4 percent to 96.9 percent. That is not catastrophic on its own, but in combination with the thermal and vibration signature it suggests the line is already degrading in a way the operators can feel on finished output.',
    'Inventory is constrained. There is only one bearing kit available on site for this exact component, so if the team decides to act they can do it immediately, but if they defer and the spare is consumed later during an unplanned stop, recovery options get worse rather than better.',
    'The shift supervisor needs a concrete recommendation, not a narrative postmortem. The real decision is whether to accept a short controlled micro-stop before shift change, replace the drive-end bearing while labor and QA attention are still available, and restart under supervision, or push forward and risk a multi-hour outage later when the operational asymmetry is much worse.',
    'From an economic perspective the line is carrying roughly thirteen thousand dollars of lost output per hour during a full outage. A short planned intervention would cost labor, parts, and schedule friction, but it would almost certainly be cheaper than absorbing a six-and-a-half-hour failure if the bearing lets go under load.',
    'A full natural-language handoff would also restate who is involved and what each team is seeing: maintenance sees the bearing drift, operations sees the backlog, QA sees the yield slip, and inventory sees the spare-parts limit. Human operators usually need that coordination context spelled out explicitly because it lives in different dashboards and different conversations.',
    'The memo would further explain that the current state is still recoverable in a planned way. Restart validation can be contained to the first twenty pallets after intervention, and the crew can still choose a moment that minimizes customer impact. That window is operationally valuable and should be treated as part of the state, not as an afterthought.',
    'If the line is allowed to drift into an unplanned stop, the team loses that choice architecture. The outage becomes reactive, the same spare kit is still consumed, yield recovery starts later, and the second shift inherits a problem that could have been contained in the current shift.',
    'That is why the natural-language baseline for this decision is large: it has to preserve sensor drift, quality drift, maintenance history, spare-part posture, restart procedure, labor timing, and economic asymmetry before the operator can safely choose the smallest effective intervention.',
  ].join(' ');
  const ctxContext = buildCtxContext(packet, naturalNarrative);
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
      confirmation: buildCompressionConfirmation('Factory Copilot', ctxContext, 'the same intervention decision'),
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

  const naturalNarrative = [
    'Northwind Biotech is renegotiating an enterprise renewal and the commercial team is under pressure to close the deal quickly because the account matters strategically and the quarter is still open.',
    'Procurement has bundled several asks into one revision rather than negotiating them separately. First, they want the discount raised from 18 percent to 29 percent. Second, they want payment terms stretched from 30 days to 75 days. Third, they want custom SLA coverage added even though the current quote structure does not explicitly recover that service burden.',
    'Each of those requests would be manageable in isolation, but together they create a materially different deal shape. Price leakage, unfunded service delivery, and slower cash collection are all hitting the same commercial object at the same moment.',
    'The base annual contract value is one hundred and eighty thousand dollars. Customer success is expecting a twenty-two-thousand-dollar onboarding burden to deliver the expanded scope properly, and the service organization is carrying another twelve-thousand-dollar custom SLA load if the exception is granted.',
    'Finance has already flagged that longer payment terms create working-capital drag, especially if half the contracted value is effectively delayed relative to the current baseline. Deal desk is separately worried that the requested discount is masking costs that should either be billed explicitly or traded for stronger commercial terms.',
    'The approver does not want three disconnected narratives from sales, customer success, and collections. They need one compressed decision context that answers the real operating question: if this revision is accepted as written, what happens to gross profit, margin quality, and cash timing; and if the quote is revised, which guardrail changes recover value without making the deal unwinnable.',
    'In practical terms the choice is whether to approve a structurally unattractive quote, send back a guarded revision that caps the discount and recovers onboarding or SLA cost, or escalate the exception to a higher approval band. The point of compression here is to preserve all three economic forces in one executable packet rather than burying them in a long thread of quote notes and side-channel comments.',
    'A full ordinary-language commercial memo would also explain the behavioral risk. If the organization signs off on a renewal that combines deeper discounting, slower payment, and extra service load in one motion, future procurement cycles are likely to anchor on that structure and treat it as precedent rather than exception.',
    'The account team therefore needs the natural-language baseline to carry more than arithmetic. It needs to carry negotiation shape, cost recovery logic, cash-timing consequences, approval precedent, and the distinction between a winnable concession and an economically distorted contract.',
    'The memo would also make explicit that there is still a path to close: reduce the discount closer to twenty percent, recover onboarding explicitly, and either tighten payment terms or exchange them for a stronger commitment such as annual prepay. That richer narrative is what the compressed packet is meant to preserve without losing decision quality.',
    'In other words, the natural briefing is long because humans have to reconcile pricing, service delivery, collections posture, and precedent management at once. The compressed packet is valuable only if it can preserve that same multi-axis decision surface while shrinking the context footprint materially.',
  ].join(' ');
  const ctxContext = buildCtxContext(packet, naturalNarrative);
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
      confirmation: buildCompressionConfirmation('Revenue Guard', ctxContext, 'the guardrail verdict and economics'),
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
  console.log(`  natural     ${result.ctx_context.natural_context_tokens} tok median`);
  console.log(`  codec       ${result.ctx_context.codec_context_tokens} tok median`);
  console.log(`  compression ${result.ctx_context.compression_ratio}x median`);
  console.log(`  4k share    ${pct(result.ctx_context.window_4k_share)}`);
  console.log(`  spread      ${result.ctx_context.family_spread.codec_tokens.min}-${result.ctx_context.family_spread.codec_tokens.max} codec tok`);
  console.log(`  method      ${result.ctx_context.exact_method}`);
  console.log(`  note        ${result.ctx_context.effective_context_note}`);
  console.log();
  console.log('Tokenizer Battery');
  printBatteryRows(result.ctx_context);
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
