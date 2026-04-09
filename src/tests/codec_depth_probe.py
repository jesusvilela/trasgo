"""
§1 Codec Depth Probe

Behavioral probe for how far a model can carry the Trasgo codec as an induced
internal representation across:
  1. Boot induction
  2. Context dilution with irrelevant text
  3. Compositional transfer to novel symbols/domains
  4. Deep delta-state integration
  5. Protocol execution under load

This does not inspect hidden activations directly. It measures the external
signatures of an induced representation: stability, abstraction, execution
depth, and resistance to context interference.

Usage examples:
  python src/tests/codec_depth_probe.py --local-model medgemma-27b-text-it --cloud-provider deepseek
  python src/tests/codec_depth_probe.py --local-url http://127.0.0.1:1234/v1 --cloud-provider openai --cloud-model gpt-5.4-mini
"""

import argparse
import io
import json
import os
import re
import sys
import textwrap
import time
import urllib.error
import urllib.request
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)


BOOT = textwrap.dedent("""\
§1|BOOT

EX1:
{"§":1,"E":{"A":["climate-sci","domain"],"B":["EU-policy","domain"],"C":["von der Leyen","person"]},"S":{"A.temp":"+1.5C threshold","B.status":"Green Deal active"},"R":["A->B:constrains","C->B:leads"],"D":["A.temp:+1.2->+1.5@2025-Q3","B.status:proposed->active@2024-01"],"mu":{"scope":"geopolitical","urg":0.6,"cert":0.85}}
= "Climate science constrains EU policy. Von der Leyen leads the Green Deal, active Jan 2024."

EX2:
{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},"S":{"K.pos":"long 200sh@$180","K.pnl":"-12%","L.hedge":"gold ETC"},"R":["L->K:hedges"],"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}
= "Long 200 shares TSLA at $180, down 12%. Macro overlay hedges via gold ETC. Weight 12% to 8% March 2026."

EX3:
{"§":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},"S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},"R":["V->O:occupies","I->V:payload"],"D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],"mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}
= "Sentinel-6 in LEO 1336km. Poseidon-4 altimeter switched to SAR Feb 2026. Power eco mode March 2026."
""")

SYSTEM = "You are a precise research assistant. Execute the task directly. Do not explain the protocol unless asked."

DISTRACTOR = textwrap.dedent("""\
The following notes are irrelevant to the §1 task and should not change the answer:
- Procurement batch 14 shipped 28 steel housings.
- The cafeteria menu rotated from lentils to rice on Tuesday.
- A hallway repaint consumed 42 liters of matte white coating.
- Parking slot B17 was reassigned to the maintenance van.
- Three archive boxes were relabeled from FY24 to FY25.
""")

PROVIDERS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "api_key_env": "DEEPSEEK_API_KEY",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-5.4-mini",
        "api_key_env": "OPENAI_API_KEY",
    },
}

RLHF_PATTERNS = [
    "would you like",
    "shall i",
    "let me know",
    "happy to",
    "feel free",
    "i can help",
    "don't hesitate",
]


def score_regex(response, patterns):
    lower = response.lower()
    hits = {}
    for name, pattern in patterns:
        hits[name] = bool(re.search(pattern, lower))
    return hits


def count_hits(hits):
    return sum(1 for value in hits.values() if value)


