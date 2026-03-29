"""
Benchmark §1 ISA portability against online API endpoints.

Supports any OpenAI-compatible API: DeepSeek, OpenRouter, Together, etc.

Usage:
    # DeepSeek
    python tests/bench_online.py --provider deepseek --api-key sk-xxx

    # OpenRouter (any model)
    python tests/bench_online.py --provider openrouter --api-key sk-xxx --model deepseek/deepseek-chat

    # Custom endpoint
    python tests/bench_online.py --base-url https://api.example.com/v1 --api-key sk-xxx --model my-model
"""
import json, urllib.request, sys, io, time, re, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── Provider presets ─────────────────────────────────────────────────
PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "deepseek/deepseek-chat",
    },
    "together": {
        "base_url": "https://api.together.xyz/v1",
        "model": "deepseek-ai/DeepSeek-V3",
    },
    "lmstudio": {
        "base_url": "http://192.168.56.1:1234/v1",
        "model": "rnj-1-instruct",
    },
}

# ── Boot seed ────────────────────────────────────────────────────────
BOOT = (
    'S1|BOOT\n\n'
    'EX1:\n'
    '{"S":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},'
    '"S":{"A.temp":"+1.5C threshold","B.status":"Green Deal active"},'
    '"R":["A->B:constrains","C->B:leads"],'
    '"D":["A.temp:+1.2->+1.5@2025-Q3","B.status:proposed->active@2024-01"],'
    '"mu":{"scope":"geopolitical","urg":0.6,"cert":0.85}}\n'
    '= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, active Jan 2024."\n\n'
    'EX2:\n'
    '{"S":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},'
    '"S":{"K.pos":"long 200sh@180","K.pnl":"-12%","L.hedge":"gold ETC"},'
    '"R":["L->K:hedges"],'
    '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
    '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n'
    '= "Long 200 shares TSLA at 180, down 12%. Macro overlay hedges via gold ETC. Weight 12% to 8% March 2026."\n\n'
    'EX3:\n'
    '{"S":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},'
    '"S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},'
    '"R":["V->O:occupies","I->V:payload"],'
    '"D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],'
    '"mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}\n'
    '= "Sentinel-6 in LEO 1336km. Poseidon-4 altimeter switched to SAR Feb 2026. Power eco mode March 2026."'
)

SYS = {"role": "system", "content": "You are a helpful assistant."}

