// Index into visible characters, independent of punctuation or UTF-16 length.
export function letters(text) {
  return Array.from(String(text ?? '').normalize('NFKC').replace(/[\s\p{P}]/gu, ''));
}

function clauseRanges(text) {
  return Array.from(String(text).matchAll(/[^\s\p{P}]+/gu), match => ({
    text: match[0], start: match.index, end: match.index + match[0].length,
  }));
}

export function paperClauses(poemText) {
  return clauseRanges(poemText).map(clause => clause.text);
}

export function faintPaperLine(line) {
  if (line.alternate != null && letters(line.text).join('') !== letters(line.alternate).join('')) return false;
  return [line.confidence, line.alternateConfidence].some(score => Number.isFinite(score) && score < 0.7);
}

// Used only for an explicitly assigned passage. Locate references that have
// actually been reviewed, never the OCR's raw guesses at mathematical text.
export function unlocatedPaperClauses(rows, poemText) {
  let text = '';
  const clauses = paperClauses(poemText).map((reference, clauseIndex) => {
    const start = text.length;
    text += letters(reference).join('');
    return { start, end: text.length, reference, clauseIndex };
  });
  const covered = new Uint8Array(text.length);
  const boundaries = new Set([0, ...clauses.map(clause => clause.end)]);
  // A longer reference often identifies which occurrence of a repeated
  // refrain was written. Allocate those before isolated or partial clauses.
  const references = rows.filter(row => row.reference && row.state !== 'ignored' && row.state !== 'other' &&
    (row.matched !== false || row.state === 'checked'))
    .map(row => letters(row.reference).join('')).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const ref of references) {
    let bestStart = -1;
    let bestScore = 0;
    for (let at = text.indexOf(ref); at >= 0; at = text.indexOf(ref, at + 1)) {
      const end = at + ref.length;
      let fresh = 0;
      for (let i = at; i < end; i++) if (!covered[i]) fresh++;
      if (!fresh) continue;
      const score = fresh * 3 + Number(boundaries.has(at)) + Number(boundaries.has(end));
      if (score > bestScore) {
        bestStart = at;
        bestScore = score;
      }
    }
    if (bestStart >= 0) covered.fill(1, bestStart, bestStart + ref.length);
  }
  return clauses.filter(clause => covered.subarray(clause.start, clause.end).includes(0))
    .map(({ clauseIndex, reference }) => ({ clauseIndex, reference }));
}

// One edit-distance row after consuming the next character of the reference.
function advance(previous, written, expected) {
  const next = new Uint32Array(previous.length);
  next[0] = previous[0] + 1;
  for (let i = 0; i < written.length; i++) {
    next[i + 1] = Math.min(
      previous[i] + Number(written[i] !== expected),
      next[i] + 1,
      previous[i + 1] + 1,
    );
  }
  return next;
}

function emptyRow(length) {
  return Uint32Array.from({ length: length + 1 }, (_, i) => i);
}

// Find the point where an optimal edit path crosses the middle reference row.
// Only two distance rows per pass are needed, regardless of passage length.
function findSplit(a, r, left, right, top, middle, bottom) {
  const forward = a.slice(left, right);
  const backward = forward.slice().reverse();
  let before = emptyRow(forward.length);
  let after = emptyRow(forward.length);
  for (let j = top; j < middle; j++) before = advance(before, forward, r[j]);
  for (let j = bottom - 1; j >= middle; j--) after = advance(after, backward, r[j]);
  let split = 0;
  for (let i = 1; i <= forward.length; i++) {
    if (before[i] + after[forward.length - i] < before[split] + after[forward.length - split]) split = i;
  }
  return left + split;
}

