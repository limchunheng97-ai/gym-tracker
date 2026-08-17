// Double progression: work within a rep range at a fixed weight.
// Hit the top of the range on every set -> add weight, drop back to the bottom of the range.
// Hit the range but not the top -> repeat the weight, aim for more reps.
// Miss the bottom of the range -> repeat the weight and target as-is (or flag a deload after repeated misses).

export function suggestNext(exercise, lastEntry) {
  const { repLow, repHigh, increment, unit } = exercise;

  if (!lastEntry || !lastEntry.sets || lastEntry.sets.length === 0) {
    return {
      weight: null,
      targetReps: repLow,
      note: 'No history yet — log a starting weight for this exercise.',
    };
  }

  const sets = lastEntry.sets.filter((s) => s.weight != null && s.reps != null);
  if (sets.length === 0) {
    return { weight: null, targetReps: repLow, note: 'No completed sets logged last time.' };
  }

  const lastWeight = sets[sets.length - 1].weight;
  const allHitTop = sets.every((s) => s.reps >= repHigh);
  const allHitBottom = sets.every((s) => s.reps >= repLow);
  const minReps = Math.min(...sets.map((s) => s.reps));

  if (allHitTop) {
    return {
      weight: round(lastWeight + increment, unit),
      targetReps: repLow,
      note: `Hit ${repHigh}+ reps on every set last time — add ${increment}${unit}.`,
    };
  }

  if (allHitBottom) {
    return {
      weight: lastWeight,
      targetReps: Math.min(repHigh, minReps + 1),
      note: `Same weight, push for more reps (last time: ${minReps} on your worst set).`,
    };
  }

  return {
    weight: lastWeight,
    targetReps: repLow,
    note: `Missed the ${repLow}-rep target last time — repeat this weight before progressing.`,
  };
}

function round(value, unit) {
  const step = unit === 'kg' ? 0.5 : 1;
  return Math.round(value / step) * step;
}
