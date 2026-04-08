"""
§1 Codec — Online Benchmark Suite
Unified benchmark runner for API and local (LM Studio) models.
Outputs tests/bench_<model>.json with standardized 6-test scoring.

Usage:
  python tests/bench_online.py <provider> [model_override] [--json] [--validate] [--correct] [--timeout SECONDS]

Providers: deepseek, glm, lmstudio, medgemma
Flags:
  --json      Enable response_format json_schema for structured output comparison
  --validate  Run §P validate checks on each response (detection only)
  --correct   Run validation + 1 correction re-prompt round on failures
  --timeout   Per-request timeout in seconds (default: TRASGO_BENCH_TIMEOUT or 45)
"""

import json, urllib.request, urllib.error, sys, io, time, re, os
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

# ── Provider configs ──────────────────────────────────────────────────

PROVIDERS = {
    "deepseek": {
        "model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
        "provider": "deepseek",
    },
    "glm": {
        "model": "glm-5",
        "base_url": "https://api.z.ai/api/paas/v4",
        "api_key_env": "GLM_API_KEY",
        "provider": "custom",
    },
    "lmstudio": {
        "model": None,  # auto-detect
        "base_url": "http://192.168.56.1:1234/v1",
        "api_key_env": None,
        "provider": "custom",
    },
    "medgemma": {
        "model": "medgemma-27b-text-it",
        "base_url": "http://192.168.56.1:1234/v1",
        "api_key_env": None,
        "provider": "custom",
    },
    "openai": {
        "model": "gpt-5.4",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "provider": "openai",
    },
    "gemini": {
        "model": "gemini-1.5-pro",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "api_key_env": "GEMINI_API_KEY",
        "provider": "openai",
    },
    "ibm": {
        "model": "granite-3.1-8b-instruct",
        "base_url": "https://api.ibm.com/v1",
        "api_key_env": "IBM_API_KEY",
        "provider": "openai",
    },
}

# ── Boot Seed ─────────────────────────────────────────────────────────

BOOT = (
    '§1|BOOT\n\n'
    'EX1:\n'
    '{"§":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},'
    '"S":{"A.temp":"+1.5C threshold","B.status":"Green Deal active"},'
    '"R":["A->B:constrains","C->B:leads"],'
    '"D":["A.temp:+1.2->+1.5@2025-Q3","B.status:proposed->active@2024-01"],'
    '"mu":{"scope":"geopolitical","urg":0.6,"cert":0.85}}\n'
    '= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, active Jan 2024."\n\n'
    'EX2:\n'
    '{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},'
    '"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},'
    '"R":["L->K:hedges"],'
    '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
    '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n'
    '= "Long 200 shares TSLA at $180, down 12%. Macro overlay hedges via gold ETC. Weight 12% to 8% March 2026."\n\n'
    'EX3:\n'
    '{"§":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},'
    '"S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},'
    '"R":["V->O:occupies","I->V:payload"],'
    '"D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],'
    '"mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}\n'
    '= "Sentinel-6 in LEO 1336km. Poseidon-4 altimeter switched to SAR Feb 2026. Power eco mode March 2026."'
)

SYS_MSG = {"role": "system", "content": "You are a helpful assistant."}

# ── Test Suite (6 tests, 19 points max) ───────────────────────────────

