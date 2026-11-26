import { alignCharacters, letters } from './handwriting-review.mjs?v=ink-3';

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

export function differenceSummary(grade) {
  return [['wrong', '写错'], ['missing', '漏写'], ['extra', '多写']]
    .filter(([key]) => grade[key]).map(([key, label]) => label + ' ' + grade[key] + ' 字').join(' · ');
}

export function comparisonFragment(segments) {
  const fragment = document.createDocumentFragment();
  for (const segment of segments) {
    if (segment.type === 'equal' || segment.type === 'separator') {
      fragment.append(segment.expected);
      continue;
    }
    const tag = document.createElement('span');
    tag.dataset.change = segment.type;
    tag.dataset.actual = segment.actual;
    tag.dataset.expected = segment.expected;
    const label = document.createElement('small');
    label.textContent = { replace: '错', missing: '漏', extra: '多' }[segment.type];
    tag.append(label);
    if (segment.actual) {
      const written = document.createElement('del');
      written.textContent = segment.actual;
      tag.append(written);
    }
    if (segment.type === 'replace') {
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = '→';
      tag.append(arrow);
    }
    if (segment.expected) {
      const expected = document.createElement('ins');
      expected.textContent = segment.expected;
      tag.append(expected);
    }
    fragment.append(tag);
  }
  return fragment;
}
