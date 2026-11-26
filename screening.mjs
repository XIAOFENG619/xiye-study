import { classFetch as fetch } from './class-api.mjs?v=ink-4';
import { applyScreeningAction, assistedQueue, dueMistakes, getScreening, loadState } from './chinese-state.mjs?v=ink-4';

const $ = id => document.getElementById(id);
const section = new URL(location.href).searchParams.get('section') === 'spelling' ? 'spelling' : 'sound';
const sound = section === 'sound';
const title = sound ? '字音筛查' : '字形筛查';
document.title = title + ' · 习页';
$('title').textContent = title;
// The HTML links also work in a static file preview. Live sessions stay on their own origin.
for (const link of document.querySelectorAll('a[data-mode]')) link.setAttribute('href', '?section=' + link.dataset.mode);
document.querySelector(`[data-mode="${section}"]`).setAttribute('aria-current', 'page');

let items;
let displayed;
let cursor;
let locked = false;

function span(text, className) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function showOptions(item) {
  const position = item.word.indexOf(item.target);
  const before = item.word.slice(0, position);
  const after = item.word.slice(position + item.target.length);
  const masked = before + '□' + after;
  const mark = document.createElement('strong');
  mark.textContent = item.target;
  $('word').replaceChildren(before, sound ? mark : '□', after);
  $('word').setAttribute('aria-label', sound ? item.word + '的' + item.target : masked.replace('□', '空格'));
  $('instruction').textContent = sound ? '给加点字选读音' : '根据读音 ' + item.targetReading + '，选字补全词语';
  $('context').textContent = sound ? item.contexts[0] : item.contexts[0].replaceAll(item.word, masked);
  $('unsure').checked = false;
  $('feedback').textContent = '';
  $('answers').replaceChildren(...item.choices.map((value, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer';
    button.dataset.choice = value;
    button.append(span('ABCD'[index], 'choice-letter'), span(value, 'choice-value'), span('', 'choice-mark'));
    return button;
  }));
}

function showFeedback(item, pick, mistake) {
  const correct = sound ? item.pinyin : item.target;
  $('unsure').checked = pick.unsure;
  for (const button of $('answers').children) {
    const value = button.dataset.choice;
    button.setAttribute('aria-disabled', 'true');
    if (value === correct || value === pick.value) {
      button.dataset.result = value === correct ? 'correct' : 'wrong';
      button.lastElementChild.textContent = value === correct ? '✓ 正确' : '× 错选';
    }
  }
  $('feedback').textContent = pick.correct ? '选对了。' : '选错了。正确答案是 ' + correct + '。';
  $('source').textContent = !pick.correct && mistake?.dueDate
    ? item.locator + ' · ' + mistake.dueDate + ' 可复考' : item.locator;
}

