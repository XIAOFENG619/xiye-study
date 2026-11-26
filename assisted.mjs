import { applyScreeningAction, assistedQueue, dueMistakes, getScreening, loadState } from './chinese-state.mjs?v=ink-3';
import { assistedQuestion } from './assisted-questions.mjs?v=ink-3';
import { playWord, stopWord } from './assisted-audio.mjs?v=ink-3';

const $ = id => document.getElementById(id);
const params = new URL(location.href).searchParams;
const section = params.get('section') === 'spelling' ? 'spelling' : 'sound';
const subject = section === 'sound' ? '字音' : '字形';
let key = null;
let displayed = null;
let nextItem = null;
let missingPick = false;
let submitting = false;
let midnightTimer;

$('title').textContent = subject + '辅助学习';
document.title = $('title').textContent + ' · 习页';
$('screen-link').textContent = '返回' + subject + '筛查';
$('screen-link').href = $('return').href = './screening.html?section=' + section;

function selectItem(item) {
  if (key !== item.key) stopWord();
  key = item.key;
  const query = new URLSearchParams({ section });
  if (item.sourceId) query.set('id', item.sourceId);
  // Very old records can still resume on reload without printing the word in the URL.
  const savedKey = item.sourceId ? null : key;
  if (location.search !== '?' + query || (history.state?.assistedKey ?? null) !== savedKey) {
    history.replaceState(savedKey ? { assistedKey: savedKey } : null, '', location.pathname + '?' + query);
  }
}

function draftKey() {
  return 'xiye.chinese.assisted.draft.' + key;
}

function readDraft() {
  try { return sessionStorage.getItem(draftKey()) || ''; } catch { return ''; }
}

function clearDraft() {
  try { sessionStorage.removeItem(draftKey()); } catch { /* Practice can still continue. */ }
}

function contextText(text, item) {
  const at = section === 'sound' ? text.indexOf(item.word) : -1;
  if (at < 0) { $('context').textContent = text; return; }
  const start = at + item.word.indexOf(item.target);
  const marked = document.createElement('strong');
  marked.textContent = item.target;
  $('context').replaceChildren(text.slice(0, start), marked, text.slice(start + item.target.length));
}

function prepare(pick, question) {
  displayed = pick.item.key;
  $('notice').textContent = '';
  $('step').textContent = pick.correct ? '筛查时拿不准 · 换句试写' :
    (section === 'sound' ? '筛查错选 · 熟字辨音' : '筛查错选 · 句中辨字');
  $('prompt').textContent = question.prompt;
  contextText(question.context, pick.item);
  const options = (question.choices || []).map(value => {
    const b = document.createElement('button');
    const label = document.createElement('span'), mark = document.createElement('span');
    b.className = 'answer';
    b.type = 'button';
    b.dataset.value = value;
    label.className = 'choice-value';
    label.textContent = value;
    mark.className = 'choice-mark';
    b.append(label, mark);
    return b;
  });
  $('choices').replaceChildren(...options);
  $('choices').hidden = !options.length;
  $('write').hidden = Boolean(options.length);
  $('label').textContent = section === 'sound' ? '给加点字注音（可用拼音加声调数字）' : '填写完整词语';
  $('answer').value = options.length ? '' : readDraft();
  $('listen').hidden = question.kind !== 'sound-choice';
}

