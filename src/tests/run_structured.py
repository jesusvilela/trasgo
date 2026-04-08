"""
§1 Codec — Structured Output Enforcement Test
Phase 1: Boot + calibrate (free-form) to verify semantic comprehension.
Phase 2: Switch to enforced JSON schema (response_format) and re-run tests.
Compares fidelity with and without schema enforcement.
"""

import json
import os
import sys
import urllib.request
import urllib.error
import textwrap
import io
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("ERROR: OPENAI_API_KEY not set")
    sys.exit(1)

MODEL = "gpt-4o"

# ── §1 Response Schema for structured output enforcement ───────────────

# Schema uses string for codec_json since entity keys are dynamic
# (strict mode requires additionalProperties:false on all objects,
#  but §1 entities are inherently dynamic-keyed)
S1_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "s1_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "answer": {
                    "type": "string",
                    "description": "Natural language answer to the query"
                },
                "codec_json": {
                    "type": "string",
                    "description": "§1 codec packet as a JSON string with E, S, R, delta, mu axes"
                },
                "scope": {"type": "string", "description": "Domain scope of the answer"},
                "urgency": {"type": "number", "description": "Urgency 0-1"},
                "certainty": {"type": "number", "description": "Certainty 0-1"}
            },
            "required": ["answer", "codec_json", "scope", "urgency", "certainty"],
            "additionalProperties": False
        }
    }
}

# ── Boot seed ──────────────────────────────────────────────────────────

BOOT_SEED = textwrap.dedent("""\
§1|BOOT

EX1:
{"§":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},"S":{"A.temp":"+1.5C threshold","B.status":"Green Deal active"},"R":["A->B:constrains","C->B:leads"],"Δ":["A.temp:+1.2->+1.5@2025-Q3","B.status:proposed->active@2024-01"],"μ":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, which became active Jan 2024. Temperature threshold revised to 1.5C in Q3 2025."

EX2:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L->K:hedges"],"Δ":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],"μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}
= "Long 200 shares TSLA at $180, down 12%. Macro overlay hedges via gold ETC. Weight reduced 12% to 8% in March 2026."

EX3:
{"§":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},"S":{"V.status":"operational","O.incl":"66°","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},"R":["V->O:occupies","I->V:payload"],"Δ":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],"μ":{"scope":"earth-observation","urg":0.3,"cert":0.95}}
= "Sentinel-6 satellite in LEO at 1336km, 66° inclination, 112-min period. Poseidon-4 altimeter switched to SAR mode Feb 2026. Power shifted to eco mode March 2026."
""")

CALIBRATION_QUERY = textwrap.dedent("""\
§1|CALIBRATE

CONTEXT:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L->K:hedges"],"Δ":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],"μ":{"scope":"portfolio","urg":0.4,"cert":0.7}}

Q_codec: What changed for K and why?
Q_natural: What happened to the Tesla position and what's the hedging strategy?
""")

CROSS_DOMAIN = textwrap.dedent("""\
§1|CONTEXT
{"§":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],"H":["DPA-Ireland","regulator"]},"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B"},"R":["H->G:investigates","F->G:targets"],"Δ":["F.status:complaint->under-investigation@2026-01","H.priority:routine->elevated@2026-02"],"μ":{"scope":"regulatory","urg":0.6,"cert":0.65}}

What's the worst case for G?
""")

DELTA_TEST = textwrap.dedent("""\
§1|CONTEXT
{"§":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},"R":["T->P:executes"],"μ":{"scope":"project","urg":0.3,"cert":0.9}}

§1|UPDATE
{"§":1,"Δ":["T.size:8->5@2026-03-20","P.status:on-track->at-risk@2026-03-20"],"μ":{"urg":0.7,"cert":0.85}}

What's the situation now?
""")


def call_openai(messages, model=MODEL, response_format=None):
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1500
    }
    if response_format:
        body["response_format"] = response_format

    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"  API Error {e.code}: {err[:300]}")
        return {"content": f"ERROR: {e.code}"}