function render(state) {
  const { picks, currentKey } = getScreening(state, section);
  const pick = picks[currentKey];
  const unanswered = items.filter(item => !picks[item.key]);
  const item = pick?.item ?? unanswered[0];
  const completed = items.length - unanswered.length;
  const due = dueMistakes(state, section);
  const held = due.find(row => row.key === currentKey);
  const toLearn = assistedQueue(state, section);
  const learnHere = toLearn.some(row => row.item.key === currentKey);
  $('assist-this').hidden = !learnHere;
  if (learnHere) {
    const ref = pick.item.sourceId ? { id: pick.item.sourceId } : { key: currentKey };
    $('assist-this').href = './assisted.html?' + new URLSearchParams({ section, ...ref });
    $('assist-this').textContent = pick.correct ? '换句试写' : '做一道辨析题';
  }
  $('assist-summary').hidden = !toLearn.length;
  if (toLearn.length) {
    $('assist-all').href = './assisted.html?section=' + section;
    $('assist-all').textContent = '开始辅助学习 · ' + toLearn.length + ' 个词';
  }
  const review = held || due[0];
  cursor = currentKey;
  $('review').hidden = !review;
  if (review) {
    const ref = review.sourceId ? { id: review.sourceId } : { key: review.key };
    $('review').href = './#review?' + new URLSearchParams({ section, ...ref });
    $('review').textContent = '开始复考 · ' + due.length + ' 个到期词';
  }

  $('count').textContent = item ? `第 ${Math.min(items.length, completed + (pick ? 0 : 1))} / ${items.length} 字` : `已筛 ${completed} / ${items.length} 字`;
  $('held').hidden = !held;
  $('question').hidden = !item || Boolean(held);
  $('summary').hidden = Boolean(item);
  if (!item || held) {
    displayed = null;
    $('answers').replaceChildren();
    $('word').replaceChildren();
    $('word').removeAttribute('aria-label');
    $('context').textContent = $('source').textContent = $('feedback').textContent = '';
    if (!item) {
      const outcomes = items.map(row => picks[row.key]);
      const wrong = outcomes.filter(row => !row.correct).length;
      const unsure = outcomes.filter(row => row.correct && row.unsure).length;
      $('totals').textContent = `选错 ${wrong} 个，选对但拿不准 ${unsure} 个，选对且有把握 ${completed - wrong - unsure} 个。`;
    }
    return;
  }
  // Keep the four original buttons in place and preserve keyboard focus after a pick.
  if (displayed?.key !== item.key || displayed.choices.some((value, i) => value !== item.choices[i])) showOptions(item);
  displayed = item;
  $('unsure').disabled = Boolean(pick);
  $('next').disabled = !pick;
  $('next').textContent = !unanswered.length ? '看筛查结果' : '下一字';
  if (pick) showFeedback(item, pick, state.mistakes.find(row => row.key === item.key && row.section === section));
  else $('source').textContent = '';
}

async function refresh() {
  let state = loadState();
  const { currentKey } = getScreening(state, section);
  // When a test is already due, keep the previous answer covered.
  if (currentKey && !document.hidden && !dueMistakes(state, section).some(row => row.key === currentKey)) {
    state = await applyScreeningAction({ type: 'expose', section, keys: [currentKey] });
  }
  render(state);
}

function report(error) {
  $('notice').textContent = error.message || '读取筛查进度失败，请重新载入。';
  $('retry').hidden = false;
}

async function commit(action) {
  if (locked) return;
  locked = true;
  try {
    render(await applyScreeningAction({ ...action, section }));
    $('notice').textContent = '';
    $('retry').hidden = true;
    if (action.type === 'screen-next') ($('summary').hidden ? $('word') : $('result-title')).focus();
  } catch (error) { report(error); }
  finally { locked = false; }
}

$('answers').addEventListener('click', event => {
  const button = event.target.closest('button[data-choice]');
  if (button && displayed && !cursor) void commit({
    type: 'screen-pick', item: displayed, value: button.dataset.choice, unsure: $('unsure').checked,
  });
});
function next() {
  if (cursor) void commit({ type: 'screen-next', key: cursor });
}
$('next').addEventListener('click', next);
$('skip-feedback').addEventListener('click', next);
$('retry').addEventListener('click', () => location.reload());

function resume() {
  if (items && !document.hidden) refresh().catch(report);
}
let midnightTimer;
function watchMidnight() {
  clearTimeout(midnightTimer);
  if (document.hidden) return;
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  midnightTimer = setTimeout(() => {
    // Only update the display: an open tab is not a new answer exposure.
    try { if (items) render(loadState()); } catch (error) { report(error); }
    watchMidnight();
  }, midnight.getTime() - Date.now());
}
window.addEventListener('storage', event => { if (!event.key || event.key === 'xiye.chinese.practice.v1') resume(); });
document.addEventListener('visibilitychange', () => { resume(); watchMidnight(); });
window.addEventListener('pageshow', event => { if (event.persisted) { resume(); watchMidnight(); } });
window.addEventListener('pagehide', () => clearTimeout(midnightTimer));
watchMidnight();

try {
  const response = await fetch('/api/chinese/screening?' + new URLSearchParams({ section }));
  if (!response.ok) throw new Error('筛查资料载入失败，请重新载入。');
  const data = await response.json();
  if (!data.items?.length) throw new Error('当前资料还没有可筛查的词条。');
  items = data.items;
  await refresh();
} catch (error) { report(error); }
