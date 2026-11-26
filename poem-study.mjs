import { classFetch as fetch } from './class-api.mjs';
import { splitPoemParts } from './poem-parts.mjs';
import { letters, paperClauses } from './handwriting-review.mjs';
import { getStudyScene } from './poem-study-content.mjs';
import { readStudyEvidence, writeStudyEvidence, saveStudyAttempt } from './poem-study-state.mjs';

const $ = id => document.getElementById(id);
const clean = text => letters(text).join('');
const draftPrefix = 'xiye.chinese.poemStudy.draft.v1.';
let poems = [], poem, parts = [], part = 1, clauses = [];
let state;

const passage = () => parts[part - 1];
const scope = () => new URLSearchParams({ poem: poem.id, part });
const draftKey = () => draftPrefix + scope();
const writingLink = file => {
  const query = scope();
  query.set('study', '1');
  if (file === 'keyboard' && state.stage === 'recall') query.set('covered', '1');
  return './' + file + '.html?' + query;
};

function freshState() {
  return { reference: passage(), stage: 'reading', evidence: null, task: null, seen: [], repaired: [] };
}
function saveDraft() {
  try { sessionStorage.setItem(draftKey(), JSON.stringify(state)); }
  catch { $('notice').textContent = '当前浏览器无法暂存这道题，刷新后需要重新进入。'; }
}
function readDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey()));
    if (draft?.reference === passage() && ['reading', 'recall', 'practice'].includes(draft.stage)
      && Array.isArray(draft.seen) && (draft.stage !== 'practice' || draft.evidence)) return draft;
  } catch { /* A missing draft only affects this passage. */ }
  return freshState();
}

function weakOptions() {
  const options = new Map();
  for (const target of state.evidence?.weakClauses || []) {
    const matches = clauses.flatMap((clause, i) => clean(clause) === clean(target) ? [i] : []);
    const located = (state.evidence.weakIndexes || []).filter(i => matches.includes(i));
    if (located.length) {
      for (const i of located) options.set(i, [i]);
    } else if (matches.length) options.set(matches[0], matches);
  }
  return options;
}

function weakPositions() {
  return [...weakOptions().keys()].sort((a, b) => a - b);
}

function nextWeakPosition() {
  const current = state.task?.index;
  const remaining = weakPositions().filter(i => i !== current && !state.repaired?.includes(i));
  return remaining.find(i => i > current) ?? remaining[0];
}

function makeTask(kind, index = null) {
  let prompt, answer, hint;
  if (kind === 'scene') {
    const scene = getStudyScene(poem, part, passage());
    if (!scene) return null;
    ({ prompt, answer, hint } = scene);
  } else {
    answer = clauses[index];
    const previous = clauses[index - 1], next = clauses[index + 1];
    const possible = kind === 'weak' ? weakOptions().get(index) : null;
    if (possible?.length > 1) {
      prompt = '本段第 ' + possible.map(i => i + 1).join('、') + ' 小句文字相同。请写出这句重复的话。';
    } else if (previous && !clean(previous).includes(clean(answer))) {
      prompt = '接在「' + previous + '」之后的这一小句是什么？';
    } else if (next && !clean(next).includes(clean(answer))) {
      prompt = '写出「' + next + '」之前的这一小句。';
    } else {
      prompt = '请凭记忆写出本段第 ' + (index + 1) + ' 小句。';
    }
    const chars = letters(answer);
    hint = '这句有 ' + chars.length + ' 个字' + (chars.length > 1 ? '，从「' + chars[0] + '」起笔。' : '。');
  }
  return { id: crypto.randomUUID(), kind: kind === 'weak' ? 'line' : kind, index, prompt, expected: answer, hint, hintOpen: false, answer: '', result: null };
}

function recommend(evidence) {
  state.evidence = evidence;
  state.stage = 'practice';
  state.task = null;
  state.seen = [];
  state.repaired = [];
  const [weak] = weakPositions();
  if (weak !== undefined) state.task = makeTask('weak', weak);
  else if (evidence.status === 'complete' && !evidence.weakClauses.length) {
    state.task = makeTask('scene') || makeTask('line', 0);
  }
}

function replaceTask(kind, index) {
  const next = makeTask(kind, index);
  if (!next) return;
  state.task = next;
  $('alternatives').open = false;
  $('notice').textContent = '';
  saveDraft();
  render('practice-title');
}

