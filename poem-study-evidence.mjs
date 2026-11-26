import { diffPaperLine, letters, paperClauses, unlocatedPaperClauses } from './handwriting-review.mjs?v=ink-2';
import { isGap, isPending } from './handwriting-rows.mjs?v=ink-2';

function clauseMap(passage) {
  const clauses = paperClauses(passage);
  const owners = clauses.flatMap((clause, index) => letters(clause).map(() => index));
  return { clauses, owners, text: clauses.map(clause => letters(clause).join('')).join('') };
}

// A surplus character sits between positions. Associate it with the word
// just written, except for an insertion before the first word.
function issuePositions(actual, reference) {
  return diffPaperLine(actual, reference).map(({ type, referenceIndex }) =>
    type === 'extra' ? Math.max(0, referenceIndex - 1) : referenceIndex);
}

export function keyboardStudyResult(actual, passage) {
  const { clauses, owners } = clauseMap(passage);
  const weakIndexes = [...new Set(issuePositions(actual, passage).map(index => owners[index]))];
  return { status: 'complete', weakClauses: [...new Set(weakIndexes.map(i => clauses[i]))], weakIndexes };
}

export function paperStudyResult(rows, passage) {
  const { clauses, owners, text } = clauseMap(passage);
  const reviewed = rows.filter(row => row.state === 'checked' || row.state === 'agreed');
  let pending = rows.some(row => isPending(row) || (isGap(row) && row.state === 'ignored')) ||
    !reviewed.length || unlocatedPaperClauses(reviewed, passage).length > 0;
  const weak = new Set();
  const located = new Set();
  for (const row of reviewed) {
    if (row.state !== 'checked') continue;
    const positions = issuePositions(row.actual, row.reference);
    if (!positions.length) continue;
    if (clauses.includes(row.reference)) {
      weak.add(row.reference);
      const index = clauses.indexOf(row.reference);
      if (clauses.lastIndexOf(row.reference) === index) located.add(index);
      else if (isGap(row) && clauses[row.clauseIndex] === row.reference) located.add(row.clauseIndex);
      continue;
    }
    // A user can enter a reference spanning several clauses without punctuation.
    // Map its differences against the original passage, keeping clause boundaries.
    const fragment = letters(row.reference).join('');
    if (!fragment) { pending = true; continue; }
    const possible = positions.map(() => new Set());
    for (let at = text.indexOf(fragment); at !== -1; at = text.indexOf(fragment, at + 1)) {
      const start = Array.from(text.slice(0, at)).length;
      positions.forEach((pos, i) => possible[i].add(owners[start + pos]));
    }
    for (const indexes of possible) {
      if (indexes.size === 1) located.add(indexes.values().next().value);
      const alternatives = new Set([...indexes].map(i => clauses[i]));
      if (alternatives.size === 1) weak.add(alternatives.values().next().value);
      else pending = true;
    }
  }
  return { status: pending ? 'pending' : 'complete',
    weakClauses: [...new Set(clauses.filter(clause => weak.has(clause)))],
    weakIndexes: [...located].sort((a, b) => a - b) };
}
