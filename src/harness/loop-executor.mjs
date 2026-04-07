import { parsePacketStream } from './err-watcher.mjs';
import { createCorrectionInstruction } from './correction-injector.mjs';
import { logCertTrajectory, writeCheckpoint, logError } from './checkpoint.mjs';

export async function runCorrectionLoop(session, initialResult, executeInputFn, context, opts = {}) {
  const { maxIterations = 1, certThreshold = 0.5 } = opts;
  let result = initialResult;
  let iterations = 0;
  let parsed = parsePacketStream(result.content || '');

  while (parsed.hasError && (parsed.certDrop < certThreshold || parsed.errBlock.err === 'FM3-imminent') && iterations < maxIterations) {
    const reason = parsed.errBlock.err === 'FM3-imminent' ? 'FM3 Imminent (Depth/Step Threshold)' : `low cert error (${parsed.certDrop})`;
    console.error(`\n[Harness] Detected ${reason}: ${parsed.errBlock.err}. Injecting Correction Turn...`);
    
    const instruction = createCorrectionInstruction(parsed.lastPacket, parsed.errBlock, parsed.stepRef);
    result = await executeInputFn(context.runtimeHome, context.registry, session, instruction);
    parsed = parsePacketStream(result.content || '');
    
    if (parsed.cert !== null) logCertTrajectory(session, parsed.cert, parsed.stepRef);
    if (parsed.hasCheckpoint && parsed.lastPacket) writeCheckpoint(session, parsed.lastPacket);
    if (parsed.hasError) logError(session, parsed.errBlock);

    iterations++;
  }

  return { result, iterations, parsed };
}
