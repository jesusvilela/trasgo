export function writeCheckpoint(session, packetState) {
  session.checkpoints.push({
    timestamp: new Date().toISOString(),
    state: packetState
  });
}

export function rollback(session) {
  if (session.checkpoints.length === 0) return null;
  const last = session.checkpoints[session.checkpoints.length - 1];
  return last.state;
}

export function getErrorHistory(session) {
  return session.error_history || [];
}

export function logCertTrajectory(session, cert, stepRef) {
  session.cert_trajectory.push({
    timestamp: new Date().toISOString(),
    cert: cert,
    step: stepRef
  });
}

export function logError(session, errBlock) {
  session.error_history.push({
    timestamp: new Date().toISOString(),
    err: errBlock
  });
}
