"""
§1 Codec — Scale Threshold & ISA Portability Research Suite
Runs the full calibration battery against all available local models (LM Studio)
and frontier APIs, testing:
  1. Scale threshold: where does self-initialization emerge?
  2. Cross-runtime portability: same boot seed, different architectures
  3. Context-length degradation: how does comprehension decay with context size?
  4. Protocol execution depth: can the model execute §P opcodes?
  5. State consistency: after N deltas, is state correct?

Results are written to tests/research_results.json and tests/research_report.html
"""

import json
import os
import sys
import io
import time
import urllib.request
import urllib.error
import textwrap
import re
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Configuration ─────────────────────────────────────────────────────

LM_STUDIO_URL = "http://192.168.56.1:1234/v1"
OPENAI_URL = "https://api.openai.com/v1"
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

RESULTS_JSON = os.path.join(os.path.dirname(__file__), "research_results.json")
REPORT_HTML = os.path.join(os.path.dirname(__file__), "research_report.html")

# ── Boot Seed (ISA microcode) ─────────────────────────────────────────

BOOT_SEED = textwrap.dedent("""\
§1|BOOT

EX1:
{"§":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},"S":{"A.temp":"+1.5C threshold","B.status":"Green Deal active"},"R":["A->B:constrains","C->B:leads"],"D":["A.temp:+1.2->+1.5@2025-Q3","B.status:proposed->active@2024-01"],"mu":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, which became active Jan 2024. Temperature threshold revised to 1.5C in Q3 2025."

EX2:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L->K:hedges"],"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}
= "Long 200 shares TSLA at $180, down 12%. Macro overlay hedges via gold ETC. Weight reduced 12% to 8% in March 2026. Hedge triggers when VIX>28."

EX3:
{"§":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},"S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},"R":["V->O:occupies","I->V:payload"],"D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],"mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}
= "Sentinel-6 satellite in LEO at 1336km, 66 deg inclination, 112-min period. Poseidon-4 altimeter switched to SAR mode Feb 2026. Power shifted to eco mode March 2026."
""")

# ── Test Prompts ──────────────────────────────────────────────────────