function populateScope(id, number, fromReview = false, reviewId = null) {
  poem = poems.find(p => p.id === id) || poems[0];
  parts = splitPoemParts(poem.text);
  part = Number.isInteger(number) && number >= 1 && number <= parts.length ? number : 1;
  $('poem').value = poem.id;
  $('part').replaceChildren(...parts.map((_, i) => new Option('第 ' + (i + 1) + ' 段', String(i + 1))));
  $('part').value = String(part);
  clauses = paperClauses(passage());
  for (const select of [$('oral-clause'), $('clause')]) {
    select.replaceChildren(...clauses.map((_, i) => new Option('第 ' + (i + 1) + ' 小句', String(i))));
  }
  state = readDraft();
  $('notice').textContent = '';
  let validEntry = true;
  if (fromReview) {
    const evidence = id === poem.id && number === part ? readStudyEvidence(poem.id, part) : null;
    if (evidence && evidence.poemId === id && evidence.part === number && (reviewId === null || evidence.id === reviewId)) {
      if (state.evidence?.id !== evidence.id || state.stage !== 'practice') recommend(evidence);
    } else {
      validEntry = false;
      state = freshState();
      $('notice').textContent = '这条链接的试背结果已无法读取。可以从本页重新读一段、试背。';
    }
  }
  if (validEntry) {
    history.replaceState(null, '', location.pathname + '?' + scope());
    saveDraft();
  }
  $('alternatives').open = false;
  render();
}

function practiceReason() {
  const evidence = state.evidence;
  if (evidence.status === 'pending') {
    return weakPositions().length ? '纸面已确认有错漏，其余笔迹仍待核对。' : '本段还有笔迹待核。可以回去核对，也可以自己选一道题。';
  }
  if (evidence.source === 'oral') return evidence.weakClauses.length
    ? '你在口头试背时标了一处卡点。' : '你自评这一段背得顺。';
  return evidence.weakClauses.length ? '本次默写有错漏。' : '本段默写已核对，用字正确。';
}

function renderPractice() {
  const task = state.task;
  $('reason').textContent = practiceReason();
  $('prompt').textContent = task?.prompt || '';
  $('write').hidden = !task || !!task.result;
  $('feedback').hidden = !task?.result;
  $('answer').value = task?.answer || '';
  $('submit').disabled = !clean($('answer').value);
  $('reveal').hidden = !$('submit').disabled;
  $('hint').hidden = !task?.hint || task.hintOpen;
  $('hint').setAttribute('aria-expanded', String(Boolean(task?.hintOpen)));
  $('clue').textContent = task?.hintOpen ? task.hint : '';
  $('clue').hidden = !task?.hintOpen;
  if (task?.result) {
    const { correct, usedHint } = task.result;
    $('verdict').textContent = correct ? (usedHint ? '提示后答对' : '本次巩固答对') :
      (task.answer.trim() ? '再对照一次原句' : '先读一遍原句');
    $('mine').textContent = task.answer.trim() || '未填写';
    $('expected').textContent = task.expected;
  }
  const positions = weakPositions();
  $('weak').hidden = !positions.length;
  $('scene').hidden = !getStudyScene(poem, part, passage());
  if ($('scene').hidden) $('reason').textContent += ' 本段尚未配情境题，可以按句默写。';
  $('pending-paper').hidden = state.evidence.status !== 'pending' || state.evidence.source !== 'paper';
  $('pending-paper').href = writingLink('handwriting');
  $('retry-line').hidden = task?.kind !== 'line' || !task.result || task.result.correct;
  $('next-weak').hidden = !task?.result || nextWeakPosition() === undefined;
  $('follow-scene').hidden = !task?.result?.correct || task.kind !== 'line' || $('scene').hidden ||
    !positions.includes(task.index) || !positions.every(i => state.repaired?.includes(i));
  $('next-part').hidden = !task?.result || part >= parts.length;
}

function render(focusId) {
  for (const id of ['reading', 'recall', 'practice']) $(id).hidden = state.stage !== id;
  $('reading-text').textContent = state.stage === 'reading' ? passage() : '';
  $('keyboard').href = writingLink('keyboard');
  $('paper').href = writingLink('handwriting');
  $('oral-choice').hidden = true;
  $('stuck').setAttribute('aria-expanded', 'false');
  for (const id of ['prompt', 'clue', 'verdict', 'mine', 'expected', 'reason']) $(id).textContent = '';
  $('answer').value = '';
  if (state.stage === 'practice') renderPractice();
  if (focusId) $(focusId).focus();
}

