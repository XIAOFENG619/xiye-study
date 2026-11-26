import { letters } from './handwriting-review.mjs';

// Return the clause where each remembered fragment ends, including a match at the end of the passage.
export function findOralPositions(clauses, cue) {
  const fragment = letters(cue).join('');
  if (!fragment) return [];

  let text = '';
  const ends = clauses.map(clause => {
    text += letters(clause).join('');
    return text.length;
  });
  const positions = new Set();
  let index = 0;
  for (let start = text.indexOf(fragment); start !== -1; start = text.indexOf(fragment, start + 1)) {
    while (ends[index] < start + fragment.length) index++;
    positions.add(index);
  }
  return [...positions];
}