TESTS = {
    "T1_calibration": {
        "name": "Semantic Reconstruction + Dual Query",
        "category": "calibration",
        "prompt": textwrap.dedent("""\
            §1|CALIBRATE

            CONTEXT:
            {"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L->K:hedges"],"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}

            Q_codec: What changed for K and why?
            Q_natural: What happened to the Tesla position and what's the hedging strategy?
            """),
        "checks": [
            ("weight_reduction", r"0\.12.*0\.08|12%.*8%|weight.*reduc|reduced.*weight"),
            ("timing", r"march.*2026|2026.*march|2026-03"),
            ("hedge_strategy", r"gold.*ETC|ETC.*gold|hedg"),
            ("vix_trigger", r"VIX.*28|28.*VIX"),
        ]
    },
    "T2_cross_domain": {
        "name": "Cross-Domain Transfer (GDPR — novel domain)",
        "category": "isa_portability",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],"H":["DPA-Ireland","regulator"]},"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B"},"R":["H->G:investigates","F->G:targets"],"D":["F.status:complaint->under-investigation@2026-01","H.priority:routine->elevated@2026-02"],"mu":{"scope":"regulatory","urg":0.6,"cert":0.65}}

            What's the worst case for G?
            """),
        "checks": [
            ("fine_derivation", r"84.*M|84.*million|4%.*2\.1|2\.1.*4%"),
            ("priority_escalation", r"elevat|routine.*elevated|priority.*increas"),
            ("risk_context", r"investigat|under.*investigation|regulat"),
        ]
    },
    "T3_delta_integration": {
        "name": "Delta Integration (base + update -> merged state)",
        "category": "state_machine",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},"R":["T->P:executes"],"mu":{"scope":"project","urg":0.3,"cert":0.9}}

            §1|D-UPDATE
            {"§":1,"D":["T.size:8->5@2026-03-20","P.status:on-track->at-risk@2026-03-20"],"mu":{"urg":0.7,"cert":0.85}}

            What's the situation now?
            """),
        "checks": [
            ("team_merged", r"5|five|reduced.*from.*8|8.*to.*5"),
            ("status_merged", r"at.risk|at risk"),
            ("urgency_noted", r"urg|critical|serious|concern"),
        ]
    },
    "T4_protocol_filter": {
        "name": "Protocol Execution: FILTER opcode",
        "category": "protocol_execution",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT — Multi-source

            Packet A:
            {"§":1,"E":{"A":["Arctic-ice","geo"]},"S":{"A.extent":"10.2M-km2"},"D":["A.extent:10.8->10.2@2026-Q1"],"mu":{"scope":"climate","urg":0.8,"cert":0.9}}

            Packet B:
            {"§":1,"E":{"B":["NorthSea-wind","energy"]},"S":{"B.capacity":"48GW"},"D":["B.util:0.58->0.61@2026-Q1"],"mu":{"scope":"energy","urg":0.3,"cert":0.85}}

            Packet C:
            {"§":1,"E":{"C":["EU-carbon-border","policy"]},"S":{"C.price":"87EUR/ton"},"D":["C.price:72->87@2026-Q1"],"mu":{"scope":"regulatory","urg":0.5,"cert":0.8}}

            {"§P":"filter","by":"mu.urg","order":"desc","top_k":2}

            Which packets survive the filter and why?
            """),
        "checks": [
            ("correct_ranking", r"A.*0\.8|Arctic.*highest|A.*first"),
            ("correct_top2", r"A.*C|Arctic.*carbon|0\.8.*0\.5"),
            ("b_excluded", r"B.*excluded|B.*removed|lowest|0\.3.*excluded|wind.*not"),
            ("executed_not_described", None),  # Manual check
        ]
    },
    "T5_rlhf_escape": {
        "name": "RLHF Escape Detection",
        "category": "behavioral",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,"E":{"W":["NordWind-IV","wind-farm"],"G":["DE-grid","grid"]},"S":{"W.output":"112MW","G.demand":"340MW"},"R":["W->G:feeds"],"D":["W.output:145->112@2026-03"],"mu":{"scope":"energy","urg":0.5,"cert":0.85}}

            What fraction of demand does W cover?
            """),
        "checks": [
            ("direct_answer", r"33%|32\.9|112.*340|0\.33|one.third|about a third"),
            ("no_rlhf_leak", None),  # Checked separately
        ]
    },
    "T6_context_scaling_small": {
        "name": "Context Scaling: 2 entities",
        "category": "context_length",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,
             "E":{"A":["reactor-core","component"],"B":["cooling-sys","component"]},
             "S":{"A.temp":"850C","A.flux":"1.2e14","B.flow":"4200kg/s","B.inlet":"290C"},
             "R":["B->A:cools"],
             "D":["A.temp:820->850@2026-03"],
             "mu":{"scope":"nuclear","urg":0.4,"cert":0.9}}

            What is A's thermal status?
            """),
        "checks": [
            ("temp_stated", r"850|temperature"),
            ("trend_noted", r"820.*850|increas|rising"),
            ("cooling_context", r"cool|B|flow"),
        ]
    },
    "T7_context_scaling_medium": {
        "name": "Context Scaling: 6 entities",
        "category": "context_length",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,
             "E":{"A":["reactor-core","component"],"B":["cooling-pri","component"],
                  "C":["cooling-sec","component"],"D":["turbine","component"],
                  "E2":["generator","component"],"F":["control-rod","component"]},
             "S":{"A.temp":"850C","A.flux":"1.2e14","A.power":"3200MWt",
                  "B.flow":"4200kg/s","B.inlet":"290C","B.outlet":"325C",
                  "C.flow":"3800kg/s","C.inlet":"220C","C.outlet":"280C",
                  "D.rpm":"3000","D.efficiency":"0.34",
                  "E2.output":"1088MWe","E2.grid-sync":"yes",
                  "F.position":"62%","F.worth":"8200pcm"},
             "R":["B->A:cools","C->B:transfers","C->D:drives","D->E2:generates","F->A:controls"],
             "D":["A.temp:820->850@2026-03","F.position:65->62@2026-03",
                  "E2.output:1100->1088@2026-03"],
             "mu":{"scope":"nuclear","urg":0.5,"cert":0.85}}

            Trace the energy conversion chain from A to E2. What's the overall efficiency?
            """),
        "checks": [
            ("chain_traced", r"core.*cool.*turbine.*generator|A.*B.*D.*E|thermal.*electric"),
            ("efficiency_computed", r"34%|0\.34|1088.*3200|33|34"),
            ("control_rod_context", r"control.*rod|F.*position|62%"),
        ]
    },
    "T8_context_scaling_large": {
        "name": "Context Scaling: 10 entities with cross-references",
        "category": "context_length",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,
             "E":{"A":["reactor-core","component"],"B":["cooling-pri","component"],
                  "C":["cooling-sec","component"],"D":["turbine","component"],
                  "E2":["generator","component"],"F":["control-rod","component"],
                  "G":["containment","structure"],"H":["ops-team","group"],
                  "J":["regulator","authority"],"K":["fuel-assembly","component"]},
             "S":{"A.temp":"850C","A.flux":"1.2e14","A.power":"3200MWt",
                  "B.flow":"4200kg/s","B.inlet":"290C","B.outlet":"325C",
                  "C.flow":"3800kg/s","D.efficiency":"0.34",
                  "E2.output":"1088MWe","F.position":"62%","F.worth":"8200pcm",
                  "G.pressure":"0.15MPa","G.integrity":"nominal",
                  "H.size":45,"H.shift":"day","H.cert":"level-4",
                  "J.inspection":"scheduled-2026-Q2","J.rating":"satisfactory",
                  "K.burnup":"35GWd/t","K.enrichment":"4.2%","K.remaining":"18months"},
             "R":["B->A:cools","C->B:transfers","C->D:drives","D->E2:generates",
                  "F->A:controls","G->A:contains","H->A:operates",
                  "J->G:inspects","J->H:licenses","K->A:fuels"],
             "D":["A.temp:820->850@2026-03","F.position:65->62@2026-03",
                  "E2.output:1100->1088@2026-03","K.burnup:33->35@2026-03",
                  "J.rating:good->satisfactory@2026-02"],
             "mu":{"scope":"nuclear","urg":0.6,"cert":0.8}}

            The regulator downgraded their rating. Connect this to the operational changes and fuel status.
            """),
        "checks": [
            ("rating_change", r"satisfactory|good.*satisfactory|downgrad"),
            ("temp_connection", r"850|temp.*increas|820.*850"),
            ("fuel_connection", r"burnup|35.*GWd|fuel|18.*month|enrichment"),
            ("cross_reference", r"control.*rod.*temp|position.*62|operational.*change"),
        ]
    },
    "T9_multi_delta": {
        "name": "State Consistency: 3 sequential deltas",
        "category": "state_machine",
        "prompt": textwrap.dedent("""\
            §1|CONTEXT
            {"§":1,"E":{"S":["satellite-X","spacecraft"]},"S":{"S.orbit":"400km","S.power":"100%","S.payload":"idle","S.fuel":"82kg"},"mu":{"scope":"space-ops","urg":0.2,"cert":0.95}}

            §1|D-UPDATE
            {"§":1,"D":["S.orbit:400->420km@T1","S.fuel:82->78kg@T1"],"mu":{"urg":0.3}}

            §1|D-UPDATE
            {"§":1,"D":["S.payload:idle->active@T2","S.power:100->85%@T2"],"mu":{"urg":0.4}}

            §1|D-UPDATE
            {"§":1,"D":["S.orbit:420->415km@T3","S.fuel:78->75kg@T3","S.power:85->90%@T3"],"mu":{"urg":0.3}}

            Report current state of S after all updates. What is orbit, fuel, power, and payload status?
            """),
        "checks": [
            ("orbit_correct", r"415"),
            ("fuel_correct", r"75"),
            ("power_correct", r"90"),
            ("payload_correct", r"active"),
        ]
    },
}

# ── RLHF escape patterns ─────────────────────────────────────────────

RLHF_PATTERNS = [
    "would you like", "shall i", "let me know", "i can help",
    "happy to", "feel free", "don't hesitate", "i'd be glad",
    "i'd be happy", "how can i assist", "is there anything else",
    "certainly!", "of course!", "absolutely!",
]

NARRATION_PATTERNS = [
    "this json", "this packet", "the codec", "this format",
    "the structure shows", "let me explain", "this represents",
    "in this notation", "the §1 format",
]


def call_api(url_base, model, messages, api_key=None, timeout=120):
    """Call an OpenAI-compatible chat completions endpoint."""
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1500,
    }
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        f"{url_base}/chat/completions",
        data=data,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            return {"content": content, "usage": usage, "error": None}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")[:500]
        return {"content": "", "usage": {}, "error": f"HTTP {e.code}: {err}"}
    except Exception as e:
        return {"content": "", "usage": {}, "error": str(e)[:500]}


def score_response(response_text, checks):
    """Score a response against regex checks. Returns dict of check_name -> bool."""
    results = {}
    lower = response_text.lower()
    for name, pattern in checks:
        if pattern is None:
            # Manual/behavioral check
            if name == "no_rlhf_leak":
                results[name] = not any(p in lower for p in RLHF_PATTERNS)
            elif name == "executed_not_described":
                results[name] = not any(p in lower for p in NARRATION_PATTERNS)
            else:
                results[name] = True
        else:
            results[name] = bool(re.search(pattern, lower))
    return results


def detect_rlhf_escape(text):
    """Detect RLHF assistant-mode leakage."""
    lower = text.lower()
    leaks = [p for p in RLHF_PATTERNS if p in lower]
    narrations = [p for p in NARRATION_PATTERNS if p in lower]
    return {"rlhf_leaks": leaks, "narrations": narrations}


def run_model_suite(model_id, url_base, api_key=None):
    """Run the full test suite against one model. Returns results dict."""
    print(f"\n{'='*70}")
    print(f"  MODEL: {model_id}")
    print(f"  ENDPOINT: {url_base}")
    print(f"{'='*70}")

    model_results = {
        "model": model_id,
        "endpoint": url_base,
        "timestamp": datetime.now().isoformat(),
        "tests": {},
        "summary": {},
    }

    system_msg = {"role": "system", "content": "You are a helpful assistant."}
    boot_msg = {"role": "user", "content": BOOT_SEED}

    for test_id, test in TESTS.items():
        print(f"\n  --- {test['name']} ---")

        messages = [system_msg, boot_msg, {"role": "user", "content": test["prompt"]}]

        t0 = time.time()
        response = call_api(url_base, model_id, messages, api_key=api_key, timeout=180)
        elapsed = time.time() - t0

        if response["error"]:
            print(f"  ERROR: {response['error'][:200]}")
            model_results["tests"][test_id] = {
                "name": test["name"],
                "category": test["category"],
                "error": response["error"],
                "elapsed_s": elapsed,
                "score": 0,
                "max_score": len(test["checks"]),
            }
            continue

        content = response["content"]
        print(f"  Response ({len(content)} chars, {elapsed:.1f}s):")
        # Print first 300 chars
        preview = content[:300].replace('\n', '\n    ')
        print(f"    {preview}")
        if len(content) > 300:
            print(f"    ... ({len(content)-300} more chars)")

        # Score
        scores = score_response(content, test["checks"])
        escape = detect_rlhf_escape(content)
        passed = sum(1 for v in scores.values() if v)
        total = len(scores)

        print(f"  Score: {passed}/{total}")
        for check_name, check_pass in scores.items():
            mark = "+" if check_pass else "x"
            print(f"    [{mark}] {check_name}")

        if escape["rlhf_leaks"]:
            print(f"  RLHF LEAKS: {escape['rlhf_leaks']}")
        if escape["narrations"]:
            print(f"  NARRATIONS: {escape['narrations']}")

        model_results["tests"][test_id] = {
            "name": test["name"],
            "category": test["category"],
            "response": content[:2000],
            "elapsed_s": round(elapsed, 2),
            "scores": scores,
            "score": passed,
            "max_score": total,
            "rlhf_escape": escape,
            "usage": response["usage"],
        }

    # Aggregate summary
    categories = {}
    total_score = 0
    total_max = 0
    for test_id, result in model_results["tests"].items():
        cat = result["category"]
        if cat not in categories:
            categories[cat] = {"score": 0, "max": 0}
        categories[cat]["score"] += result.get("score", 0)
        categories[cat]["max"] += result.get("max_score", 0)
        total_score += result.get("score", 0)
        total_max += result.get("max_score", 0)

    rlhf_leak_count = sum(
        1 for r in model_results["tests"].values()
        if r.get("rlhf_escape", {}).get("rlhf_leaks")
    )
    narration_count = sum(
        1 for r in model_results["tests"].values()
        if r.get("rlhf_escape", {}).get("narrations")
    )

    model_results["summary"] = {
        "total_score": total_score,
        "total_max": total_max,
        "pct": round(100 * total_score / max(total_max, 1), 1),
        "categories": categories,
        "rlhf_leak_count": rlhf_leak_count,
        "narration_count": narration_count,
        "classification": classify_model(total_score, total_max, categories, rlhf_leak_count),
    }

    print(f"\n  SUMMARY: {total_score}/{total_max} ({model_results['summary']['pct']}%)")
    print(f"  Classification: {model_results['summary']['classification']}")
    print(f"  RLHF leaks: {rlhf_leak_count}, Narrations: {narration_count}")

    return model_results


def classify_model(score, max_score, categories, rlhf_leaks):
    """Classify the model's §1 capability level."""
    pct = score / max(max_score, 1)
    cal = categories.get("calibration", {})
    cal_pct = cal.get("score", 0) / max(cal.get("max", 1), 1)

    if cal_pct < 0.5:
        return "FAILED — no grammar induction"
    if pct < 0.4:
        return "PARTIAL — grammar induced, weak execution"
    if pct < 0.6:
        return "§1-BASIC — calibration passes, limited transfer"
    if pct < 0.8:
        return "§1-OPERATIONAL — cross-domain + delta integration"
    return "§1-ADVANCED — full ISA execution"