function paint(state) {
  const { picks, assistance = {} } = getScreening(state, section);
  const queue = assistedQueue(state, section);
  const pick = Object.hasOwn(picks, key) ? picks[key] : undefined;
  const progress = assistance[key] || {};
  const result = progress.result;
  const due = dueMistakes(state, section);
  const held = due.find(row => row.key === key);
  const remembered = state.mistakes.some(m => m.section === section && m.key === key && m.status === 'remembered');
  const allowed = pick && (!pick.correct || pick.unsure) && !held && (!remembered || result);
  const q = allowed ? result?.question || assistedQuestion(section, pick) : null;
  nextItem = queue.find(p => p.item.key !== key)?.item ?? null;

  const review = held || (!q && !missingPick && due[0]);
  $('review').hidden = !review;
  if (review) {
    const id = review.sourceId || picks[review.key]?.item.sourceId;
    $('review').href = './#review?' + new URLSearchParams(id ? { section, id } : { section, key: review.key });
  }
  $('next').hidden = !(nextItem && (!q || result));
  $('return').hidden = Boolean(q && !result);
  $('task').hidden = !q;
  $('empty').hidden = Boolean(q);
  if (!q) {
    if (displayed) stopWord();
    displayed = null;
    $('empty').textContent = missingPick ? '当前浏览器里没有这个词的筛查记录。' :
      held ? '这个词今天到期，可以换句独立复考。' :
      remembered ? '这个词已通过独立复考。' : !Object.keys(picks).length ? '先做一次筛查，选错或拿不准的词会出现在这里。' :
      nextItem ? '这个词目前没有可做的辅助题。' : '本专项目前没有待做的辅助题。';
    return;
  }
  if (displayed !== key) prepare(pick, q);
  $('hint').hidden = !q.hint || Boolean(result);
  $('hint').setAttribute('aria-expanded', String(Boolean(progress.hinted)));
  $('clue').textContent = progress.hinted ? q.hint : '';
  $('clue').hidden = !progress.hinted;
  $('hint').disabled = Boolean(progress.hinted);
  for (const b of $('choices').children) {
    b.setAttribute('aria-disabled', String(Boolean(result)));
    if (!result) continue;
    const right = b.dataset.value === q.expected;
    const wrong = b.dataset.value === result.value && !result.correct;
    if (right || wrong) {
      b.dataset.result = right ? 'correct' : 'wrong';
      b.lastElementChild.textContent = right ? '✓ 正确' : '× 错选';
    }
  }
  $('answer').readOnly = Boolean(result);
  $('submit').hidden = Boolean(result);
  $('feedback').hidden = !result;
  if (result) {
    $('feedback').dataset.result = result.correct ? 'correct' : 'wrong';
    clearDraft();
    if (!q.choices) $('answer').value = result.value;
    $('verdict').textContent = result.correct ? '这次答对了。' : '正确答案是「' + q.expected + '」。';
    $('explanation').textContent = q.explanation;
  }
}

function report(error) {
  $('notice').textContent = error.message || '暂时无法读取本机学习记录，请刷新后再试。';
}

async function refresh() {
  const state = loadState();
  const { picks, assistance } = getScreening(state, section);
  const query = new URLSearchParams(location.search);
  const legacyKey = query.get('key') ?? history.state?.assistedKey;
  let pick;
  if (query.has('id')) pick = Object.values(picks).find(p => p.item.sourceId === query.get('id'));
  else if (legacyKey != null) pick = Object.hasOwn(picks, legacyKey) ? picks[legacyKey] : undefined;
  else pick = assistedQueue(state, section)[0];
  missingPick = !pick && (query.has('id') || legacyKey != null);
  if (pick) selectItem(pick.item);
  else key = null;
  const current = assistance?.[key];
  if (!document.hidden && (current?.hinted || current?.result)) {
    const saved = await applyScreeningAction({ type: 'assist-view', section, key });
    paint(saved);
  } else paint(state);
}

async function act(type, value) {
  if (!displayed || submitting) return;
  const actionKey = displayed;
  submitting = true;
  $('notice').textContent = '';
  try {
    if (type === 'assist-listen') {
      const state = loadState();
      if (dueMistakes(state, section).some(row => row.key === actionKey)) return paint(state);
      await playWord(getScreening(state, section).picks[actionKey].item);
      if (document.hidden || actionKey !== displayed) return;
    }
    const saved = await applyScreeningAction({ type, section, key: actionKey, value });
    if (actionKey === key) paint(saved);
  } catch (error) { report(error); }
  finally { submitting = false; }
}

$('choices').addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (button && button.getAttribute('aria-disabled') !== 'true') void act('assist-submit', button.dataset.value);
});
$('write').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('answer').readOnly) void act('assist-submit', $('answer').value);
});
$('answer').addEventListener('input', () => {
  try { sessionStorage.setItem(draftKey(), $('answer').value); } catch { /* Input stays in the field. */ }
});
$('hint').addEventListener('click', () => void act('assist-hint'));
$('listen').addEventListener('click', () => void act('assist-listen'));
$('next').addEventListener('click', () => {
  if (!nextItem) return;
  selectItem(nextItem);
  refresh().then(() => { if (!$('task').hidden) $('prompt').focus(); }).catch(report);
});
function resume() { if (!document.hidden) refresh().catch(report); }
function watchMidnight() {
  clearTimeout(midnightTimer);
  if (document.hidden) return;
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  midnightTimer = setTimeout(() => {
    // Leaving the page open overnight must not renew an earlier exposure.
    try { paint(loadState()); } catch (error) { report(error); }
    watchMidnight();
  }, midnight.getTime() - Date.now());
}
window.addEventListener('storage', e => { if (!e.key || e.key === 'xiye.chinese.practice.v1') resume(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopWord(); else resume();
  watchMidnight();
});
window.addEventListener('pageshow', e => { if (e.persisted) { resume(); watchMidnight(); } });
window.addEventListener('pagehide', () => { stopWord(); clearTimeout(midnightTimer); });
watchMidnight();
refresh().catch(report);