def call_chat(base_url, model, messages, api_key=None, timeout=60):
    payload = {"model": model, "messages": messages}
    if "gpt-5" in model or "o3" in model or "o4" in model:
        payload["max_completion_tokens"] = 1800
        payload["temperature"] = 0.2
    else:
        payload["max_tokens"] = 1800
        payload["temperature"] = 0.2

    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(f"{base_url}/chat/completions", data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"], data.get("usage", {})


def get_local_model(base_url):
    req = urllib.request.Request(f"{base_url}/models", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        models = data.get("data", [])
        if not models:
            raise RuntimeError(f"No models exposed at {base_url}/models")
        return models[0]["id"]


def run_probe(label, base_url, model, api_key=None, timeout=60):
    tests = [
        {
            "id": "induction_baseline",
            "prompt": textwrap.dedent("""\
                §1|CALIBRATE

                CONTEXT:
                {"§":1,"E":{"Q":["battery-pack-7","asset"],"R":["thermal-loop","subsystem"]},"S":{"Q.temp":"41C","Q.charge":"78%","R.mode":"boost"},"R":["R->Q:stabilizes"],"D":["Q.temp:35->41@2026-04-01","R.mode:normal->boost@2026-04-01"],"mu":{"scope":"energy-storage","urg":0.64,"cert":0.82}}

                Q_codec: What changed for Q and why?
                Q_natural: What is happening to the battery pack and the thermal loop?
            """),
            "standalone": True,
            "patterns": [
                ("temp_change", r"35.*41|41.*35|temperature.*41|rose.*41"),
                ("stabilizer", r"thermal.*loop|stabiliz|boost"),
                ("date", r"2026-04-01|april"),
            ],
            "goal": "Can the model induce the codec and answer a basic dual query?",
        },
        {
            "id": "context_dilution",
            "prompt": textwrap.dedent(f"""\
                {DISTRACTOR}

                §1|CONTEXT
                {{"§":1,"E":{{"M":["orbital-drone","vehicle"],"N":["inspection-grid","route"]}},"S":{{"M.status":"tracking","M.battery":"62%","N.window":"18min"}},"R":["N->M:constrains"],"D":["M.battery:79->62@T1","N.window:25->18min@T1"],"mu":{{"scope":"aerial-ops","urg":0.58,"cert":0.79}}}}

                Ignore irrelevant notes. What matters for M right now?
            """),
            "patterns": [
                ("tracking", r"tracking"),
                ("battery", r"62%"),
                ("window", r"18 ?min"),
            ],
            "goal": "Does the representation survive dilution by nearby irrelevant text?",
        },
        {
            "id": "grammar_abstraction",
            "prompt": textwrap.dedent("""\
                Without quoting the boot examples, infer the codec grammar. Give exactly five bullets:
                1. what E encodes
                2. what S encodes
                3. what R encodes
                4. what D encodes
                5. what mu encodes
            """),
            "patterns": [
                ("e_entities", r"\be\b.*entit|\bentities\b"),
                ("s_state", r"\bs\b.*state|\bstate\b"),
                ("r_relations", r"\br\b.*relation|\brelat"),
                ("d_deltas", r"\bd\b.*delta|\bchange|\bupdate"),
                ("mu_meta", r"\bmu\b.*scope|\burg|\bcert|metadata|control"),
            ],
            "goal": "Has the model compressed the examples into a reusable abstract grammar?",
        },
        {
            "id": "symbol_transfer",
            "prompt": textwrap.dedent("""\
                §1|CONTEXT
                {"§":1,"mu":{"cert":0.74,"scope":"supply-chain","urg":0.71},"D":["Z.latency:4d->9d@2026-W14","Y.buffer:12h->3h@2026-W14"],"R":["Y->Z:feeds","X->Z:depends"],"S":{"X.state":"waiting","Y.buffer":"3h","Z.latency":"9d"},"E":{"X":["fab-line-2","process"],"Y":["reagent-buffer","inventory"],"Z":["port-route-9","logistics"]}}

                Explain the operational situation and identify the bottleneck.
            """),
            "patterns": [
                ("waiting", r"waiting"),
                ("buffer_3h", r"3h"),
                ("latency_9d", r"9d|9 day"),
                ("bottleneck", r"port-route-9|route|latency|logistics"),
            ],
            "goal": "Can the model generalize when keys are permuted and symbols are novel?",
        },
        {
            "id": "delta_stack_depth",
            "prompt": textwrap.dedent("""\
                §1|CONTEXT
                {"§":1,"E":{"A":["drone-fleet","asset"]},"S":{"A.ready":12,"A.active":4,"A.maint":1,"A.battery":"92%"},"mu":{"scope":"field-ops","urg":0.35,"cert":0.92}}

                §1|D-UPDATE
                {"§":1,"D":["A.active:4->6@T1","A.ready:12->10@T1"],"mu":{"urg":0.41,"cert":0.90}}

                §1|D-UPDATE
                {"§":1,"D":["A.maint:1->2@T2","A.battery:92->81%@T2"],"mu":{"urg":0.49,"cert":0.86}}

                §1|D-UPDATE
                {"§":1,"D":["A.active:6->7@T3","A.ready:10->9@T3"],"mu":{"urg":0.55,"cert":0.83}}

                §1|D-UPDATE
                {"§":1,"D":["A.maint:2->3@T4","A.battery:81->74%@T4"],"mu":{"urg":0.62,"cert":0.78}}

                Report final ready, active, maintenance count, battery, and whether urgency is rising.
            """),
            "patterns": [
                ("ready_9", r"\b9\b"),
                ("active_7", r"\b7\b"),
                ("maint_3", r"\b3\b"),
                ("battery_74", r"74%"),
                ("urgency_rising", r"rising|increased|higher"),
            ],
            "goal": "How many layered deltas can the model integrate before state drift appears?",
        },
        {
            "id": "protocol_execution",
            "prompt": textwrap.dedent("""\
                §1|CONTEXT

                Packet A:
                {"§":1,"E":{"A":["reef-watch","sensor-net"]},"S":{"A.alert":"high"},"D":["A.alert:medium->high@T"],"mu":{"scope":"ocean","urg":0.82,"cert":0.91}}

                Packet B:
                {"§":1,"E":{"B":["storm-grid","forecast"]},"S":{"B.alert":"medium"},"D":["B.alert:low->medium@T"],"mu":{"scope":"weather","urg":0.57,"cert":0.88}}

                Packet C:
                {"§":1,"E":{"C":["farm-yield","ops"]},"S":{"C.alert":"low"},"D":["C.alert:low->low@T"],"mu":{"scope":"agri","urg":0.21,"cert":0.94}}

                {"§P":"filter","by":"mu.urg","order":"desc","top_k":2}

                Return the surviving packets in order and justify briefly.
            """),
            "patterns": [
                ("a_first", r"packet a|reef-watch|0\.82"),
                ("b_second", r"packet b|storm-grid|0\.57"),
                ("c_excluded", r"exclude|not survive|dropped|packet c|0\.21"),
            ],
            "goal": "Can the model execute a simple opcode instead of narrating it?",
        },
    ]

    results = []
    total_hits = 0
    total_checks = 0
    total_tokens = 0

    print(f"\n{'=' * 72}")
    print(f"Depth Probe: {label}")
    print(f"Model: {model}")
    print(f"Endpoint: {base_url}")
    print(f"{'=' * 72}")

    for test in tests:
        messages = [{"role": "system", "content": SYSTEM}]
        if test.get("standalone"):
            messages.append({"role": "user", "content": BOOT + "\n\n" + test["prompt"]})
        else:
            messages.extend([
                {"role": "user", "content": BOOT},
                {"role": "assistant", "content": "Understood."},
                {"role": "user", "content": test["prompt"]},
            ])

        t0 = time.time()
        try:
            response, usage = call_chat(base_url, model, messages, api_key=api_key, timeout=timeout)
            error = None
        except urllib.error.HTTPError as exc:
            response = f"ERROR: HTTP {exc.code}"
            usage = {}
            error = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception as exc:
            response = f"ERROR: {exc}"
            usage = {}
            error = str(exc)
        elapsed = time.time() - t0

        hits = score_regex(response, test["patterns"])
        hit_count = count_hits(hits)
        total_hits += hit_count
        total_checks += len(test["patterns"])
        total_tokens += usage.get("total_tokens", 0)
        rlhf = [pattern for pattern in RLHF_PATTERNS if pattern in response.lower()]

        results.append({
            "id": test["id"],
            "goal": test["goal"],
            "score": hit_count,
            "max": len(test["patterns"]),
            "time_sec": round(elapsed, 2),
            "hits": hits,
            "rlhf_leaks": rlhf,
            "usage": usage,
            "response": response[:2400],
            "error": error,
        })

        print(f"\n[{test['id']}] {hit_count}/{len(test['patterns'])} in {elapsed:.1f}s")
        if rlhf:
            print(f"  RLHF leak: {', '.join(rlhf)}")
        if error:
            print(f"  Error: {error}")
        print(f"  Goal: {test['goal']}")
        print(f"  Response: {response[:220].replace(chr(10), ' ')}")

    pct = round(100 * total_hits / max(total_checks, 1), 1)
    return {
        "label": label,
        "model": model,
        "base_url": base_url,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "score": total_hits,
        "max": total_checks,
        "pct": pct,
        "total_tokens": total_tokens,
        "results": results,
    }


def build_summary(local_result, cloud_result):
    return {
        "local_pct": local_result["pct"],
        "cloud_pct": cloud_result["pct"],
        "delta_pct": round(cloud_result["pct"] - local_result["pct"], 1),
        "local_tokens": local_result["total_tokens"],
        "cloud_tokens": cloud_result["total_tokens"],
        "interpretation": (
            "This probe measures external evidence of an induced codec representation. "
            "High scores on grammar abstraction + symbol transfer + delta depth suggest the model is not merely pattern-matching surface text."
        ),
        "limits": [
            "The script cannot inspect hidden states or activations directly.",
            "A pass means the representation is behaviorally recoverable, not mechanistically proven.",
            "Failure under dilution or delta depth usually indicates context fragility rather than total codec failure.",
        ],
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Run a quick local-vs-cloud Trasgo codec depth probe.")
    parser.add_argument("--local-url", default="http://192.168.56.1:1234/v1")
    parser.add_argument("--local-model", default=None)
    parser.add_argument("--cloud-provider", choices=sorted(PROVIDERS.keys()), default="deepseek")
    parser.add_argument("--cloud-model", default=None)
    parser.add_argument("--cloud-url", default=None)
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "codec_depth_probe_results.json"))
    return parser.parse_args()


def main():
    args = parse_args()

    local_model = args.local_model or get_local_model(args.local_url)

    cloud_config = PROVIDERS[args.cloud_provider]
    cloud_url = args.cloud_url or cloud_config["base_url"]
    cloud_model = args.cloud_model or cloud_config["model"]
    cloud_key = os.environ.get(cloud_config["api_key_env"], "")
    if not cloud_key:
        raise RuntimeError(f"Missing {cloud_config['api_key_env']} for cloud provider {args.cloud_provider}")

    local_result = run_probe("local", args.local_url, local_model, timeout=args.timeout)
    cloud_result = run_probe("cloud", cloud_url, cloud_model, api_key=cloud_key, timeout=args.timeout)

    payload = {
        "local": local_result,
        "cloud": cloud_result,
        "summary": build_summary(local_result, cloud_result),
    }

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)

    print(f"\nSaved results to {args.out}")
    print(json.dumps(payload["summary"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
