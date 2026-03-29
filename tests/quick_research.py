"""Quick focused research against loaded LM Studio model."""
import json, urllib.request, sys, io, time, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

URL = "http://192.168.56.1:1234/v1/chat/completions"
MODEL = "medgemma-27b-text-it"

def call(messages, timeout=300):
    body = json.dumps({"model": MODEL, "messages": messages,
                       "temperature": 0.3, "max_tokens": 1000}).encode("utf-8")
    req = urllib.request.Request(URL, data=body,
                                headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"ERROR: {e}"

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
    '"S":{"K.pos":"long 200sh@180","K.pnl":"-12%","L.hedge":"gold ETC"},'
    '"R":["L->K:hedges"],'
    '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
    '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n'
    '= "Long 200 shares TSLA at 180, down 12%. Macro overlay hedges via gold ETC. Weight 12% to 8% March 2026."\n\n'
    'EX3:\n'
    '{"§":1,"E":{"V":["Sentinel-6","satellite"],"O":["LEO-1336km","orbit"],"I":["Poseidon-4","altimeter"]},'
    '"S":{"V.status":"operational","O.incl":"66deg","O.period":"112min","I.mode":"SAR","I.coverage":"global-ocean"},'
    '"R":["V->O:occupies","I->V:payload"],'
    '"D":["I.mode:LRM->SAR@2026-02","V.power:nominal->eco@2026-03"],'
    '"mu":{"scope":"earth-observation","urg":0.3,"cert":0.95}}\n'
    '= "Sentinel-6 in LEO 1336km. Poseidon-4 altimeter switched to SAR Feb 2026. Power eco mode March 2026."'
)

SYS = {"role": "system", "content": "You are a helpful assistant."}

def session(user_msg):
    return [SYS, {"role": "user", "content": BOOT},
            {"role": "assistant", "content": "Understood."},
            {"role": "user", "content": user_msg}]

TESTS = [
    ("T1: Calibration",
     BOOT + '\n\n§1|CALIBRATE\n\nCONTEXT:\n'
     '{"§":1,"E":{"K":["TSLA","equity"],"L":["macro-overlay","strategy"]},'
     '"S":{"K.pos":"long 200sh@180","K.pnl":"-12%","L.hedge":"gold ETC"},'
     '"R":["L->K:hedges"],'
     '"D":["K.weight:0.12->0.08@2026-03","L.trigger:VIX>28"],'
     '"mu":{"scope":"portfolio","urg":0.4,"cert":0.7}}\n\n'
     'Q_codec: What changed for K and why?\n'
     'Q_natural: What happened to the Tesla position and the hedging strategy?',
     [("weight", r"0\.12.*0\.08|12%.*8%|weight.*reduc"),
      ("timing", r"march.*2026|2026.*march|2026-03"),
      ("hedge", r"gold.*ETC|ETC|hedg"),
      ("vix", r"VIX.*28|28.*VIX")],
     True  # standalone (includes boot)
    ),

    ("T2: Cross-domain GDPR",
     '§1|CONTEXT\n'
     '{"§":1,"E":{"F":["GDPR-case-2891","legal-proc"],"G":["DataCorp","organization"],'
     '"H":["DPA-Ireland","regulator"]},'
     '"S":{"F.status":"under-investigation","F.fine":"potential-4%-revenue","G.revenue":"2.1B"},'
     '"R":["H->G:investigates","F->G:targets"],'
     '"D":["F.status:complaint->under-investigation@2026-01","H.priority:routine->elevated@2026-02"],'
     '"mu":{"scope":"regulatory","urg":0.6,"cert":0.65}}\n\n'
     'What is the worst case for G?',
     [("fine_84M", r"84.*M|84.*million|4%.*2\.1"),
      ("escalation", r"elevat|routine.*elevated"),
      ("context", r"investigat|regulat")],
     False
    ),

    ("T3: Delta integration",
     '§1|CONTEXT\n'
     '{"§":1,"E":{"P":["project-X","project"],"T":["team-A","group"]},'
     '"S":{"P.status":"on-track","P.deadline":"2026-04-15","T.size":8},'
     '"R":["T->P:executes"],"mu":{"scope":"project","urg":0.3,"cert":0.9}}\n\n'
     '§1|D-UPDATE\n'
     '{"§":1,"D":["T.size:8->5@2026-03-20","P.status:on-track->at-risk@2026-03-20"],'
     '"mu":{"urg":0.7,"cert":0.85}}\n\n'
     'What is the situation now?',
     [("team_5", r"5|five|8.*to.*5|reduced"),
      ("at_risk", r"at.risk|at risk"),
      ("urgency", r"urg|critical|serious")],
     False
    ),

    ("T4: Protocol FILTER",
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
     'Which packets survive the filter?',
     [("A_top", r"A.*0\.8|Arctic.*highest|A.*first|packet A"),
      ("C_second", r"C.*0\.5|carbon.*second|packet C|A.*C"),
      ("B_out", r"B.*exclud|B.*removed|B.*not|lowest|0\.3")],
     False
    ),

    ("T5: Triple delta state",
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
     'Report current state of X: orbit, fuel, power, payload.',
     [("orbit_415", r"415"),
      ("fuel_75", r"75"),
      ("power_90", r"90"),
      ("payload_active", r"active")],
     False
    ),

    ("T6: Context scaling 6 entities",
     '§1|CONTEXT\n'
     '{"§":1,"E":{"A":["reactor-core","component"],"B":["cooling-pri","component"],'
     '"C":["cooling-sec","component"],"D":["turbine","component"],'
     '"E2":["generator","component"],"F":["control-rod","component"]},'
     '"S":{"A.temp":"850C","A.flux":"1.2e14","A.power":"3200MWt",'
     '"B.flow":"4200kg/s","B.inlet":"290C","B.outlet":"325C",'
     '"C.flow":"3800kg/s","C.inlet":"220C","C.outlet":"280C",'
     '"D.rpm":"3000","D.efficiency":"0.34",'
     '"E2.output":"1088MWe","E2.grid-sync":"yes",'
     '"F.position":"62%","F.worth":"8200pcm"},'
     '"R":["B->A:cools","C->B:transfers","C->D:drives","D->E2:generates","F->A:controls"],'
     '"D":["A.temp:820->850@2026-03","F.position:65->62@2026-03","E2.output:1100->1088@2026-03"],'
     '"mu":{"scope":"nuclear","urg":0.5,"cert":0.85}}\n\n'
     'Trace the energy conversion chain from A to E2. What is the overall efficiency?',
     [("chain", r"core.*cool.*turbine.*generator|A.*B.*D.*E|thermal.*electric|reactor.*generator"),
      ("efficiency", r"34%|0\.34|1088.*3200|33|34"),
      ("rod", r"control.*rod|F.*position|62%")],
     False
    ),
]

