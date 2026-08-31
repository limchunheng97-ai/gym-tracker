// Volume-aware double progression: instead of judging readiness to progress purely off
// last session's reps, compare last session's total volume (sum of weight*reps) at the
// current working weight against the BEST volume you've ever put up at that same weight,
// across every past session. This guards against a one-off bad session (illness, fatigue,
// a bad night's sleep) reading as "ready to progress" or "needs to repeat" just because it
// happened to be the most recent one — the benchmark is your proven best, not your last try.
//
// Hit (or beat) your best-ever volume at this weight AND hit the top of the rep range on
//   every set -> add weight, drop back to the bottom of the range.
// Hit (or beat) your best-ever volume at this weight but didn't top out reps -> repeat the
//   weight, aim for more reps.
// Fell short of your best-ever volume at this weight -> repeat the weight; you're below
//   what you've already proven you can do, so re-earn it before adding load.

export function suggestNext(exercise, allEntries) {
  const { repLow, repHigh, increment, unit } = exercise;

  const sessions = (allEntries || [])
    .map((entry) => (entry.sets || []).filter((s) => s.weight != null && s.reps != null))
    .filter((sets) => sets.length > 0);

  if (sessions.length === 0) {
    return {
      weight: null,
      targetReps: repLow,
      note: 'No history yet — log a starting weight for this exercise.',
    };
  }

  const lastSets = sessions[sessions.length - 1];
  const lastWeight = lastSets[lastSets.length - 1].weight;
  const lastVolume = volumeOf(lastSets);
  const lastMinReps = Math.min(...lastSets.map((s) => s.reps));
  const lastAllHitTop = lastSets.every((s) => s.reps >= repHigh);
  const lastAllHitBottom = lastSets.every((s) => s.reps >= repLow);

  // Best volume ever logged at this exact weight, across every past session (including this last one).
  const bestVolumeAtWeight = sessions.reduce((best, sets) => {
    const atWeight = sets.filter((s) => s.weight === lastWeight);
    if (atWeight.length === 0) return best;
    return Math.max(best, volumeOf(atWeight));
  }, 0);

  const metBestVolume = lastVolume >= bestVolumeAtWeight;

  if (metBestVolume && lastAllHitTop) {
    return {
      weight: round(lastWeight + increment, unit),
      targetReps: repLow,
      note: `Matched your best-ever volume at ${lastWeight}${unit} (${lastVolume}) and hit ${repHigh}+ on every set — add ${increment}${unit}.`,
    };
  }

  if (metBestVolume && lastAllHitBottom) {
    return {
      weight: lastWeight,
      targetReps: Math.min(repHigh, lastMinReps + 1),
      note: `At or above your best volume for ${lastWeight}${unit} (${lastVolume}) — same weight, push for more reps.`,
    };
  }

  if (!metBestVolume) {
    return {
      weight: lastWeight,
      targetReps: repLow,
      note: `Below your best-ever volume at ${lastWeight}${unit} (best: ${bestVolumeAtWeight}, last time: ${lastVolume}) — repeat this weight and work back up before progressing.`,
    };
  }

  return {
    weight: lastWeight,
    targetReps: repLow,
    note: `Missed the ${repLow}-rep target on at least one set last time — repeat this weight before progressing.`,
  };
}

function volumeOf(sets) {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

function round(value, unit) {
  const step = unit === 'kg' ? 0.5 : 1;
  return Math.round(value / step) * step;
}
