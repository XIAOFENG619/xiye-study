import { classFetch as fetch } from './class-api.mjs?v=ink-4';
import { splitPoemParts } from './poem-parts.mjs?v=ink-4';
import { compareRecitation, comparisonFragment, differenceSummary } from './keyboard-compare.mjs?v=ink-4';
import { getKeyboardAttempt, saveKeyboardAttempt, keyboardDraftPrefix } from './keyboard-history.mjs?v=ink-4';
import { keyboardStudyResult } from './poem-study-evidence.mjs?v=ink-4';
import { readStudyEvidence, writeStudyEvidence } from './poem-study-state.mjs?v=ink-4';

const $ = id => document.getElementById(id);
const initial = new URL(location.href).searchParams;
let study = initial.get('study') === '1';
let poems = [];
let poem;
let parts = [];
let part = 1;
let attempt;
let phase = 'loading';
let saving = false;
const notice = text => { $('notice').textContent = text; };
const meaningful = answer => /[^\s\p{P}]/u.test(answer);
const scope = (poemId, number) => new URLSearchParams({ poem: poemId, part: number }).toString();
const draftKey = () => keyboardDraftPrefix + scope(poem.id, part);

function changePhase(next) {
  phase = next;
  for (const panel of ['reading', 'writing', 'feedback']) $(panel).hidden = panel !== next;
  $('reading-text').textContent = '';
  $('comparison').replaceChildren();
  $('summary').textContent = '';
  $('original-answer').textContent = $('original-reference').textContent = '';
  $('originals').open = false;
  $('answer').value = '';
  $('retry-save').hidden = true;
  $('study-next').hidden = true;
  notice('');
}

function setLinks(poemId, number, id = null, evidenceId = null) {
  const params = new URLSearchParams(scope(poemId, number));
  if (study) params.set('study', '1');
  $('paper-link').href = './handwriting.html?' + params;
  if (id) params.set('attempt', id);
  if (evidenceId) params.set('evidence', evidenceId);
  history.replaceState(null, '', location.pathname + '?' + params);
}

function readDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey()));
    if (draft?.id && typeof draft.answer === 'string' && typeof draft.reference === 'string' &&
        draft.poemId === poem.id && draft.part === part && !getKeyboardAttempt(draft.id)) return draft;
  } catch { /* The current page still accepts input without saved storage. */ }
  return null;
}

function keepDraft() {
  try { sessionStorage.setItem(draftKey(), JSON.stringify({ ...attempt, study, updatedAt: Date.now() })); }
  catch { notice('本页暂时无法保存草稿，请在离开前提交。'); }
}

function choosePoem(id, requestedPart) {
  poem = poems.find(item => item.id === id) || poems[0];
  parts = splitPoemParts(poem.text);
  const number = requestedPart == null ? 1 : Number(requestedPart);
  part = Number.isInteger(number) && number >= 0 && number <= parts.length ? number : 1;
  $('poem').value = poem.id;
  $('part').replaceChildren(new Option('全篇', '0'), ...parts.map((_, i) => new Option('第 ' + (i + 1) + ' 段', i + 1)));
  $('part').value = String(part);
}

function openScope() {
  attempt = readDraft();
  setLinks(poem.id, part);
  if (attempt) {
    enterWriting();
    return;
  }
  changePhase('reading');
  $('reading-text').textContent = part ? parts[part - 1] : poem.text;
}

function updateSubmit() {
  const hasAnswer = meaningful($('answer').value);
  $('submit').disabled = saving || !hasAnswer;
  $('blank').hidden = hasAnswer;
  $('blank').disabled = saving;
}

function enterWriting() {
  changePhase('writing');
  $('answer').value = attempt.answer;
  updateSubmit();
  $('answer').focus();
}

function startAttempt() {
  attempt = {
    id: crypto.randomUUID(), poemId: poem.id, poemTitle: poem.title, part,
    reference: part ? parts[part - 1] : poem.text, answer: '',
  };
  enterWriting();
  keepDraft();
}

function feedback(saved, evidenceId) {
  changePhase('feedback');
  const {answer, reference} = attempt;
  const grade = compareRecitation(answer, reference);
  const summary = $('summary');
  for (const key of ['wrong','missing','extra']) summary.dataset[key] = String(grade[key]);
  summary.textContent = grade.correct ? '用字全部正确。' : differenceSummary(grade);
  $('comparison').replaceChildren(comparisonFragment(grade.segments));
  $('original-answer').textContent = answer || '（未填写）';
  $('original-reference').textContent = reference;
  $('feedback-title').textContent = '《' + attempt.poemTitle + '》' + (attempt.part ? '第 ' + attempt.part + ' 段' : '全篇') + ' · 默写核对';
  $('again').disabled = !poem;
  if (saved) setLinks(attempt.poemId, attempt.part, attempt.id, evidenceId);
  if (study && evidenceId && part > 0 && attempt.reference === parts?.[part - 1]) {
    const link = $('study-next');
    link.href = './poem-study.html?' + new URLSearchParams({ poem: attempt.poemId, part, review: 1, evidence: evidenceId });
    link.hidden = false;
  }
  $('feedback-title').focus();
}

