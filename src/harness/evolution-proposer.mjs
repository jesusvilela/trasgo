import fs from 'node:fs';
import path from 'node:path';

export function proposeEvolution(dominantFM, sessionState) {
  if (!dominantFM) return null;

  if (dominantFM.includes('FM1')) {
    return JSON.stringify({
      "§1|EVOLVE": true,
      "EX_EVO": {
        "§": 1,
        "E": { "subst": ["substitution", "operation"] },
        "S": { "subst.safe": false },
        "σ": { "env": ["x:=y2"], "context": "λy1.x", "note": "explicit substitution environment prevents capture" }
      },
      "gloss": "σ axis explicitly tracks substitution environments to prevent variable capture failures (FM1)."
    }, null, 2);
  }

  if (dominantFM.includes('FM2')) {
    return JSON.stringify({
      "§1|EVOLVE": true,
      "EX_EVO": {
        "§": 1,
        "E": { "eval": ["strategy", "meta"] },
        "ε": { "strategy": "normal-order", "strict": true, "note": "forces outer reduction first" }
      },
      "gloss": "ε axis specifies the evaluation strategy explicitly to prevent reduction order drift (FM2)."
    }, null, 2);
  }

  if (dominantFM.includes('FM3')) {
    return JSON.stringify({
      "§1|EVOLVE": true,
      "EX_EVO": {
        "§P": "compress", "output": "Δ-only", "checkpoint": true
      },
      "gloss": "§P|COMPRESS mitigates depth collapse (FM3) by forcing compression before threshold is reached."
    }, null, 2);
  }

  if (dominantFM.includes('FM4')) {
    return JSON.stringify({
      "§1|EVOLVE": true,
      "EX_EVO": {
        "§P": "validate", "target": "R-edges", "on_fail": "reject"
      },
      "gloss": "§P|VALIDATE explicitly checks R-edges before allowing normal-form identification to prevent misidentification (FM4)."
    }, null, 2);
  }

  return null;
}

export function saveProposal(baseDir, proposal) {
  const proposalsDir = path.join(baseDir, '.trasgo-runtime', 'proposals');
  if (!fs.existsSync(proposalsDir)) {
    fs.mkdirSync(proposalsDir, { recursive: true });
  }
  const filename = `proposal-${Date.now()}.json`;
  fs.writeFileSync(path.join(proposalsDir, filename), proposal);
  return filename;
}

export function listProposals(baseDir) {
  const proposalsDir = path.join(baseDir, '.trasgo-runtime', 'proposals');
  if (!fs.existsSync(proposalsDir)) return [];
  return fs.readdirSync(proposalsDir).filter(f => f.endsWith('.json')).map(f => {
    const content = fs.readFileSync(path.join(proposalsDir, f), 'utf-8');
    return { id: f, content };
  });
}