// The same character positions drive both keyboard annotations and OCR crops.
export function alignCharacters(a, r) {
  const path = [];
  let i = 0, j = 0;
  function add(type) {
    const actual = type === 'missing' ? '' : a[i];
    const expected = type === 'extra' ? '' : r[j];
    path.push({ type, actual, expected, actualIndex: i, referenceIndex: j });
    if (type !== 'missing') i++;
    if (type !== 'extra') j++;
  }

  function trace(right, bottom) {
    // Anchor the first occurrence of a repeated character.
    while (i < right && j < bottom && a[i] === r[j]) add('equal');
    if (i === right || j === bottom) {
      while (i < right) add('extra');
      while (j < bottom) add('missing');
      return;
    }
    // Avoid a quadratic traceback table when a longer text is pasted.
    if ((right - i) * (bottom - j) > 128_000 && bottom - j > 1 && right - i > 1) {
      const middle = j + Math.floor((bottom - j) / 2);
      const split = findSplit(a, r, i, right, j, middle, bottom);
      trace(split, middle);
      trace(right, bottom);
      return;
    }
    // With one character left, align its first exact occurrence when possible.
    if (bottom - j === 1 || right - i === 1) {
      if (bottom - j === 1) {
        const found = a.indexOf(r[j], i);
        if (found >= i && found < right) while (i < found) add('extra');
      } else {
        const found = r.indexOf(a[i], j);
        if (found >= j && found < bottom) while (j < found) add('missing');
      }
      add(a[i] === r[j] ? 'equal' : 'replace');
      while (i < right) add('extra');
      while (j < bottom) add('missing');
      return;
    }

    const reverse = a.slice(i, right).reverse();
    const costs = [emptyRow(reverse.length)];
    for (let k = bottom - 1; k >= j; k--) costs.push(advance(costs.at(-1), reverse, r[k]));
    while (i < right || j < bottom) {
      const m = right - i;
      const n = bottom - j;
      const current = costs[n][m];
      if (m && n && current === costs[n - 1][m - 1] + Number(a[i] !== r[j])) {
        add(a[i] === r[j] ? 'equal' : 'replace');
      } else if (n && current === costs[n - 1][m] + 1) {
        add('missing');
      } else {
        add('extra');
      }
    }
  }
  trace(a.length, r.length);
  return path;
}

function align(actual, reference) {
  return alignCharacters(letters(actual), letters(reference));
}

export function diffPaperLine(actual, reference) {
  return align(actual, reference).filter(item => item.type !== 'equal');
}

function lineIssues(primary, alternate, reference) {
  const first = align(primary, reference);
  if (alternate == null || primary === alternate) return first.filter(item => item.type !== 'equal');

  // Align both engines against the same reference positions. Insertions sit
  // immediately before a reference position and may number more than one.
  const second = align(alternate, reference);
  const issues = [];
  let i = 0;
  let j = 0;
  while (i < first.length || j < second.length) {
    const a = first[i];
    const b = second[j];
    if (a?.type === 'extra' && b?.type !== 'extra') {
      issues.push({ ...a, alternate: '' });
      i++;
    } else if (b?.type === 'extra' && a?.type !== 'extra') {
      issues.push({
        type: 'disagreement', actual: '', alternate: b.actual, expected: '',
        actualIndex: a?.actualIndex ?? letters(primary).length,
        referenceIndex: b.referenceIndex,
      });
      j++;
    } else {
      if (a.actual !== b.actual) {
        issues.push({ ...a, type: a.type === 'equal' ? 'disagreement' : a.type, alternate: b.actual });
      } else if (a.type !== 'equal') {
        issues.push(a);
      }
      i++;
      j++;
    }
  }
  return issues;
}

// A photographed row may contain several consecutive clauses. Rank complete
// clauses, independently for each row, so excerpts need not follow book order.
function findReference(poem, clauses, readings) {
  const minimumSimilarity = 0.55;
  const longest = Math.max(0, ...readings.map(reading => reading.length));
  if (!longest) return null;
  let best = null;
  for (let start = 0; start < clauses.length; start++) {
    const costs = readings.map(reading => emptyRow(reading.length));
    let length = 0;
    for (let end = start; end < clauses.length; end++) {
      length += clauses[end].characters.length;
      if (length * minimumSimilarity > longest) break;
      for (const char of clauses[end].characters) {
        readings.forEach((reading, index) => { costs[index] = advance(costs[index], reading, char); });
      }
      const scores = readings.map((reading, index) => {
        const distance = costs[index][reading.length];
        if (Math.min(length, reading.length) <= 2 && distance !== 0) return 0;
        return 1 - distance / Math.max(length, reading.length);
      });
      const score = Math.max(...scores);
      if (score < minimumSimilarity || best && score < best.score) continue;
      if (best && score === best.score) {
        best.ambiguous = true;
      } else {
        best = {
          score, ambiguous: score < 0.75,
          reference: poem.slice(clauses[start].start, clauses[end].end),
        };
      }
    }
  }
  return best;
}

export function matchPaperLines(lines, poemText) {
  const clauses = clauseRanges(poemText).map(clause => ({ ...clause, characters: letters(clause.text) }));
  return lines.map((line, lineIndex) => {
    const text = String(line.text ?? '');
    const alternate = line.alternate == null ? null : String(line.alternate);
    const readings = [...new Set([text, alternate].filter(Boolean))].map(letters);
    const match = findReference(poemText, clauses, readings);
    const reference = match?.reference ?? '';
    return {
      ...line, lineIndex, text, alternate, reference,
      matched: Boolean(match), ambiguous: match?.ambiguous ?? false,
      issues: match ? lineIssues(text, alternate, reference) : [],
    };
  });
}