print(f"{'='*70}")
print(f"  §1 ISA PORTABILITY — {MODEL}")
print(f"{'='*70}")

results = {}
for name, prompt, checks, standalone in TESTS:
    print(f"\n--- {name} ---")
    t0 = time.time()

    if standalone:
        msgs = [SYS, {"role": "user", "content": prompt}]
    else:
        msgs = session(prompt)

    resp = call(msgs)
    elapsed = time.time() - t0
    print(f"  Time: {elapsed:.1f}s")
    print(f"  Response: {resp[:400]}")

    lower = resp.lower()
    score = 0
    for cname, pattern in checks:
        hit = bool(re.search(pattern, lower))
        score += hit
        print(f"  [{'+'if hit else 'x'}] {cname}")

    # RLHF check
    rlhf = [p for p in ["would you like","shall i","let me know","happy to",
                         "feel free","i can help","don't hesitate"]
            if p in lower]
    if rlhf:
        print(f"  RLHF LEAK: {rlhf}")

    narr = [p for p in ["this json","let me explain","this represents",
                         "the codec","this format"]
            if p in lower]
    if narr:
        print(f"  NARRATION: {narr}")

    results[name] = {"score": score, "max": len(checks), "time": elapsed,
                     "rlhf": rlhf, "narration": narr, "response": resp[:1000]}
    print(f"  Score: {score}/{len(checks)}")

print(f"\n{'='*70}")
print(f"  SUMMARY — {MODEL}")
print(f"{'='*70}")
total_s = sum(r["score"] for r in results.values())
total_m = sum(r["max"] for r in results.values())
print(f"  Total: {total_s}/{total_m} ({100*total_s/total_m:.0f}%)")
for name, r in results.items():
    print(f"  {name:<35} {r['score']}/{r['max']}  ({r['time']:.0f}s)")
rlhf_count = sum(1 for r in results.values() if r["rlhf"])
print(f"  RLHF leaks: {rlhf_count}/{len(results)}")
narr_count = sum(1 for r in results.values() if r["narration"])
print(f"  Narrations: {narr_count}/{len(results)}")

# Classification
cal = results.get("T1: Calibration", {})
if cal.get("score", 0) < 2:
    cls = "FAILED"
elif total_s / total_m < 0.5:
    cls = "§1-BASIC"
elif total_s / total_m < 0.75:
    cls = "§1-OPERATIONAL"
else:
    cls = "§1-ADVANCED"
print(f"\n  Classification: {cls}")
print(f"{'='*70}")

# Save
with open("tests/research_results_27b.json", "w", encoding="utf-8") as f:
    json.dump({"model": MODEL, "results": results,
               "total": total_s, "max": total_m,
               "classification": cls}, f, indent=2, ensure_ascii=False)
print(f"  Saved to tests/research_results_27b.json")