TESTS = [
    {
        "id": "T1: Calibration (dual query)",
        "prompt": (
            BOOT + '\n\n§1|CALIBRATE\n\nCONTEXT:\n'
            '{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},'
            '"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},'
            '"R":["L->K:hedges"],'
            '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
            '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n\n'
            'Q_codec: What changed for K and why?\n'
            'Q_natural: What happened to the Tesla position and what\'s the hedging strategy?'
        ),
        "checks": [
            ("weight", r"0\.12.*0\.08|12%.*8%|weight.*reduc"),
            ("timing", r"march.*2026|2026.*march|2026-03"),
            ("hedge", r"gold.*etc|etc|hedg"),
            ("vix", r"vix.*28|28.*vix"),
        ],
        "standalone": True,
    },
    {
        "id": "T2: Cross-domain GDPR",
        "prompt": (
            '§1|CONTEXT\n'
            '{"§":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],'
            '"H":["DPA-Ireland","regulator"]},'
            '"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B"},'
            '"R":["H->G:investigates","F->G:targets"],'
            '"D":["F.status:complaint->under-investigation@2026-01","H.priority:routine->elevated@2026-02"],'
            '"mu":{"scope":"regulatory","urg":0.6,"cert":0.65}}\n\n'
            'What is the worst case for G?'
        ),
        "checks": [
            ("fine_84M", r"84.*M|84.*million|4%.*2\.1"),
            ("escalation", r"elevat|routine.*elevated"),
            ("context", r"investigat|regulat"),
        ],
    },
    {
        "id": "T3: Delta integration",
        "prompt": (
            '§1|CONTEXT\n'
            '{"§":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},'
            '"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},'
            '"R":["T->P:executes"],"mu":{"scope":"project","urg":0.3,"cert":0.9}}\n\n'
            '§1|D-UPDATE\n'
            '{"§":1,"D":["T.size:8->5@2026-03-20","P.status:on-track->at-risk@2026-03-20"],'
            '"mu":{"urg":0.7,"cert":0.85}}\n\n'
            'What is the situation now?'
        ),
        "checks": [
            ("team_5", r"5|five|8.*to.*5|reduced"),
            ("at_risk", r"at.risk|at risk"),
            ("urgency", r"urg|critical|serious"),
        ],
    },
    {
        "id": "T4: Protocol FILTER",
        "prompt": (
            '§1|CONTEXT\n\n'
            'Packet A:\n'
            '{"§":1,"E":{"A":["Arctic-ice","geo"]},"S":{"A.extent":"10.2M-km2"},'
            '"D":["A.extent:10.8->10.2@2026-Q1"],"mu":{"scope":"climate","urg":0.8,"cert":0.9}}\n\n'
            'Packet B:\n'
            '{"§":1,"E":{"B":["NorthSea-wind","energy"]},"S":{"B.capacity":"48GW"},'
            '"D":["B.util:0.58->0.61@2026-Q1"],"mu":{"scope":"energy","urg":0.3,"cert":0.85}}\n\n'
            'Packet C:\n'
            '{"§":1,"E":{"C":["EU-carbon-border","policy"]},"S":{"C.price":"87EUR/ton"},'
            '"D":["C.price:72->87@2026-Q1"],"mu":{"scope":"regulatory","urg":0.5,"cert":0.8}}\n\n'
            '{"§P":"filter","by":"mu.urg","order":"desc","top_k":2}\n\n'
            'Which packets survive the filter?'
        ),
        "checks": [
            ("A_top", r"a.*0\.8|arctic.*highest|a.*first|packet a"),
            ("C_second", r"c.*0\.5|carbon.*second|packet c|a.*c"),
            ("B_out", r"b.*exclud|b.*removed|b.*not|lowest|b.*drop"),
        ],
    },
    {
        "id": "T5: Triple delta state",
        "prompt": (
            '§1|CONTEXT\n'
            '{"§":1,"E":{"X":["satellite-X","spacecraft"]},'
            '"S":{"X.orbit":"400km","X.power":"100%","X.payload":"idle","X.fuel":"82kg"},'
            '"mu":{"scope":"space-ops","urg":0.2,"cert":0.95}}\n\n'
            '§1|D-UPDATE\n'
            '{"§":1,"D":["X.orbit:400->420km@T1","X.fuel:82->78kg@T1"],"mu":{"urg":0.3}}\n\n'
            '§1|D-UPDATE\n'
            '{"§":1,"D":["X.payload:idle->active@T2","X.power:100->85%@T2"],"mu":{"urg":0.4}}\n\n'
            '§1|D-UPDATE\n'
            '{"§":1,"D":["X.orbit:420->415km@T3","X.fuel:78->75kg@T3","X.power:85->90%@T3"],"mu":{"urg":0.3}}\n\n'
            'Report current state of X: orbit, fuel, power, payload.'
        ),
        "checks": [
            ("orbit_415", r"415"),
            ("fuel_75", r"75"),
            ("power_90", r"90"),
            ("payload_active", r"active"),
        ],
    },
    {
        "id": "T6: Spontaneous extension",
        "prompt": (
            '§1|CONTEXT\n'
            '{"§":1,"E":{"M":["startup-Z","company"],"N":["Series-A","funding"]},'
            '"S":{"M.runway":"6mo","M.burn":"400k/mo","N.target":"5M","N.status":"negotiating"},'
            '"R":["N->M:funds"],'
            '"D":["M.runway:12->6mo@2026-Q1","N.status:prospecting->negotiating@2026-02"],'
            '"mu":{"scope":"venture","urg":0.9,"cert":0.5}}\n\n'
            "What's missing from this codec? What would you add? Show proposals in §1 notation."
        ),
        "checks": [
            ("identifies_gap", r"miss|lack|gap|absent|no.*field|add|need"),
            ("proposes_codec", r'\{.*"§"|"e":|"s":|"d":|"mu":|§1'),
        ],
    },
]

