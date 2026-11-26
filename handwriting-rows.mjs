import { diffPaperLine, matchPaperLines, unlocatedPaperClauses, faintPaperLine } from './handwriting-review.mjs?v=ink-3';

export const isGap = row => row.kind === 'gap';
export const isActive = row => !['other', 'ignored'].includes(row.state);
export const isPending = row => ['open', 'later'].includes(row.state);
export const pendingCount = row => isPending(row) ? Math.max(1, row.issues.length) : 0;

function detectedRow(line) {
  const faint = faintPaperLine(line);
  const needsReview = line.ambiguous || line.issues.length > 0 || faint;
  const state = line.matched ? (needsReview ? 'open' : 'agreed') : 'other';
  return { ...line, actual: line.text, faint, state };
}

function sameBox(first, second) {
  return first?.length === 4 && second?.length === 4 &&
    first.every((value, i) => Math.abs(value - second[i]) < .004);
}

// Detected rows use their scan index, manual rows use negatives. Expected
// clauses have a third namespace above the last scan row, keyed by occurrence.
export function syncMissingRows(rows, text, checkWholePassage) {
  if (!checkWholePassage) return rows;
  const actualRows = rows.filter(row => !isGap(row));
  const scanCount = actualRows.filter(row => row.lineIndex >= 0).length;
  const prior = new Map(rows.filter(isGap).map(row => [row.clauseIndex, row]));
  const absences = unlocatedPaperClauses(actualRows.filter(isActive), text);
  const expectedRows = absences.map(({ clauseIndex, reference }) => prior.get(clauseIndex) || {
    kind: 'gap', clauseIndex, reference, lineIndex: scanCount + clauseIndex,
    box: null, text: '', actual: '', issues: [], state: 'open', matched: true,
  });
  return actualRows.concat(expectedRows);
}

function recoverDecision(row, saved) {
  row.state = saved.state;
  row.edited = true;
  if (row.state !== 'ignored') {
    row.reference = String(saved.reference ?? row.reference);
    row.actual = String(saved.actual ?? row.text);
    if (row.state === 'checked') row.ambiguous = false;
    if (row.lineIndex < 0) row.issues = diffPaperLine(row.actual, row.reference);
  }
}

export function buildPaperRows(scan, text, checkWholePassage, savedDecisions = []) {
  let rows = matchPaperLines(scan, text).map(detectedRow);
  const decisions = Array.isArray(savedDecisions) ? savedDecisions.filter(item =>
    item && ['checked', 'later', 'ignored', 'open'].includes(item.state)) : [];
  // Restore handwritten or manually added lines first. They may account for
  // a clause that had no detection in the original scan.
  for (const saved of decisions.filter(item => !isGap(item))) {
    let row;
    if (saved.lineIndex < 0) {
      row = { lineIndex: saved.lineIndex, text: '', reference: '', box: null, issues: [], matched: true };
      rows.push(row);
    } else {
      row = rows.find(item => item.lineIndex === saved.lineIndex && sameBox(item.box, saved.box)) ||
        rows.find(item => sameBox(item.box, saved.box));
    }
    if (row) recoverDecision(row, saved);
  }
  rows = syncMissingRows(rows, text, checkWholePassage);
  for (const saved of decisions.filter(isGap)) {
    const row = rows.find(item => isGap(item) && item.clauseIndex === saved.clauseIndex && item.reference === saved.reference);
    if (row) recoverDecision(row, saved);
  }
  return rows;
}

export function paperDecisions(rows) {
  return rows.filter(row => row.edited).map(row => {
    const saved = { lineIndex: row.lineIndex, box: row.box, state: row.state };
    if (isGap(row)) Object.assign(saved, { kind: 'gap', clauseIndex: row.clauseIndex, reference: row.reference });
    if (row.state !== 'ignored') Object.assign(saved, { reference: row.reference, actual: row.actual });
    return saved;
  });
}
