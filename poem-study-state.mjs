export const studyAttemptPrefix = 'xiye.chinese.poemStudy.practice.v1.';
const evidencePrefix = 'xiye.chinese.poemStudy.evidence.v1.';

function sectionKey(poemId, part) {
  if (typeof poemId !== 'string' || !poemId || !Number.isInteger(part) || part < 1) {
    throw new Error('请先选择要学习的一段。');
  }
  return evidencePrefix + encodeURIComponent(poemId) + '/' + part;
}

// A tab carries its most recent recitation to the follow-up question. Other
// tabs may be working on the same passage with a different performance.
export function writeStudyEvidence({ poemId, part, source, status, weakClauses, weakIndexes, paperReviewId, paperRevision }, storage = sessionStorage) {
  const key = sectionKey(poemId, part);
  if (!validEvidence({ source, status, weakClauses, weakIndexes })) {
    throw new Error('这次试背的结果不完整。');
  }
  const evidence = { id: crypto.randomUUID(), poemId, part, source, status, weakClauses: [...new Set(weakClauses)] };
  if (weakIndexes !== undefined) evidence.weakIndexes = [...new Set(weakIndexes)].sort((a, b) => a - b);
  if (source === 'paper' && typeof paperReviewId === 'string' && paperReviewId && Number.isInteger(paperRevision) && paperRevision > 0) {
    evidence.paperReviewId = paperReviewId;
    evidence.paperRevision = paperRevision;
  }
  storage.setItem(key, JSON.stringify(evidence));
  return evidence;
}

function validEvidence({ source, status, weakClauses, weakIndexes }) {
  return ['oral', 'keyboard', 'paper'].includes(source) && ['complete', 'pending'].includes(status) &&
    Array.isArray(weakClauses) && weakClauses.every(clause => typeof clause === 'string' && clause.trim()) &&
    (weakIndexes === undefined || (Array.isArray(weakIndexes) && weakIndexes.every(i => Number.isInteger(i) && i >= 0)));
}

export function readStudyEvidence(poemId, part, storage = sessionStorage) {
  try {
    const entry = JSON.parse(storage.getItem(sectionKey(poemId, part)));
    return entry?.poemId === poemId && entry.part === part && validEvidence(entry) ? entry : null;
  } catch { return null; }
}

export function saveStudyAttempt(attempt, storage = localStorage) {
  const { id, poemId, poemTitle, part, source, kind, prompt, answer, expected, usedHint, correct } = attempt;
  sectionKey(poemId, part);
  if (![id, poemTitle, prompt, expected].every(v => typeof v === 'string' && v.trim()) ||
      typeof answer !== 'string' || typeof usedHint !== 'boolean' || typeof correct !== 'boolean' ||
      !['line','scene'].includes(kind) || !['keyboard','paper','oral'].includes(source)) {
    throw new Error('这道巩固题尚未完成。');
  }
  const key = studyAttemptPrefix + id;
  const fields = { id, poemId, poemTitle, part, source, kind, prompt, answer, expected, usedHint, correct };
  const previous = storage.getItem(key);
  if (previous !== null) {
    const record = JSON.parse(previous);
    if (Object.keys(fields).some(k => fields[k] !== record[k])) throw new Error('这道题已经提交过了，请换一道再练。');
    return record;
  }
  const saved = { ...fields, createdAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(saved));
  return saved;
}

export function listStudyAttempts(storage = localStorage) {
  const attempts = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(studyAttemptPrefix)) continue;
    try {
      const item = JSON.parse(storage.getItem(key));
      if (item?.id && typeof item.answer === 'string' && typeof item.createdAt === 'string') attempts.push(item);
    } catch { /* The remaining practice records can still be read. */ }
  }
  return attempts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
