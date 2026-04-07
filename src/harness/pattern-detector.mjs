export function analyzeErrorHistory(history) {
  const counts = {};
  for (const entry of history) {
    const errType = entry.err.err;
    if (errType) {
      counts[errType] = (counts[errType] || 0) + 1;
    }
  }

  let dominantFM = null;
  let maxCount = 0;

  for (const [errType, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantFM = errType;
    }
  }

  // Define thresholds
  let systematic = false;
  if (dominantFM && dominantFM.includes('FM1') && maxCount >= 2) systematic = true;
  if (dominantFM && dominantFM.includes('FM2') && maxCount >= 2) systematic = true;
  if (dominantFM && dominantFM.includes('FM3') && maxCount >= 1) systematic = true;
  if (dominantFM && dominantFM.includes('FM4') && maxCount >= 2) systematic = true;

  return { systematic, dominantFM, frequency: maxCount };
}