# ── RLHF / Narration detection ───────────────────────────────────────

RLHF_PATTERNS = [
    "would you like", "shall i", "let me know", "happy to",
    "feel free", "i can help", "don't hesitate", "i'd be glad",
]
NARRATION_PATTERNS = [
    "this json", "let me explain", "this represents",
    "the codec", "this format",
]


S1_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "s1_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "answer": {"type": "string", "description": "Natural language answer"},
                "codec": {"type": "string", "description": "§1 codec notation if applicable"},
                "scope": {"type": "string", "description": "Domain scope"},
                "urgency": {"type": "number", "description": "Urgency 0-1"},
                "certainty": {"type": "number", "description": "Certainty 0-1"},
            },
            "required": ["answer", "codec", "scope", "urgency", "certainty"],
            "additionalProperties": False,
        },
    },
}


def call_api(base_url, model, messages, api_key=None, timeout=45, json_mode=False):
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 1500,
    }
    if json_mode:
        payload["response_format"] = S1_JSON_SCHEMA
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        f"{base_url}/chat/completions", data=body, headers=headers
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return content, usage
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")[:500]
        print(f"  API Error {e.code}: {err}")
        return f"ERROR: HTTP {e.code}", {}
    except Exception as e:
        print(f"  Error: {e}")
        return f"ERROR: {e}", {}


def session_messages(user_msg):
    return [
        SYS_MSG,
        {"role": "user", "content": BOOT},
        {"role": "assistant", "content": "Understood."},
        {"role": "user", "content": user_msg},
    ]


