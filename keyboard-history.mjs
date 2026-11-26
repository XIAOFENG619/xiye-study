import { compareRecitation } from './keyboard-compare.mjs';

export const keyboardAttemptPrefix = 'xiye.chinese.keyboard.v1.';

export function getKeyboardAttempt(id, storage = localStorage) {
  const value = storage.getItem(keyboardAttemptPrefix + id);
  return value === null ? null : JSON.parse(value);
}

export function listKeyboardAttempts(storage = localStorage) {
  const attempts = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(keyboardAttemptPrefix)) continue;
    const value = storage.getItem(key);
    if (value !== null) attempts.push(JSON.parse(value));
  }
  return attempts.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

// Each submission is immutable. A retry with the same answer returns the
// original snapshot, even if the source material has since been replaced.
export async function saveKeyboardAttempt({ id, poemId, poemTitle, part, reference, answer }, storage = localStorage) {
  if (![id, poemId, poemTitle, reference].every(value => typeof value === 'string' && value.trim()) ||
      !Number.isInteger(part) || part < 0 || typeof answer !== 'string') {
    throw new Error('请选好篇目和范围后再提交。');
  }
  const key = keyboardAttemptPrefix + id;
  const write = () => {
    const previous = getKeyboardAttempt(id, storage);
    if (previous) {
      if (previous.poemId !== poemId || previous.part !== part ||
          previous.reference !== reference || previous.answer !== answer) {
        throw new Error('这次默写已提交，请从学习记录回看，或另开一次练习。');
      }
      return previous;
    }
    const { correct, wrong, missing, extra } = compareRecitation(answer, reference);
    const attempt = { id, poemId, poemTitle, part, reference, answer, correct, wrong, missing, extra,
      submittedAt: new Date().toISOString() };
    storage.setItem(key, JSON.stringify(attempt));
    return attempt;
  };
  const locks = globalThis.window?.navigator.locks;
  return locks ? locks.request(key, write) : write();
}
