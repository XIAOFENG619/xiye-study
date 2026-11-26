import { assistedQuestion } from './assisted-questions.mjs?v=ink-3';

const storageKey = 'xiye.chinese.practice.v1';
const marks = ['\u0304', '\u0301', '\u030c', '\u0300'];
const numeralTones = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 轻: 5 };

export function freshState() {
  return { version: 1, revision: 0, active: null, history: [], mistakes: [] };
}

// Count local calendar days, including on days when the UTC offset changes.
function localDate(now, offset = 0) {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  const two = number => String(number).padStart(2, '0');
  return [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join('-');
}

function pinyin(value) {
  let text = String(value).trim().normalize('NFKC').toLowerCase()
    .replace(/\s+/gu, '').replace(/u:/gu, 'ü')
    .replace(/第?([一二三四五轻])声$/u, (_, n) => String(numeralTones[n]))
    .replace(/第?([1-5])声$/u, '$1').normalize('NFD').replace(/u\u0308/gu, 'v');
  const finalDigit = /[1-5]$/.test(text) ? Number(text.slice(-1)) : 0;
  if (finalDigit) text = text.slice(0, -1);
  let marked = 0, position = -1, letters = '';
  for (const char of text) {
    const tone = marks.indexOf(char) + 1;
    if (tone) {
      if (marked || !letters.length || (finalDigit && finalDigit !== tone)) return null;
      marked = tone;
      position = letters.length - 1;
    } else {
      if (!/[a-z]/u.test(char)) return null;
      letters += char;
    }
  }
  return letters ? { letters, tone: marked || finalDigit || 5, explicitTone: Boolean(marked || finalDigit), position } : null;
}

export function pinyinMatches(answer, expected) {
  const a = pinyin(answer), b = pinyin(expected);
  return Boolean(a && b && a.letters === b.letters && a.tone === b.tone &&
    (a.position < 0 || b.position < 0 || a.position === b.position));
}

export function dueMistakes(state, section, now = new Date()) {
  const today = localDate(now);
  return state.mistakes.filter(m => (!section || m.section === section) &&
    m.status === 'pending' && m.dueDate && m.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function session(state, section, kind, question, time) {
  return {
    id: [time, state.history.length, question.id ?? question.key].join('/'),
    section, kind, question: structuredClone(question), phase: 'answer', startedAt: time, submittedAt: null,
    choiceIndex: null, checks: [], corrections: [], answer: null, correct: null, draft: {},
  };
}

function recordSession(state, active) {
  if (active.question.referenceOnly) return { ...state, active };
  const history = [active, ...state.history.filter(item => item.id !== active.id)];
  return { ...state, active, history };
}

function showFeedback(state, active, time) {
  const submitted = recordSession(state, { ...active, phase: 'feedback', draft: {}, submittedAt: time });
  return expose(submitted, active.section, feedbackKeys(active), time);
}

function compare(section, item, raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('请先填写选中词语的答案。');
  const expected = section === 'sound' ? item.pinyin : item.word;
  if (section === 'sound') {
    const reading = pinyin(raw);
    if (!reading || (!reading.explicitTone && pinyin(expected)?.tone !== 5)) {
      throw new Error('请给考字填一个带声调的拼音，可用 tà、ta4 或 ta四声。');
    }
  }
  const correct = section === 'sound' ? pinyinMatches(raw, expected) :
    raw.trim().normalize('NFKC') === expected.normalize('NFKC');
  return { key: item.key, word: item.word, target: item.target, raw, expected, correct };
}

function recordWrong(mistakes, item, section, raw, kind = 'independent') {
  const index = mistakes.findIndex(m => m.key === item.key && m.section === section);
  const previous = mistakes[index];
  const updated = {
    ...item, section, status: 'pending', dueDate: previous?.dueDate ?? null,
    firstWrong: previous?.firstWrong ?? raw, firstWrongKind: previous ? previous.firstWrongKind ?? 'independent' : kind,
    lastWrong: raw, lastAnswer: raw,
    reviews: previous?.reviews ?? [], lastCorrection: previous?.lastCorrection ?? null,
  };
  return index < 0 ? [...mistakes, updated] : mistakes.map((m, i) => i === index ? updated : m);
}

export function feedbackKeys(active) {
  if (!active || active.kind === 'poetry') return [];
  if (active.kind === 'review') return [active.question.key];
  const { rows, correctIndex } = active.question;
  const seen = new Set(rows[correctIndex].map(item => item.key));
  for (const item of rows.flat()) {
    const corrected = active.section === 'sound' ? item.shownPinyin !== item.pinyin : item.shownWord !== item.word;
    if (corrected) seen.add(item.key);
  }
  for (const check of active.checks ?? []) seen.add(check.key);
  return [...seen];
}

function expose(state, section, keys, now) {
  if (!Array.isArray(keys) || !keys.length) return state;
  const seen = new Set(keys);
  const dueDate = localDate(now, 3);
  let changed = false;
  const mistakes = state.mistakes.map(m => {
    if (m.section !== section || m.status !== 'pending' || !seen.has(m.key) || m.dueDate >= dueDate) return m;
    changed = true;
    return { ...m, dueDate };
  });
  const active = state.active;
  if (active?.kind === 'review' && active.phase === 'answer' && active.section === section && seen.has(active.question.key)) {
    return { ...state, mistakes, active: null };
  }
  return changed ? { ...state, mistakes } : state;
}

function groupFeedback(state, active, time, checks = []) {
  let mistakes = state.mistakes;
  const items = active.question.rows.flat();
  for (const check of checks) {
    if (!check.correct) mistakes = recordWrong(mistakes, items.find(w => w.key === check.key), active.section, check.raw);
  }
  return showFeedback({ ...state, mistakes }, { ...active, checks }, time);
}

export function getScreening(state, section) {
  return state.screening?.[section] ?? { picks: {}, currentKey: null };
}

export function assistedQueue(state, section, now = new Date()) {
  const { picks, assistance = {} } = getScreening(state, section);
  const today = localDate(now);
  const reserved = new Set(state.mistakes.filter(m => m.section === section &&
    (m.status === 'remembered' || (m.dueDate && m.dueDate <= today))).map(m => m.key));
  return Object.values(picks).filter(pick => (!pick.correct || pick.unsure) &&
    !assistance[pick.item.key]?.result && !reserved.has(pick.item.key) && assistedQuestion(section, pick));
}

function assistedStep(state, action, now) {
  const { section, key, type, value } = action;
  const current = getScreening(state, section);
  const pick = current.picks[key];
  if (!pick || (pick.correct && !pick.unsure)) return state;
  const previous = current.assistance?.[key] ?? { hinted: false, listened: false };
  const mistake = state.mistakes.find(m => m.section === section && m.key === key);
  if (mistake?.status === 'remembered' || (mistake?.dueDate && mistake.dueDate <= localDate(now))) return state;
  if (type === 'assist-view') return previous.result || previous.hinted ? expose(state, section, [key], now) : state;
  const listening = type === 'assist-listen' && section === 'sound' && !pick.correct;
  if (previous.result && !listening) return state;
  const question = assistedQuestion(section, pick);
  if (!question) return state;

  let updated, mistakes = state.mistakes;
  if (type === 'assist-hint' || type === 'assist-listen') {
    if (type === 'assist-listen' && !listening) return state;
    const field = type === 'assist-hint' ? 'hinted' : previous.result ? 'listenedAfterAnswer' : 'listened';
    if (previous[field]) return expose(state, section, [key], now);
    updated = { ...previous, [field]: true };
  } else {
    let correct;
    if (question.choices) {
      if (!question.choices.includes(value)) throw new Error('请选择本题中的一个选项。');
      correct = value === question.expected;
    } else {
      correct = compare(section, pick.item, value).correct;
      if (!correct) mistakes = recordWrong(mistakes, pick.item, section, value, 'assisted-write');
    }
    updated = { ...previous, result: { value, correct, at: new Date(now).toISOString(), question } };
  }
  const assistance = { ...current.assistance, [key]: updated };
  return expose({ ...state, mistakes, screening: { ...state.screening, [section]: { ...current, assistance } } }, section, [key], now);
}

function screeningStep(state, action, now) {
  const { section, item, key, value, unsure } = action;
  if (!['sound', 'spelling'].includes(section)) throw new Error('请选择字音或字形筛查。');
  const current = getScreening(state, section);
  let next;
  let mistakes = state.mistakes;
  if (action.type === 'screen-next') {
    if (!key || current.currentKey !== key) return state;
    next = { ...current, currentKey: null };
  } else {
    if (current.currentKey || Object.hasOwn(current.picks, item.key)) return state;
    const expected = section === 'sound' ? item.pinyin : item.target;
    if (!item.choices.includes(value) || !item.choices.includes(expected)) throw new Error('请选择本题的一个选项。');
    const correct = value === expected;
    const pick = { item: structuredClone(item), value, unsure: Boolean(unsure), correct, at: new Date(now).toISOString() };
    next = { ...current, currentKey: item.key, picks: { ...current.picks, [item.key]: pick } };
    if (!correct) {
      // A spelling choice is one character; the due recall asks for the whole word.
      const reviewItem = section === 'spelling' ? { ...pick.item, pinyin: item.fullReading } : pick.item;
      mistakes = recordWrong(mistakes, reviewItem, section, value, 'screening');
    }
  }
  const updated = { ...state, screening: { ...state.screening, [section]: next }, mistakes };
  return action.type === 'screen-pick' ? expose(updated, section, [item.key], now) : updated;
}

function poemLetters(value) {
  const text = Array.isArray(value) ? value.join('') : value;
  return String(text).normalize('NFKC').replace(/[\s\p{P}]/gu, '');
}

export function step(state, action, now = new Date()) {
  const time = new Date(now).toISOString();
  const active = state.active;
  if (action.type === 'expose') return expose(state, action.section, action.keys, now);
  if (['assist-hint', 'assist-listen', 'assist-submit', 'assist-view'].includes(action.type)) return assistedStep(state, action, now);
  if (action.type === 'screen-pick' || action.type === 'screen-next') return screeningStep(state, action, now);
  if (action.type === 'begin' || action.type === 'review') {
    if (active) throw new Error('请先结束或继续当前练习。');
    if (action.type === 'begin') {
      const q = action.question;
      const kind = q.section === 'poetry' ? 'poetry' : q.kind;
      return { ...state, active: session(state, q.section, kind, q, time) };
    }
    const item = dueMistakes(state, action.section, now).find(m => m.key === action.key);
    if (!item) throw new Error('这个词还没有到独立复考日期。');
    if (!item.contexts?.length) throw new Error('这个词还缺少复考语境。');
    const context = item.contexts[(1 + item.reviews.length) % item.contexts.length];
    return { ...state, active: { ...session(state, item.section, 'review', item, time), context } };
  }
  if (!active) return state;
  switch (action.type) {
    case 'draft':
      if (active.phase === 'feedback') return state;
      return { ...state, active: { ...active, draft: structuredClone(action.draft ?? {}) } };
    case 'choice': {
      if (active.phase !== 'answer' || !active.question.rows) return state;
      if (!Number.isInteger(action.index) || !active.question.rows[action.index]) throw new Error('请先选择一组选项。');
      const correct = action.index === active.question.correctIndex;
      const answered = { ...active, choiceIndex: action.index, correct, draft: {}, choiceAt: time };
      if (correct) return groupFeedback(state, answered, time);
      return { ...state, active: { ...answered, phase: 'diagnose' } };
    }
    case 'diagnose': {
      if (active.phase !== 'diagnose') return state;
      const words = active.question.rows.flat();
      const checks = Object.entries(action.answers ?? {}).map(([key, value]) => {
        const word = words.find(item => item.key === key);
        if (!word) throw new Error('待核对的词没有出现在这道题里。');
        return compare(active.section, word, value);
      });
      return groupFeedback(state, active, time, checks);
    }
    case 'poetry': {
      if (active.kind !== 'poetry' || active.phase !== 'answer') return state;
      if (typeof action.text !== 'string' || !poemLetters(action.text)) throw new Error('请先填写默写内容。');
      const correct = poemLetters(action.text) === poemLetters(active.question.expected);
      return showFeedback(state, { ...active, answer: action.text, correct }, time);
    }
    case 'recall': {
      if (active.kind !== 'review' || active.phase !== 'answer') return state;
      const check = compare(active.section, active.question, action.answer);
      const mistakes = state.mistakes.map(m => {
        if (m.section !== active.section || m.key !== active.question.key) return m;
        return { ...m, status: check.correct ? 'remembered' : 'pending', dueDate: check.correct ? null : m.dueDate,
          lastWrong: check.correct ? m.lastWrong : action.answer, lastAnswer: action.answer,
          reviews: [...m.reviews, { raw: action.answer, expected: check.expected, correct: check.correct, at: time, context: active.context }] };
      });
      return showFeedback({ ...state, mistakes }, { ...active, answer: action.answer, correct: check.correct, checks: [check] }, time);
    }
    case 'correct': {
      if (active.phase !== 'feedback') return state;
      const missed = active.checks.find(check => check.key === action.key && !check.correct);
      if (!missed) return state;
      const previous = active.corrections.filter(check => check.key === action.key).at(-1);
      if (previous?.correct || previous?.raw === action.answer) return state;
      const item = state.mistakes.find(m => m.key === action.key && m.section === active.section);
      if (!item) return state;
      const correction = { ...compare(active.section, item, action.answer), at: time };
      const mistakes = state.mistakes.map(m => m === item ? { ...item, lastCorrection: correction } : m);
      const corrected = recordSession({ ...state, mistakes }, { ...active, corrections: [...active.corrections, correction] });
      return expose(corrected, active.section, [item.key], now);
    }
    case 'finish': {
      const saved = active.phase === 'diagnose' ? recordSession(state, {
        ...active, phase: 'finished', submittedAt: active.choiceAt, draft: {},
      }) : state;
      return { ...saved, active: null };
    }
    default: throw new Error('未知的练习操作。');
  }
}

export function loadState(storage = globalThis.localStorage) {
  const raw = storage.getItem(storageKey);
  if (raw === null) return freshState();
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.history) || !Array.isArray(value.mistakes) ||
      (value.active !== null && !(value.active?.question && ['answer', 'diagnose', 'feedback'].includes(value.active.phase)))) {
    throw new Error('本机语文练习记录格式无法读取。');
  }
  return value;
}

function withWriteLock(write) {
  if (globalThis.window?.navigator.locks) return window.navigator.locks.request(storageKey, write);
  return write();
}

function persist(previous, next, storage) {
  if (next === previous) return previous;
  const saved = { ...next, revision: previous.revision + 1 };
  storage.setItem(storageKey, JSON.stringify(saved));
  return saved;
}

export async function saveState(previous, next, storage = globalThis.localStorage) {
  return withWriteLock(() => {
    if (loadState(storage).revision !== previous.revision) throw new Error('另一页已更新练习，请重新读取最新记录。');
    return persist(previous, next, storage);
  });
}

// Two tabs may be displaying the same unanswered character. Decide which pick
// commits against the latest state while holding the practice store's lock.
export async function applyScreeningAction(action, storage = globalThis.localStorage, now = new Date()) {
  return withWriteLock(() => {
    const latest = loadState(storage);
    return persist(latest, step(latest, action, now), storage);
  });
}
