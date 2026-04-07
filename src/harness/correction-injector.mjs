import { buildCorrectionTurn } from './err-watcher.mjs';

// Takes correction packet from buildCorrectionTurn
// Injects into next LLM call as user turn content
// Appends §P|VALIDATE instruction:
//   "Does the delta at step N satisfy the β-reduction rule given pre-state?"
// Returns LLM response for further parsing

export function createCorrectionInstruction(packetState, errBlock, stepRef) {
  const correctionPacket = buildCorrectionTurn(packetState, errBlock);
  const instruction = `\n§P|VALIDATE\n${correctionPacket}\n\nDoes the delta at ${stepRef || 'the flagged step'} satisfy the correct reduction rule given the pre-state? If capture risk is detected, apply alpha-renaming before proceeding.`;
  return instruction;
}
