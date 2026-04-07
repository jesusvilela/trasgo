// Parses §1 packet stream output from LLM
// Detects ERR blocks with cert < threshold
// Returns structured correction instruction

// Walk the text and extract every balanced top-level {...} block. The previous
// implementation used /\{[\s\S]*?\}/g which is non-greedy and matches the
// innermost braces only — meaning §1 packets with nested μ/ERR objects were
// never recognised and the entire harness layer ran on null state.
function extractJsonBlocks(text) {
  const blocks = [];
  if (!text) return blocks;

  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          blocks.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }

  return blocks;
}

export function parsePacketStream(output) {
  let hasError = false;
  let errBlock = null;
  let certDrop = null;
  let flag = null;
  let stepRef = null;
  let lastPacket = null;
  let cert = null;
  let hasCheckpoint = false;

  for (const block of extractJsonBlocks(output)) {
    let obj;
    try {
      obj = JSON.parse(block);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;

    if (obj['§P'] === 'checkpoint') {
      hasCheckpoint = true;
    }

    if (obj['§'] === 1) {
      lastPacket = obj;
      if (obj.μ && typeof obj.μ === 'object' && obj.μ.cert !== undefined) {
        cert = obj.μ.cert;
      }
      if (obj.ERR && typeof obj.ERR === 'object') {
        hasError = true;
        errBlock = obj.ERR;
        if (typeof obj.ERR.cert === 'number') {
          certDrop = obj.ERR.cert;
        } else if (typeof cert === 'number') {
          certDrop = cert;
        }
        flag = obj.ERR.flag || null;
        stepRef = Array.isArray(obj.ERR.delta_confidence) ? obj.ERR.delta_confidence[1] : null;
      }
    }
  }

  return { hasError, errBlock, certDrop, flag, stepRef, lastPacket, cert, hasCheckpoint };
}

export { extractJsonBlocks };

export function buildCorrectionTurn(packetState, errBlock) {
  // Constructs §P|VALIDATE instruction targeting flagged step
  // Returns §1 packet for injection into next user turn
  return JSON.stringify({
    "§": 1,
    "E": packetState ? packetState.E : {},
    "S": packetState ? packetState.S : {},
    "Δ": packetState ? packetState.Δ : [],
    "μ": {
      "scope": "correction",
      "cert": 0.0,
      "flag": "VALIDATE-STEP"
    }
  }, null, 2);
}
