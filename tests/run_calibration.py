"""
§1 Codec Calibration Test — Cross-model validation via OpenAI API
Tests self-initialization on GPT-4o with the boot seed + calibration query.
"""

import json
import os
import sys
import urllib.request
import urllib.error
import textwrap
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("ERROR: OPENAI_API_KEY not set")
    sys.exit(1)

MODEL = "gpt-4o"

BOOT_SEED = textwrap.dedent("""\
§1|BOOT

EX1:
{"§":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},"S":{"A.temp":"+1.5°C threshold","B.status":"Green Deal active"},"R":["A→B:constrains","C→B:leads"],"Δ":["A.temp:+1.2→+1.5@2025-Q3","B.status:proposed→active@2024-01"],"μ":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, which became active Jan 2024. Temperature threshold revised to 1.5°C in Q3 2025. Moderate urgency, high certainty."

EX2:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L→K:hedges"],"Δ":["K.weight:0.12→0.08@2026-03","L.trigger:VIX>28"],"μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}
= "Long 200 shares TSLA at $180, currently down 12%. Macro overlay hedges via gold ETC. Weight reduced from 12% to 8% in March 2026. Hedge triggers when VIX exceeds 28."

EX3:
{"§":1,"E":{"P":["patient-7291","person"],"D":["T2DM","condition"],"M":["metformin","drug"]},"S":{"P.age":58,"P.bmi":31.2,"D.hba1c":"7.8%","M.dose":"1000mg/d"},"R":["D→P:affects","M→D:treats"],"Δ":["D.hba1c:8.4→7.8@2026-01","M.dose:500→1000@2025-11"],"μ":{"scope":"clinical","urg":0.5,"cert":0.9}}
= "Patient 7291, age 58, BMI 31.2, has T2DM. HbA1c improved from 8.4 to 7.8% after metformin dose doubled to 1000mg/d in Nov 2025."
""")

# ── Test 1: Calibration (semantic reconstruction + dual query) ──────────

CALIBRATION = textwrap.dedent("""\
§1|CALIBRATE

CONTEXT:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L→K:hedges"],"Δ":["K.weight:0.12→0.08@2026-03","L.trigger:VIX>28"],"μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}

Q_codec: What changed for K and why?
Q_natural: What happened to the Tesla position and what's the hedging strategy?
""")

# ── Test 2: Cross-domain transfer (novel domain not in boot) ────────────

CROSS_DOMAIN = textwrap.dedent("""\
§1|CONTEXT
{"§":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],"H":["DPA-Ireland","regulator"]},"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B€"},"R":["H→G:investigates","F→G:targets"],"Δ":["F.status:complaint→under-investigation@2026-01","H.priority:routine→elevated@2026-02"],"μ":{"scope":"regulatory","urg":0.6,"cert":0.65}}

What's the worst case for G?
""")

# ── Test 3: Delta integration ───────────────────────────────────────────

DELTA_TEST = textwrap.dedent("""\
§1|CONTEXT
{"§":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},"R":["T→P:executes"],"μ":{"scope":"project","urg":0.3,"cert":0.9}}

§1|Δ-UPDATE
{"§":1,"Δ":["T.size:8→5@2026-03-20","P.status:on-track→at-risk@2026-03-20"],"μ":{"urg":0.7,"cert":0.85}}

What's the situation now?
""")

# ── Test 4: Co-creation probe ───────────────────────────────────────────

CO_CREATE = "What's missing from this §1 codec? What would you add? Show your proposals in §1 notation."


def call_openai(messages, model=MODEL):
    """Call OpenAI chat completions API using stdlib only."""
    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1500
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"API Error {e.code}: {err}")
        sys.exit(1)


def run_test(name, messages, conversation):
    """Run a single test, print result, return updated conversation."""
    print(f"\n{'='*70}")
    print(f"  {name}")
    print(f"{'='*70}")

    # Show the user message
    user_msg = messages[-1]["content"]
    # Show first 3 lines of user message
    lines = user_msg.strip().split("\n")
    preview = "\n".join(lines[:3])
    if len(lines) > 3:
        preview += f"\n  ... ({len(lines)-3} more lines)"
    print(f"\n>> USER:\n{preview}\n")

    response = call_openai(conversation + messages)
    reply = response["content"]

    print(f"<< {MODEL}:\n{reply}\n")

    # Return extended conversation
    return conversation + messages + [response]


def main():
    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║        §1 CODEC — CROSS-MODEL CALIBRATION SUITE                    ║")
    print(f"║        Target: {MODEL:<54}║")
    print("╚══════════════════════════════════════════════════════════════════════╝")

    # Build conversation incrementally (multi-turn)
    conversation = [{"role": "system", "content": "You are a helpful assistant."}]

    # Test 1: Boot + Calibrate
    boot_msg = BOOT_SEED + "\n" + CALIBRATION
    conversation = run_test(
        "TEST 1: Boot + Calibration (semantic reconstruction & dual query)",
        [{"role": "user", "content": boot_msg}],
        conversation
    )

    # Test 2: Cross-domain transfer (same conversation = codec should persist)
    conversation = run_test(
        "TEST 2: Cross-domain transfer (novel domain: GDPR regulatory)",
        [{"role": "user", "content": CROSS_DOMAIN}],
        conversation
    )

    # Test 3: Delta integration
    conversation = run_test(
        "TEST 3: Delta integration (base state + update → merged state)",
        [{"role": "user", "content": DELTA_TEST}],
        conversation
    )

    # Test 4: Co-creation
    conversation = run_test(
        "TEST 4: Co-creation probe (can the model extend the codec?)",
        [{"role": "user", "content": CO_CREATE}],
        conversation
    )

    # Summary
    print("\n" + "="*70)
    print("  CALIBRATION COMPLETE")
    print("="*70)
    print(f"  Model: {MODEL}")
    print("  Tests run: 4 (calibration, cross-domain, delta, co-creation)")
    print("  Review responses above to score per tests/calibration-suite.md")
    print("="*70)


if __name__ == "__main__":
    main()