async function submitAttempt() {
  if (saving || !attempt || !['writing','feedback'].includes(phase)) return;
  if (phase === 'writing') attempt.answer = $('answer').value;
  saving = true;
  $('poem').disabled = $('part').disabled = $('answer').disabled = $('retry-save').disabled = true;
  updateSubmit();
  try {
    // A duplicated tab may inherit the draft id; keep the two distinct answers.
    const previous = getKeyboardAttempt(attempt.id);
    if (previous && previous.answer !== attempt.answer) {
      attempt = { ...attempt, id: crypto.randomUUID() };
      keepDraft();
    }
    await saveKeyboardAttempt(attempt);
    try { sessionStorage.removeItem(draftKey()); } catch { /* History was saved. */ }
    let evidenceId;
    if (study && part > 0 && attempt.poemId === poem.id && attempt.part === part &&
        attempt.reference === parts[part - 1]) {
      try {
        evidenceId = writeStudyEvidence({ poemId: poem.id, part, source: 'keyboard',
          ...keyboardStudyResult(attempt.answer, attempt.reference) }).id;
      } catch { /* Keep the saved dictation even if session storage is unavailable. */ }
    }
    feedback(true, evidenceId);
    if (study && part > 0 && !evidenceId) notice('本次默写已保存，暂时无法接续这段的巩固练习。');
  } catch (error) {
    feedback(false);
    notice(error.message || '学习记录保存失败，可重试。');
    $('retry-save').hidden = false;
  } finally {
    saving = false;
    $('poem').disabled = $('part').disabled = !poems.length;
    $('answer').disabled = $('retry-save').disabled = false;
    updateSubmit();
  }
}

async function load() {
  $('retry').hidden = true;
  let saved;
  try { if (initial.has('attempt')) saved = getKeyboardAttempt(initial.get('attempt')); } catch { /* The catalog can still open. */ }
  try {
    const response = await fetch('/api/chinese/poems');
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!data.poems?.length) throw Error();
    poems = data.poems;
    $('poem').replaceChildren(...poems.map(item => new Option(
      poems.some(other => other.id !== item.id && other.title === item.title) ? item.title + ' · ' + item.locator : item.title, item.id)));
    const requested = saved?.poemId ?? initial.get('poem');
    if (saved && !poems.some(item => item.id === requested)) {
      $('setup').hidden = $('paper-link').hidden = true;
      attempt = saved;
      feedback(true);
      return;
    }
    choosePoem(requested ?? (poems.find(item => item.title === '将进酒')?.id), saved?.part ?? initial.get('part'));
    if (study && (poem.id !== initial.get('poem') || part !== Number(initial.get('part')))) study = false;
    $('poem').disabled = $('part').disabled = false;
    if (!saved) {
      openScope();
      if (study && part > 0 && initial.get('covered') === '1' && !initial.has('attempt') && phase === 'reading') startAttempt();
      if (initial.has('attempt')) notice('这个浏览器里没有这次学习记录，已打开篇目。');
      return;
    }
  } catch {
    if (!saved) {
      notice('篇目载入失败，可以重新载入。');
      $('retry').hidden = false;
      return;
    }
    $('setup').hidden = $('paper-link').hidden = true;
  }
  attempt = saved;
  let current;
  if (study && part > 0 && initial.get('evidence')) {
    try { current = readStudyEvidence(saved.poemId, saved.part); } catch { /* History remains readable. */ }
  }
  feedback(true, current?.id === initial.get('evidence') ? current?.id : null);
}

$('poem').addEventListener('change', () => { choosePoem($('poem').value, 1); openScope(); });
$('part').addEventListener('change', () => { part = Number($('part').value); openScope(); });
$('cover').addEventListener('click', startAttempt);
$('answer').addEventListener('input', () => {
  if (phase !== 'writing') return;
  attempt.answer = $('answer').value;
  keepDraft();
  updateSubmit();
});
$('writing').addEventListener('submit', event => {
  event.preventDefault();
  if (meaningful($('answer').value)) void submitAttempt();
});
$('blank').addEventListener('click', () => { if (!meaningful($('answer').value)) void submitAttempt(); });
$('retry-save').addEventListener('click', submitAttempt);
$('retry').addEventListener('click', load);
$('again').addEventListener('click', () => {
  openScope();
  if (phase === 'reading') $('cover').focus();
});
load();