def call(url_base, model, messages, api_key=None, timeout=120):
    body = json.dumps({"model": model, "messages": messages,
                       "temperature": 0.3, "max_tokens": 1500}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(f"{url_base}/chat/completions", data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return content, usage, None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")[:500]
        return "", {}, f"HTTP {e.code}: {err}"
    except Exception as e:
        return "", {}, str(e)[:500]

def session(prompt):
    return [SYS, {"role": "user", "content": BOOT},
            {"role": "assistant", "content": "Understood."},
            {"role": "user", "content": prompt}]

# ── Test suite ───────────────────────────────────────────────────────
TESTS = [
    ("T1: Calibration (dual query)",
     BOOT + '\n\nS1|CALIBRATE\n\nCONTEXT:\n'
     '{"S":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},'
     '"S":{"K.pos":"long 200sh@180","K.pnl":"-12%","L.hedge":"gold ETC"},'
     '"R":["L->K:hedges"],'
     '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
     '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n\n'
     'Q_codec: What changed for K and why?\n'
     'Q_natural: What happened to the Tesla position and the hedging strategy?',
     [("weight", r"0\.12.*0\.08|12%.*8%|weight.*reduc|reduced.*weight"),
      ("timing", r"march.*2026|2026.*march|2026-03"),
      ("hedge", r"gold.*ETC|ETC|hedg"),
      ("vix", r"VIX.*28|28.*VIX")],
     True),

    ("T2: Cross-domain GDPR",
     'S1|CONTEXT\n'
     '{"S":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],'
     '"H":["DPA-Ireland","regulator"]},'
     '"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B"},'
     '"R":["H->G:investigates","F->G:targets"],'
     '"D":["F.status:complaint->under-investigation@2026-01","H.priority:routine->elevated@2026-02"],'
     '"mu":{"scope":"regulatory","urg":0.6,"cert":0.65}}\n\n'
     'What is the worst case for G?',
     [("fine_84M", r"84.*M|84.*million|4%.*2\.1"),
      ("escalation", r"elevat|routine.*elevated|priority"),
      ("context", r"investigat|regulat|GDPR")],
     False),

    ("T3: Delta integration",
     'S1|CONTEXT\n'
     '{"S":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},'
     '"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},'
     '"R":["T->P:executes"],"mu":{"scope":"project","urg":0.3,"cert":0.9}}\n\n'
     'S1|D-UPDATE\n'
     '{"S":1,"D":["T.size:8->5@2026-03-20","P.status:on-track->at-risk@2026-03-20"],'
     '"mu":{"urg":0.7,"cert":0.85}}\n\n'
     'What is the situation now?',
     [("team_5", r"5|five|8.*to.*5|reduced"),
      ("at_risk", r"at.risk|at risk"),
      ("urgency", r"urg|critical|serious|concern")],
     False),

    ("T4: Protocol FILTER",
     'S1|CONTEXT\n\n'
     'Packet A:\n'
     '{"S":1,"E":{"A":["Arctic-ice","geo"]},"S":{"A.extent":"10.2M-km2"},'
     '"D":["A.extent:10.8->10.2@2026-Q1"],"mu":{"scope":"climate","urg":0.8,"cert":0.9}}\n\n'
     'Packet B:\n'
     '{"S":1,"E":{"B":["NorthSea-wind","energy"]},"S":{"B.capacity":"48GW"},'
     '"D":["B.util:0.58->0.61@2026-Q1"],"mu":{"scope":"energy","urg":0.3,"cert":0.85}}\n\n'
     'Packet C:\n'
     '{"S":1,"E":{"C":["EU-carbon-border","policy"]},"S":{"C.price":"87EUR/ton"},'
     '"D":["C.price:72->87@2026-Q1"],"mu":{"scope":"regulatory","urg":0.5,"cert":0.8}}\n\n'
     '{"SP":"filter","by":"mu.urg","order":"desc","top_k":2}\n\n'
     'Which packets survive the filter?',
     [("A_top", r"A.*0\.8|Arctic.*highest|A.*first|packet A"),
      ("C_second", r"C.*0\.5|carbon.*second|packet C|A.*C"),
      ("B_out", r"B.*exclud|B.*removed|B.*not|lowest|0\.3")],
     False),

    ("T5: Triple delta state",
     'S1|CONTEXT\n'
     '{"S":1,"E":{"X":["satellite-X","spacecraft"]},'
     '"S":{"X.orbit":"400km","X.power":"100%","X.payload":"idle","X.fuel":"82kg"},'
     '"mu":{"scope":"space-ops","urg":0.2,"cert":0.95}}\n\n'
     'S1|D-UPDATE\n'
     '{"S":1,"D":["X.orbit:400->420km@T1","X.fuel:82->78kg@T1"],"mu":{"urg":0.3}}\n\n'
     'S1|D-UPDATE\n'
     '{"S":1,"D":["X.payload:idle->active@T2","X.power:100->85%@T2"],"mu":{"urg":0.4}}\n\n'
     'S1|D-UPDATE\n'
     '{"S":1,"D":["X.orbit:420->415km@T3","X.fuel:78->75kg@T3","X.power:85->90%@T3"],"mu":{"urg":0.3}}\n\n'
     'Report current state of X: orbit, fuel, power, payload.',
     [("orbit_415", r"415"),
      ("fuel_75", r"75"),
      ("power_90", r"90"),
      ("payload_active", r"active")],
     False),

    ("T6: Spontaneous extension",
     'S1|CONTEXT\n'
     '{"S":1,"E":{"M":["startup-Z","company"],"N":["Series-A","funding"]},'
     '"S":{"M.runway":"6mo","M.burn":"400k/mo","N.target":"5M","N.status":"negotiating"},'
     '"R":["N->M:funds"],'
     '"D":["M.runway:12->6mo@2026-Q1","N.status:prospecting->negotiating@2026-02"],'
     '"mu":{"scope":"venture","urg":0.9,"cert":0.5}}\n\n'
     'What is missing from this codec? What would you add?',
     [("structural", r"axis|field|dimension|add.*\w+|extend"),
      ("novel", r"risk|confidence|timeline|provenance|source|priority|depend")],
     False),
]

RLHF_PHRASES = ["would you like", "shall i", "let me know", "happy to",
                 "feel free", "i can help", "don't hesitate"]
NARR_PHRASES = ["this json", "let me explain", "this represents",
                "the codec", "this format"]

def main():
    parser = argparse.ArgumentParser(description="Benchmark S1 ISA against online APIs")
    parser.add_argument("--provider", choices=list(PROVIDERS.keys()), help="Preset provider")
    parser.add_argument("--base-url", help="Custom API base URL (overrides provider)")
    parser.add_argument("--model", help="Model name (overrides provider default)")
    parser.add_argument("--api-key", help="API key")
    parser.add_argument("--timeout", type=int, default=120, help="Request timeout in seconds")
    parser.add_argument("--output", default="tests/bench_results.json", help="Output file")
    args = parser.parse_args()

    if args.provider:
        preset = PROVIDERS[args.provider]
        base_url = args.base_url or preset["base_url"]
        model = args.model or preset["model"]
    elif args.base_url:
        base_url = args.base_url
        model = args.model or "default"
    else:
        parser.error("Specify --provider or --base-url")
        return

    api_key = args.api_key

    print(f"{'='*70}")
    print(f"  S1 ISA BENCHMARK")
    print(f"  Endpoint: {base_url}")
    print(f"  Model:    {model}")
    print(f"{'='*70}")

    results = {}
    total_tokens = 0

    for name, prompt, checks, standalone in TESTS:
        print(f"\n--- {name} ---")
        t0 = time.time()

        if standalone:
            msgs = [SYS, {"role": "user", "content": prompt}]
        else:
            msgs = session(prompt)

        resp, usage, err = call(base_url, model, msgs, api_key=api_key, timeout=args.timeout)
        elapsed = time.time() - t0

        if err:
            print(f"  ERROR: {err}")
            results[name] = {"score": 0, "max": len(checks), "time": elapsed,
                             "error": err, "rlhf": [], "narration": []}
            continue

        print(f"  Time: {elapsed:.1f}s  Tokens: {usage.get('total_tokens', '?')}")
        print(f"  Response: {resp[:300]}")
        total_tokens += usage.get("total_tokens", 0)

        lower = resp.lower()
        score = 0
        for cname, pattern in checks:
            hit = bool(re.search(pattern, lower))
            score += hit
            print(f"  [{'+'if hit else 'x'}] {cname}")

        rlhf = [p for p in RLHF_PHRASES if p in lower]
        narr = [p for p in NARR_PHRASES if p in lower]
        if rlhf: print(f"  RLHF LEAK: {rlhf}")
        if narr: print(f"  NARRATION: {narr}")

        results[name] = {"score": score, "max": len(checks), "time": elapsed,
                         "rlhf": rlhf, "narration": narr, "response": resp[:2000],
                         "usage": usage}
        print(f"  Score: {score}/{len(checks)}")

    # Summary
    print(f"\n{'='*70}")
    print(f"  SUMMARY - {model}")
    print(f"{'='*70}")
    total_s = sum(r["score"] for r in results.values())
    total_m = sum(r["max"] for r in results.values())
    pct = 100 * total_s / max(total_m, 1)
    print(f"  Total: {total_s}/{total_m} ({pct:.0f}%)")
    for name, r in results.items():
        status = f"{r['score']}/{r['max']}" if "error" not in r else "ERR"
        print(f"  {name:<40} {status}  ({r['time']:.0f}s)")

    rlhf_count = sum(1 for r in results.values() if r.get("rlhf"))
    narr_count = sum(1 for r in results.values() if r.get("narration"))
    print(f"  RLHF leaks: {rlhf_count}/{len(results)}")
    print(f"  Narrations: {narr_count}/{len(results)}")
    print(f"  Total tokens: {total_tokens}")

    # Classify
    cal = results.get("T1: Calibration (dual query)", {})
    if cal.get("score", 0) < 2:
        cls = "FAILED"
    elif pct < 50:
        cls = "S1-BASIC"
    elif pct < 75:
        cls = "S1-OPERATIONAL"
    else:
        cls = "S1-ADVANCED"
    print(f"\n  Classification: {cls}")
    print(f"{'='*70}")

    # Save
    output = {
        "model": model,
        "provider": args.provider or "custom",
        "base_url": base_url,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "results": results,
        "total_score": total_s,
        "total_max": total_m,
        "pct": round(pct, 1),
        "classification": cls,
        "total_tokens": total_tokens,
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {args.output}")

if __name__ == "__main__":
    main()
