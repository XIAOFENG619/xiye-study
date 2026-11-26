import { alignCharacters, letters } from './handwriting-review.mjs';

// Keep the source's original spaces and punctuation at their character boundaries.
function referenceLayout(text) {
  const characters = [];
  const separators = new Map();
  for (const [run] of String(text).matchAll(/[\s\p{P}]+|[^\s\p{P}]+/gu)) {
    if (/^[\s\p{P}]/u.test(run)) {
      separators.set(characters.length, (separators.get(characters.length) ?? '') + run);
    } else {
      for (const char of letters(run)) characters.push(char);
    }
  }
  return { characters, separators };
}

export function compareRecitation(typed, reference) {
  const { characters, separators } = referenceLayout(reference ?? '');
  const path = alignCharacters(referenceLayout(typed ?? '').characters, characters);
  const result = { wrong: 0, missing: 0, extra: 0, correct: true, segments: [] };
  function addSeparator(index) {
    if (!separators.has(index)) return;
    result.segments.push({ type: 'separator', actual: '', expected: separators.get(index) });
  }
  for (const { type, actual, expected, referenceIndex } of path) {
    if (type !== 'extra') addSeparator(referenceIndex);
    result.segments.push({ type, actual, expected });
    if (type === 'replace') result.wrong++;
    if (type === 'missing') result.missing++;
    if (type === 'extra') result.extra++;
  }
  addSeparator(characters.length);
  result.correct = result.wrong + result.missing + result.extra === 0;
  return result;
}
