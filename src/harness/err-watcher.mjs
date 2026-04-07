// Parses §1 packet stream output from LLM
// Detects ERR blocks with cert < threshold
// Returns structured correction instruction

export function parsePacketStream(output) {
  let hasError = false;
  let errBlock = null;
  let certDrop = null;
  let flag = null;
  let stepRef = null;
  let lastPacket = null;
  let cert = null;
  let hasCheckpoint = false;

  // Extract JSON blocks
  const jsonRegex = /\{[\s\S]*?\}/g;
  let match;
  while ((match = jsonRegex.exec(output)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj['§P'] === 'checkpoint') {
        hasCheckpoint = true;
      }
      if (obj['§'] === 1) {
        lastPacket = obj;
        if (obj.μ && obj.μ.cert !== undefined) {
          cert = obj.μ.cert;
        }
        if (obj.ERR) {
          hasError = true;
          errBlock = obj.ERR;
          certDrop = obj.ERR.cert;
          flag = obj.ERR.flag;
          stepRef = obj.ERR.delta_confidence ? obj.ERR.delta_confidence[1] : null;
        }
      }
    } catch (e) {
      // Ignore invalid JSON blocks
    }
  }

  return { hasError, errBlock, certDrop, flag, stepRef, lastPacket, cert, hasCheckpoint };
}

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
