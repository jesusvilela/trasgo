# Example: Single-Domain Session (Medical)

A complete session walkthrough: boot → calibrate → context load → query → delta update.

---

## 1. Boot (paste `src/boot.md` seed phase)

The model reads 3 examples across climate, finance, and medical domains.
Grammar induction happens silently during the forward pass.

## 2. Calibrate

```
§1|CALIBRATE

CONTEXT:
{"§":1,
 "E":{"P":["patient-7291","person"],"D":["T2DM","condition"],"M":["metformin","drug"]},
 "S":{"P.age":58,"P.bmi":31.2,"D.hba1c":"7.8%","M.dose":"1000mg/d"},
 "R":["D→P:affects","M→D:treats"],
 "Δ":["D.hba1c:8.4→7.8@2026-01","M.dose:500→1000@2025-11"],
 "μ":{"scope":"clinical","urg":0.5,"cert":0.9}}

Q_codec:   What is P's current metabolic status?
Q_natural: How is patient 7291's diabetes being managed and what's the trend?
```

**Expected answer (either form):**
Patient 7291 (age 58, BMI 31.2) has Type 2 diabetes. HbA1c has improved from 8.4% to 7.8% since the metformin dose was doubled to 1000mg/d in November 2025. The trend is positive but HbA1c remains above target (typically <7.0%).

## 3. Operating — Load full context

```
§1|CONTEXT
{"§":1,
 "E":{"P":["patient-7291","person"],
      "D":["T2DM","condition"],
      "M":["metformin","drug"],
      "G":["GLP-1-RA","drug-class"],
      "N":["nephropathy","complication"],
      "Dr":["endocrinologist","provider"]},
 "S":{"P.age":58,"P.bmi":31.2,"P.egfr":62,
      "D.hba1c":"7.8%","D.duration":"8y",
      "M.dose":"1000mg/d","M.tolerance":"GI-side-effects",
      "G.candidate":true,"G.insurance":"pending-auth",
      "N.stage":"early","N.screen":"microalbuminuria+"},
 "R":["D→P:affects","M→D:treats","D→N:complicates",
      "G→D:treats","Dr→P:manages","N→P.egfr:reduces"],
 "Δ":["D.hba1c:8.4→7.8@2026-01","M.dose:500→1000@2025-11",
      "P.egfr:68→62@2026-02","N.screen:neg→microalbuminuria+@2026-02"],
 "μ":{"scope":"clinical","urg":0.7,"cert":0.85}}
```

## 4. Query

```
Q: Given the eGFR trend and new microalbuminuria finding, should treatment strategy change? |out:dual
```

**Expected §1 response:**
```json
{"§":1,
 "E":{"P":["patient-7291","person"],"G":["GLP-1-RA","drug-class"],"A":["ACEI/ARB","drug-class"]},
 "R":["N→G:favors","N→A:indicates"],
 "Δ":["treatment.priority:glycemic→renoprotective@now"],
 "μ":{"scope":"clinical","urg":0.8,"cert":0.8}}
```

**Expected natural language gloss:**
The declining eGFR (68→62) plus new microalbuminuria shifts treatment priority from purely glycemic control to renoprotection. GLP-1 receptor agonists are now favored not just for HbA1c but for their renoprotective effects. ACE inhibitor or ARB initiation should be considered for microalbuminuria. The GI side effects from metformin also become more relevant as renal function declines.

## 5. Delta update

```
§1|Δ-UPDATE
{"§":1,
 "Δ":["G.insurance:pending→approved@2026-03",
      "G.start:semaglutide-0.25mg@2026-03-15",
      "M.dose:1000→500@2026-03-15"],
 "μ":{"scope":"clinical","urg":0.5,"cert":0.95}}
```

The model integrates this delta with existing state. No need to resend the full context.
Next query operates on the merged state automatically.