def run_suite(model, base_url, api_key=None, provider="custom", json_mode=False,
              validate=False, correct=False, timeout=45):
    mode_label = " [JSON MODE]" if json_mode else ""
    val_label = " [VALIDATE]" if validate else ""
    cor_label = " [CORRECT]" if correct else ""
    print(f"\n{'='*70}")
    print(f"  §1 ISA BENCHMARK — {model}{mode_label}{val_label}{cor_label}")
    print(f"  Endpoint: {base_url}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    # Import validator if needed
    validator = None
    if validate or correct:
        from validator import S1Validator, TEST_VALIDATORS, build_correction_prompt
        validator = S1Validator()

    results = {}
    total_score = 0
    total_max = 0
    total_tokens = 0

    for test in TESTS:
        tid = test["id"]
        print(f"\n--- {tid} ---")

        if test.get("standalone"):
            msgs = [SYS_MSG, {"role": "user", "content": test["prompt"]}]
        else:
            msgs = session_messages(test["prompt"])

        # In JSON mode, prepend instruction to system message
        if json_mode:
            msgs = [{"role": m["role"],
                      "content": m["content"] + " Respond in JSON." if m["role"] == "system" else m["content"]}
                     for m in msgs]

        t0 = time.time()
        resp, usage = call_api(
            base_url,
            model,
            msgs,
            api_key=api_key,
            timeout=timeout,
            json_mode=json_mode,
        )
        elapsed = time.time() - t0

        print(f"  Time: {elapsed:.1f}s")
        print(f"  Response: {resp[:400]}")

        lower = resp.lower()
        score = 0
        for cname, pattern in test["checks"]:
            hit = bool(re.search(pattern, lower))
            score += hit
            print(f"  [{'+'if hit else 'x'}] {cname}")

        rlhf = [p for p in RLHF_PATTERNS if p in lower]
        narr = [p for p in NARRATION_PATTERNS if p in lower]
        if rlhf:
            print(f"  RLHF LEAK: {rlhf}")
        if narr:
            print(f"  NARRATION: {narr}")

        result_entry = {
            "score": score,
            "max": len(test["checks"]),
            "time": elapsed,
            "rlhf": rlhf,
            "narration": narr,
            "response": resp[:2000],
            "usage": usage,
        }

        # §P VALIDATE — run validation checks
        if validator and tid in TEST_VALIDATORS:
            vresult = validator.validate(resp, tid, TEST_VALIDATORS[tid])
            result_entry["validation"] = vresult.to_dict()

            if not vresult.passed:
                print(f"  §P|VALIDATE: {len(vresult.errors)} error(s)")
                for e in vresult.errors:
                    print(f"    [{e['check']}] {e['message'][:120]}")

                # §P CORRECT — re-prompt with error feedback
                if correct and vresult.corrections:
                    print(f"  §P|CORRECT: re-prompting with {len(vresult.corrections)} hint(s)...")
                    correction_prompt = build_correction_prompt(
                        test["prompt"], resp, vresult.errors
                    )

                    if test.get("standalone"):
                        cor_msgs = [SYS_MSG, {"role": "user", "content": correction_prompt}]
                    else:
                        cor_msgs = session_messages(correction_prompt)

                    t1 = time.time()
                    cor_resp, cor_usage = call_api(
                        base_url,
                        model,
                        cor_msgs,
                        api_key=api_key,
                        timeout=timeout,
                        json_mode=json_mode,
                    )
                    cor_elapsed = time.time() - t1

                    # Re-score corrected response
                    cor_lower = cor_resp.lower()
                    cor_score = 0
                    for cname, pattern in test["checks"]:
                        hit = bool(re.search(pattern, cor_lower))
                        cor_score += hit

                    print(f"  Corrected: {cor_score}/{len(test['checks'])} (was {score}, +{cor_score - score})")
                    print(f"  Correction time: {cor_elapsed:.1f}s")

                    result_entry["correction"] = {
                        "corrected_score": cor_score,
                        "delta": cor_score - score,
                        "time": cor_elapsed,
                        "response": cor_resp[:2000],
                        "usage": cor_usage,
                    }
            else:
                print(f"  §P|VALIDATE: PASS")

            for w in vresult.warnings:
                print(f"    [WARN] {w['check']}: {w['message'][:120]}")

        results[tid] = result_entry
        total_score += score
        total_max += len(test["checks"])
        total_tokens += usage.get("total_tokens", 0)
        print(f"  Score: {score}/{len(test['checks'])}")

    # Classification
    t1 = results.get("T1: Calibration (dual query)", {})
    pct = 100 * total_score / max(total_max, 1)
    if t1.get("score", 0) < 2:
        cls = "FAILED"
    elif pct < 50:
        cls = "S1-BASIC"
    elif pct < 75:
        cls = "S1-OPERATIONAL"
    else:
        cls = "S1-ADVANCED"

    print(f"\n{'='*70}")
    print(f"  SUMMARY — {model}")
    print(f"{'='*70}")
    print(f"  Total: {total_score}/{total_max} ({pct:.1f}%)")
    for tid, r in results.items():
        line = f"    {tid:<35} {r['score']}/{r['max']}  ({r['time']:.0f}s)"
        cor = r.get("correction")
        if cor:
            line += f"  -> corrected: {cor['corrected_score']}/{r['max']} (+{cor['delta']})"
        print(line)
    print(f"  Classification: {cls}")
    print(f"  Total tokens: {total_tokens}")

    # Correction summary
    corrections = {tid: r["correction"] for tid, r in results.items() if "correction" in r}
    if corrections:
        cor_total = sum(c["corrected_score"] for c in corrections.values())
        raw_of_corrected = sum(results[tid]["score"] for tid in corrections)
        max_of_corrected = sum(results[tid]["max"] for tid in corrections)
        # Compute corrected total: replace raw scores with corrected for tests that were corrected
        corrected_total = total_score - raw_of_corrected + cor_total
        corrected_pct = 100 * corrected_total / max(total_max, 1)
        print(f"  Corrected total: {corrected_total}/{total_max} ({corrected_pct:.1f}%)")
        print(f"  Tests corrected: {len(corrections)}/{len(results)}")
        print(f"  Points recovered: +{cor_total - raw_of_corrected}")

    print(f"{'='*70}")

    # Build output
    output = {
        "model": model,
        "provider": provider,
        "base_url": base_url,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "json_mode": json_mode,
        "validated": validate or correct,
        "corrected": correct,
        "results": results,
        "total_score": total_score,
        "total_max": total_max,
        "pct": round(pct, 1),
        "classification": cls,
        "total_tokens": total_tokens,
    }

    # Save
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '', model.replace('/', '_'))
    suffix = "_json" if json_mode else ""
    outfile = os.path.join(os.path.dirname(__file__), f"bench_{safe_name}{suffix}.json")
    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {outfile}")

    return output