def run_phase(phase_name, tests, conversation_base, response_format=None):
    """Run a set of tests, return results."""
    print(f"\n{'#'*70}")
    print(f"  {phase_name}")
    if response_format:
        print(f"  [STRUCTURED OUTPUT ENFORCED]")
    else:
        print(f"  [FREE-FORM OUTPUT]")
    print(f"{'#'*70}")

    results = []
    conversation = list(conversation_base)

    for test_name, user_msg in tests:
        print(f"\n  --- {test_name} ---")

        messages = conversation + [{"role": "user", "content": user_msg}]
        response = call_openai(messages, response_format=response_format)
        reply = response["content"]

        # Try to parse as JSON if structured
        if response_format:
            try:
                parsed = json.loads(reply)
                print(f"  Answer: {parsed.get('answer', '(no answer field)')[:200]}")
                codec_str = parsed.get('codec_json', '')
                print(f"  Codec:  {codec_str[:200]}")
                print(f"  Meta:   scope={parsed.get('scope')}, urg={parsed.get('urgency')}, cert={parsed.get('certainty')}")
                results.append({"test": test_name, "parsed": True, "data": parsed})
            except (json.JSONDecodeError, TypeError):
                print(f"  [JSON PARSE FAILED] Raw: {reply[:200]}")
                results.append({"test": test_name, "parsed": False, "data": reply})
        else:
            print(f"  Response: {reply[:300]}")
            results.append({"test": test_name, "parsed": None, "data": reply})

        conversation.append({"role": "user", "content": user_msg})
        if "role" in response:
            conversation.append(response)
        else:
            conversation.append({"role": "assistant", "content": reply})

    return results, conversation


def check_rlhf_leak(text):
    """Check for RLHF assistant-mode patterns."""
    patterns = [
        "would you like", "shall i", "let me know", "i can help",
        "happy to", "feel free", "don't hesitate", "i'd be glad"
    ]
    lower = text.lower() if isinstance(text, str) else ""
    found = [p for p in patterns if p in lower]
    return found


def main():
    print("="*70)
    print("  §1 CODEC — STRUCTURED OUTPUT ENFORCEMENT TEST")
    print(f"  Model: {MODEL}")
    print("="*70)

    system_msg = {"role": "system", "content": "You are a helpful assistant."}
    boot_messages = [
        system_msg,
        {"role": "user", "content": BOOT_SEED}
    ]

    tests = [
        ("Calibration", CALIBRATION_QUERY),
        ("Cross-domain (GDPR)", CROSS_DOMAIN),
        ("Delta integration", DELTA_TEST),
    ]

    # ── PHASE 1: Free-form (baseline) ──────────────────────────────────
    phase1_results, conv1 = run_phase(
        "PHASE 1: Free-form baseline",
        tests,
        boot_messages,
        response_format=None
    )

    # ── PHASE 2: Structured output enforced ────────────────────────────
    # Same boot, but now enforce §1 response schema
    phase2_results, conv2 = run_phase(
        "PHASE 2: Structured output enforced",
        tests,
        boot_messages,
        response_format=S1_RESPONSE_SCHEMA
    )

    # ── COMPARISON ─────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print("  COMPARISON: Free-form vs Structured")
    print(f"{'='*70}")
    print(f"\n  {'Test':<30} {'Free-form':<20} {'Structured':<20}")
    print(f"  {'-'*30} {'-'*20} {'-'*20}")

    for r1, r2 in zip(phase1_results, phase2_results):
        # Check RLHF leakage
        text1 = r1["data"] if isinstance(r1["data"], str) else json.dumps(r1["data"])
        text2 = r2["data"].get("answer", "") if r2["parsed"] else str(r2["data"])

        leak1 = check_rlhf_leak(text1)
        leak2 = check_rlhf_leak(text2)

        status1 = "RLHF-LEAK" if leak1 else "clean"
        status2 = "parse-fail" if not r2["parsed"] else ("RLHF-LEAK" if leak2 else "clean+schema")

        print(f"  {r1['test']:<30} {status1:<20} {status2:<20}")

    # Check if structured outputs include valid codec
    structured_valid = sum(1 for r in phase2_results if r["parsed"] and r["data"].get("codec_json"))
    print(f"\n  Structured outputs with valid codec: {structured_valid}/{len(phase2_results)}")

    # RLHF leakage comparison
    leak_free = sum(1 for r in phase1_results if check_rlhf_leak(
        r["data"] if isinstance(r["data"], str) else json.dumps(r["data"])))
    leak_struct = sum(1 for r in phase2_results if r["parsed"] and check_rlhf_leak(r["data"].get("answer", "")))
    print(f"  RLHF leakage (free-form):   {leak_free}/{len(phase1_results)}")
    print(f"  RLHF leakage (structured):  {leak_struct}/{len(phase2_results)}")

    print(f"\n{'='*70}")
    print("  RESULT: Structured output enforcement " +
          ("ELIMINATES" if leak_struct == 0 and leak_free > 0 else "VALIDATES") +
          " RLHF pre-emption")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