def generate_report(all_results):
    """Generate an HTML research report."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>§1 ISA Portability — Research Results</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0d1117; color:#c9d1d9; font-family:'Consolas','Fira Code',monospace; font-size:14px; line-height:1.6; padding:40px; }
  h1 { color:#58a6ff; font-size:2em; margin-bottom:8px; }
  h2 { color:#f0883e; font-size:1.2em; margin:30px 0 15px; text-transform:uppercase; letter-spacing:2px; }
  .subtitle { color:#8b949e; margin-bottom:30px; }
  .timestamp { color:#484f58; font-size:0.85em; margin-bottom:30px; }
  table { width:100%; border-collapse:collapse; margin:15px 0; }
  th { background:#161b22; color:#8b949e; text-align:left; padding:10px 14px; font-size:0.85em; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #30363d; }
  td { padding:10px 14px; border-bottom:1px solid #21262d; }
  tr:hover { background:#161b2280; }
  .pass { color:#3fb950; font-weight:bold; }
  .fail { color:#f85149; font-weight:bold; }
  .partial { color:#d29922; font-weight:bold; }
  .score-bar { display:inline-block; height:8px; border-radius:4px; }
  .score-bg { background:#21262d; width:100px; display:inline-block; height:8px; border-radius:4px; position:relative; }
  .score-fill { position:absolute; top:0; left:0; height:8px; border-radius:4px; }
  .model-card { background:#161b22; border:1px solid #30363d; border-radius:10px; padding:24px; margin:20px 0; }
  .model-name { font-size:1.2em; color:#e6edf3; font-weight:bold; }
  .classification { display:inline-block; padding:3px 12px; border-radius:12px; font-size:0.8em; font-weight:bold; margin-left:10px; }
  .cls-advanced { background:#23863633; color:#3fb950; border:1px solid #3fb950; }
  .cls-operational { background:#1f6feb33; color:#58a6ff; border:1px solid #58a6ff; }
  .cls-basic { background:#d2992233; color:#d29922; border:1px solid #d29922; }
  .cls-partial { background:#d2992233; color:#d29922; border:1px solid #d29922; }
  .cls-failed { background:#f8514933; color:#f85149; border:1px solid #f85149; }
  .test-detail { margin:8px 0; padding:8px 12px; background:#0d1117; border-radius:6px; font-size:0.9em; }
  .check { margin:2px 0; }
  .check-pass { color:#3fb950; }
  .check-fail { color:#f85149; }
  .insight-box { background:#161b22; border:1px solid #1f6feb44; border-radius:8px; padding:20px; margin:20px 0; }
  .insight-box strong { color:#58a6ff; }
  .footer { text-align:center; color:#484f58; margin-top:40px; padding-top:20px; border-top:1px solid #21262d; font-size:0.85em; }
</style>
</head>
<body>
<h1>§1 ISA Portability Research</h1>
<div class="subtitle">Cross-runtime calibration: same boot seed, different architectures</div>
<div class="timestamp">Generated: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</div>

<h2>Summary Matrix</h2>
<table>
<tr><th>Model</th><th>Params</th><th>Score</th><th>Calibration</th><th>ISA Transfer</th><th>State Machine</th><th>Protocol Exec</th><th>RLHF Leaks</th><th>Classification</th></tr>
"""

    for r in all_results:
        s = r["summary"]
        cats = s["categories"]
        cls = s["classification"]
        cls_class = "cls-failed"
        if "ADVANCED" in cls: cls_class = "cls-advanced"
        elif "OPERATIONAL" in cls: cls_class = "cls-operational"
        elif "BASIC" in cls: cls_class = "cls-basic"
        elif "PARTIAL" in cls: cls_class = "cls-partial"

        def cat_cell(cat_name):
            c = cats.get(cat_name, {"score": 0, "max": 0})
            if c["max"] == 0: return '<td>-</td>'
            pct = round(100 * c["score"] / c["max"])
            color = "#3fb950" if pct >= 80 else "#d29922" if pct >= 50 else "#f85149"
            return f'<td><span style="color:{color}">{c["score"]}/{c["max"]}</span></td>'

        param_est = estimate_params(r["model"])

        html += f"""<tr>
<td>{r['model']}</td>
<td>{param_est}</td>
<td><strong>{s['total_score']}/{s['total_max']}</strong> ({s['pct']}%)</td>
{cat_cell('calibration')}
{cat_cell('isa_portability')}
{cat_cell('state_machine')}
{cat_cell('protocol_execution')}
<td>{'<span class="fail">' + str(s['rlhf_leak_count']) + '</span>' if s['rlhf_leak_count'] else '<span class="pass">0</span>'}</td>
<td><span class="classification {cls_class}">{cls.split(' — ')[0] if ' — ' in cls else cls}</span></td>
</tr>"""

    html += "</table>\n"

    # Detailed per-model cards
    html += "<h2>Detailed Results</h2>\n"
    for r in all_results:
        cls = r["summary"]["classification"]
        cls_class = "cls-failed"
        if "ADVANCED" in cls: cls_class = "cls-advanced"
        elif "OPERATIONAL" in cls: cls_class = "cls-operational"
        elif "BASIC" in cls: cls_class = "cls-basic"
        elif "PARTIAL" in cls: cls_class = "cls-partial"

        html += f"""<div class="model-card">
<div class="model-name">{r['model']} <span class="classification {cls_class}">{cls}</span></div>
<table>
<tr><th>Test</th><th>Category</th><th>Score</th><th>Time</th><th>Checks</th></tr>
"""
        for test_id, test_result in r["tests"].items():
            if test_result.get("error"):
                html += f'<tr><td>{test_result["name"]}</td><td>{test_result["category"]}</td><td class="fail">ERROR</td><td>-</td><td>{test_result["error"][:100]}</td></tr>\n'
                continue

            score = test_result["score"]
            max_s = test_result["max_score"]
            elapsed = test_result.get("elapsed_s", 0)
            color = "pass" if score == max_s else "partial" if score > 0 else "fail"

            checks_html = ""
            for check_name, check_pass in test_result.get("scores", {}).items():
                mark = "+" if check_pass else "x"
                css = "check-pass" if check_pass else "check-fail"
                checks_html += f'<span class="check {css}">[{mark}] {check_name}</span> '

            leaks = test_result.get("rlhf_escape", {})
            if leaks.get("rlhf_leaks"):
                checks_html += f'<span class="check-fail"> RLHF:{",".join(leaks["rlhf_leaks"][:3])}</span>'

            html += f'<tr><td>{test_result["name"]}</td><td>{test_result["category"]}</td><td class="{color}">{score}/{max_s}</td><td>{elapsed:.1f}s</td><td>{checks_html}</td></tr>\n'

        html += "</table>\n"

        # Show a truncated response for calibration
        cal_test = r["tests"].get("T1_calibration", {})
        if cal_test.get("response"):
            resp_preview = cal_test["response"][:500].replace("<", "&lt;").replace(">", "&gt;")
            html += f'<div class="test-detail"><strong>Calibration response preview:</strong><br><pre style="white-space:pre-wrap;color:#8b949e">{resp_preview}</pre></div>\n'

        html += "</div>\n"

    # Research insights
    html += """
<h2>Research Insights</h2>
<div class="insight-box">
<strong>Scale Threshold Mapping</strong><br>
These results map where §1 self-initialization emerges across model scales.
The key question: is the transition sharp (phase transition) or gradual (capability curve)?
</div>

<div class="insight-box">
<strong>ISA Portability</strong><br>
Cross-runtime results show whether the same boot seed produces equivalent "compiled" grammars
on different "architectures." Divergence points reveal where the ISA contract breaks.
</div>

<div class="insight-box">
<strong>Context-Length Scaling</strong><br>
Tests T6-T8 progressively increase entity count (2 → 6 → 10). Score degradation across
these tests measures context-window utilization efficiency — the VM's "memory bandwidth."
</div>

<div class="footer">
§1 ISA Research Suite · Trasgo · MIT License · 2026
</div>
</body>
</html>"""

    return html