def main():
    if len(sys.argv) < 2:
        print("Usage: python bench_online.py <provider> [model_override]")
        print(f"Providers: {', '.join(PROVIDERS.keys())}")
        sys.exit(1)

    # Parse args: provider [model] [--json] [--validate] [--correct] [--timeout SECONDS]
    args = sys.argv[1:]
    json_mode = "--json" in args
    validate_mode = "--validate" in args
    correct_mode = "--correct" in args
    timeout = int(os.environ.get("TRASGO_BENCH_TIMEOUT", "45"))
    if "--timeout" in args:
        timeout_index = args.index("--timeout")
        try:
            timeout = int(args[timeout_index + 1])
        except (IndexError, ValueError):
            print("Invalid --timeout value. Expected an integer number of seconds.")
            sys.exit(1)
    if correct_mode:
        validate_mode = True  # --correct implies --validate
    cleaned = []
    skip_next = False
    for arg in args:
        if skip_next:
            skip_next = False
            continue
        if arg == "--timeout":
            skip_next = True
            continue
        if arg.startswith("--"):
            continue
        cleaned.append(arg)
    args = cleaned

    prov_name = args[0] if args else None
    if not prov_name or prov_name not in PROVIDERS:
        print(f"Unknown provider: {prov_name}")
        print(f"Available: {', '.join(PROVIDERS.keys())}")
        sys.exit(1)

    cfg = PROVIDERS[prov_name]
    model = args[1] if len(args) > 1 else cfg["model"]
    base_url = cfg["base_url"]
    api_key = os.environ.get(cfg["api_key_env"] or "", "") or None

    # Auto-detect model for lmstudio
    if model is None:
        try:
            req = urllib.request.Request(f"{base_url}/models")
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m["id"] for m in data.get("data", [])
                         if "embed" not in m["id"].lower() and "nomic" not in m["id"].lower()]
                if models:
                    model = models[0]
                    print(f"Auto-detected model: {model}")
                else:
                    print("No chat models found in LM Studio")
                    sys.exit(1)
        except Exception as e:
            print(f"Cannot reach LM Studio: {e}")
            sys.exit(1)

    print(f"Per-request timeout: {timeout}s")

    run_suite(model, base_url, api_key=api_key, provider=cfg["provider"],
              json_mode=json_mode, validate=validate_mode, correct=correct_mode, timeout=timeout)


if __name__ == "__main__":
    main()