function restart() {
  state = freshState();
  saveDraft();
  $('alternatives').open = false;
  render('read-title');
}

function oral(weakIndexes) {
  const evidence = { poemId: poem.id, part, source: 'oral', status: 'complete',
    weakClauses: weakIndexes.map(i => clauses[i]), weakIndexes };
  recommend(writeStudyEvidence(evidence));
  saveDraft();
  render('practice-title');
}

function submitTask() {
  const task = state.task;
  if (!task || task.result) return;
  const normalized = clean(task.expected);
  const result = { correct: clean(task.answer) === normalized,
    usedHint: task.hintOpen || state.seen.some(seen => normalized.includes(seen) || seen.includes(normalized)) };
  try {
    saveStudyAttempt({ id: task.id, poemId: poem.id, poemTitle: poem.title, part,
      kind: task.kind, source: state.evidence.source, prompt: task.prompt,
      answer: task.answer, expected: task.expected, ...result });
  } catch (error) {
    $('notice').textContent = error.message || '本次记录未能保存，请再试一次。';
    return;
  }
  state.seen.push(normalized);
  task.result = result;
  if (task.kind === 'line' && weakPositions().includes(task.index)) {
    state.repaired = (state.repaired || []).filter(i => i !== task.index);
    if (result.correct) state.repaired.push(task.index);
  }
  $('notice').textContent = '';
  saveDraft();
  render('verdict');
}

$('poem').addEventListener('change', () => populateScope($('poem').value, 1));
$('part').addEventListener('change', () => populateScope(poem.id, Number($('part').value)));
$('cover').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + '?' + scope());
  $('notice').textContent = '';
  state.stage = 'recall';
  saveDraft();
  render('recall-title');
});
$('reread').addEventListener('click', restart);
$('restart').addEventListener('click', restart);
$('fluent').addEventListener('click', () => oral([]));
$('stuck').addEventListener('click', () => {
  $('oral-choice').hidden = !$('oral-choice').hidden;
  $('stuck').setAttribute('aria-expanded', String(!$('oral-choice').hidden));
  if (!$('oral-choice').hidden) $('oral-clause').focus();
});
$('oral-choice').addEventListener('submit', event => {
  event.preventDefault();
  oral([Number($('oral-clause').value)]);
});
$('choose-line').addEventListener('submit', event => {
  event.preventDefault();
  replaceTask('line', Number($('clause').value));
});
$('scene').addEventListener('click', () => replaceTask('scene'));
$('follow-scene').addEventListener('click', () => replaceTask('scene'));
$('weak').addEventListener('click', () => replaceTask('weak', weakPositions()[0]));
$('next-weak').addEventListener('click', () => replaceTask('weak', nextWeakPosition()));
$('retry-line').addEventListener('click', () => {
  state.task = { ...state.task, id: crypto.randomUUID(), answer: '', hintOpen: false, result: null };
  saveDraft();
  render('practice-title');
});
$('next-part').addEventListener('click', () => {
  populateScope(poem.id, part + 1);
  restart();
});
$('hint').addEventListener('click', () => {
  state.task.hintOpen = true;
  state.seen.push(clean(state.task.expected));
  saveDraft();
  renderPractice();
  $('answer').focus();
});
$('answer').addEventListener('input', () => {
  state.task.answer = $('answer').value;
  $('submit').disabled = !clean(state.task.answer);
  $('reveal').hidden = !$('submit').disabled;
  saveDraft();
});
$('write').addEventListener('submit', event => {
  event.preventDefault();
  if (clean(state.task.answer)) submitTask();
});
$('reveal').addEventListener('click', () => {
  state.task.answer = '';
  submitTask();
});

async function load() {
  $('reload').hidden = true;
  try {
    const response = await fetch('/api/chinese/poems');
    if (!response.ok) throw Error();
    ({ poems } = await response.json());
    if (!poems?.length) throw Error();
    $('poem').replaceChildren(...poems.map(p => new Option(
      poems.some(other => p.id !== other.id && p.title === other.title) ? p.title + ' · ' + p.locator : p.title, p.id)));
    const query = new URLSearchParams(location.search);
    populateScope(query.get('poem'), Number(query.get('part')), query.get('review') === '1', query.get('evidence'));
    $('poem').disabled = $('part').disabled = false;
  } catch {
    $('notice').textContent = '篇目载入失败，请重新载入。';
    $('reload').hidden = false;
  }
}
$('reload').addEventListener('click', load);
load();