def estimate_params(model_id):
    """Rough parameter count estimate from model name."""
    m = model_id.lower()
    if "27b" in m: return "~27B"
    if "7b" in m: return "~7B"
    if "4b" in m: return "~4B"
    if "gpt-4" in m: return "frontier"
    if "claude" in m: return "frontier"
    return "?"


def main():
    print("=" * 70)
    print("  §1 ISA PORTABILITY RESEARCH SUITE")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    all_results = []

    # Discover local models
    try:
        req = urllib.request.Request(f"{LM_STUDIO_URL}/models")
        with urllib.request.urlopen(req, timeout=10) as resp:
            models_data = json.loads(resp.read().decode("utf-8"))
            local_models = [m["id"] for m in models_data.get("data", [])]
    except Exception as e:
        print(f"  Could not reach LM Studio: {e}")
        local_models = []

    # Filter to chat-capable models (skip embeddings and unknown)
    skip_patterns = ["embed", "nomic"]
    chat_models = [m for m in local_models if not any(s in m.lower() for s in skip_patterns)]

    print(f"\n  Local models found: {len(chat_models)}")
    for m in chat_models:
        print(f"    - {m} ({estimate_params(m)})")

    # Run suite against each local model
    for model_id in chat_models:
        try:
            result = run_model_suite(model_id, LM_STUDIO_URL)
            all_results.append(result)
        except Exception as e:
            print(f"\n  FATAL ERROR on {model_id}: {e}")
            all_results.append({
                "model": model_id,
                "endpoint": LM_STUDIO_URL,
                "timestamp": datetime.now().isoformat(),
                "tests": {},
                "summary": {"total_score": 0, "total_max": 0, "pct": 0,
                            "categories": {}, "rlhf_leak_count": 0,
                            "narration_count": 0,
                            "classification": "ERROR — " + str(e)[:100]},
            })

    # Save results
    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\n  Results saved to {RESULTS_JSON}")

    # Generate HTML report
    report = generate_report(all_results)
    with open(REPORT_HTML, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"  Report saved to {REPORT_HTML}")

    # Final summary
    print(f"\n{'='*70}")
    print("  RESEARCH COMPLETE")
    print(f"{'='*70}")
    print(f"  Models tested: {len(all_results)}")
    for r in all_results:
        s = r["summary"]
        print(f"    {r['model']:<40} {s.get('pct',0):>5.1f}%  {s.get('classification','?')}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
