import { classFetch as fetch } from './class-api.mjs';
import { renderHome } from './chinese-home.mjs?v=study-1';
import { isClassEdition } from './practice-edition.mjs';
import { mountDeskWindow } from './desk-window.mjs';
import { renderActive, renderModeMenu, renderPoemCatalog, renderRecords, escapeHtml } from './chinese-views.mjs?v=recall-2';
import { dueMistakes, feedbackKeys, loadState, saveState, step } from './chinese-state.mjs';
import { listPaperReviews, paperReviewPrefix } from './handwriting-history.mjs';
import { listKeyboardAttempts, keyboardAttemptPrefix } from './keyboard-history.mjs';
import { listStudyAttempts, studyAttemptPrefix } from './poem-study-state.mjs';

const main = document.getElementById('study-main');
const sectionNames = { poetry: '古诗练习', sound: '字音练习', spelling: '字形练习' };
const draftKey = 'xiye.chinese.practice.v1.draft';
const editor = crypto.randomUUID();
let state;
let writes = Promise.resolve();
let routeId = 0;
let busy = false;
let closeWindow = null;

function notify(text) {
  let notice = main.querySelector('[data-notice]');
  if (!notice) {
    notice = document.createElement('p');
    notice.dataset.notice = '';
    notice.className = 'feedback-box';
    notice.setAttribute('role', 'alert');
    const form = main.querySelector('form');
    if (form) form.prepend(notice);
    else main.prepend(notice);
  }
  notice.textContent = text;
}

// Each edit is based on the state saved by the previous edit, including fast typing.
function update(transform) {
  const result = writes.then(async () => {
    const previous = state;
    const next = transform(previous);
    if (next !== previous) state = await saveState(previous, next);
  });
  writes = result.catch(() => {});
  return result;
}

async function api(path, params = {}) {
  const currentRoute = routeId;
  const notice = document.createElement('p');
  const timer = setTimeout(() => {
    if (routeId !== currentRoute) return;
    notice.className = 'muted';
    notice.setAttribute('role', 'status');
    notice.textContent = path === 'catalog' ? '正在读取篇目…' : '正在取题…';
    main.append(notice);
  }, 300);
  try {
    const response = await fetch('/api/chinese/' + path + '?' + new URLSearchParams(params));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '取题失败，请再试一次。');
    return data;
  } finally {
    clearTimeout(timer);
    notice.remove();
  }
}

function page() { return location.hash.slice(1) || 'desk'; }

function show(html) {
  closeWindow?.();
  closeWindow = null;
  main.innerHTML = html;
}

function setNav(target) {
  document.querySelectorAll('.mast nav [data-section]').forEach(link => {
    if (link.dataset.section === target) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

async function continueHere() {
  const currentRoute = routeId;
  if (state.active?.phase === 'feedback' && !document.hidden) {
    const { id, section } = state.active;
    await update(current => current.active?.id === id
      ? step(current, { type: 'expose', section, keys: feedbackKeys(current.active) }) : current);
  }
  if (currentRoute !== routeId || !state.active) return;
  history.replaceState(null, '', '#continue');
  setNav('desk');
  show(renderActive(state));
}

function soundKind(current) {
  const count = current.history.filter(row => row.section === 'sound' && ['group', 'passage'].includes(row.kind)).length;
  return count % 4 === 3 ? 'passage' : 'group';
}

function unsentWork(active) {
  if (!active || active.phase === 'feedback') return '';
  const { draft } = active;
  if (active.phase === 'diagnose') {
    const typed = Object.values(draft.answers || {}).some(value => value.trim());
    if (!typed && !draft.selectedKeys?.length) return '';
    const unfinished = typed ? (active.section === 'sound' ? '填写的注音' : '填写的词语') : '勾选的词';
    return `切换后会清除${unfinished}，已提交的选项 ${'ABCD'[active.choiceIndex]} 会保留。`;
  }
  const letter = active.question.rows?.[draft.index] && 'ABCD'[draft.index];
  if (letter) return `切换后会清除尚未提交的选项 ${letter}。`;
  if (draft.text?.trim()) return '切换后会清除这次默写的草稿。';
  if (draft.answer?.trim()) return '切换后会清除这次复考的草稿。';
  return '';
}

// Fetch before replacing an unfinished question so that network errors preserve it.
async function start(section, { title, previous, reviewKey, confirmedRevision } = {}) {
  const routeAtStart = routeId;
  const hashAtStart = location.hash;
  const activeId = state.active?.id;
  const startRevision = state.revision;
  const loss = unsentWork(state.active);
  if (loss && confirmedRevision !== state.revision) return switchPanel(section, title, reviewKey, loss);
  const due = dueMistakes(state, section).find(item => !reviewKey || item.key === reviewKey);
  if (reviewKey && !due) throw new Error('这条记录还没有到复考日期。');
  const action = due ? { type: 'review', section, key: due.key } : {
    type: 'begin',
    question: await api('question', section === 'poetry'
      ? { section, title, previous: previous || '' }
      : { section, kind: section === 'sound' ? soundKind(state) : 'group' }),
  };
  const stillHere = () => routeAtStart === routeId && location.hash === hashAtStart;
  if (!stillHere()) return;
  await update(current => {
    if (!stillHere()) return current;
    if (current.active?.id !== activeId || (current.revision !== startRevision && unsentWork(current.active))) {
      throw new Error('原题刚有新的作答，请回书桌继续。');
    }
    const finished = current.active ? step(current, { type: 'finish' }) : current;
    return step(finished, action);
  });
  if (stillHere() && state.active) await continueHere();
}

function switchPanel(section, title, reviewKey, loss) {
  const destination = title ? `《${title}》` : reviewKey ? sectionNames[section].slice(0, 2) + '复考' : sectionNames[section];
  show(`<section class="paper"><h1 tabindex="-1">切换到${escapeHtml(destination)}？</h1><p>${escapeHtml(loss)}</p>
    <div class="actions"><a class="button-primary" href="#continue">继续原题</a>
    <button class="button-secondary" data-switch="${section}" data-title="${escapeHtml(title)}"
      data-key="${escapeHtml(reviewKey)}" data-revision="${state.revision}">切换练习</button></div></section>`);
  main.querySelector('h1').focus();
}

async function route() {
  const id = ++routeId;
  await writes;
  if (id !== routeId) return;
  const target = page();
  if (!isClassEdition && /^(home$|history$|materials$|session=|material=)/u.test(target)) {
    location.replace('./english.html' + location.hash);
    return;
  }
  setNav(target === 'records' ? 'records' : 'desk');
  try {
    if (target === 'records') return show(renderRecords(state, listPaperReviews(), listKeyboardAttempts(), listStudyAttempts()));
    const modeSection = target.endsWith('-modes') && target.slice(0, -6);
    if (modeSection && Object.hasOwn(sectionNames, modeSection)) return show(renderModeMenu(modeSection));
    if (target.startsWith('review?')) {
      const query = new URLSearchParams(target.slice('review?'.length));
      const section = query.get('section'), sourceId = query.get('id');
      const key = sourceId ? state.mistakes.find(m => m.section === section && m.sourceId === sourceId)?.key : query.get('key');
      if (state.active?.kind === 'review' && state.active.phase === 'answer' &&
          state.active.section === section && state.active.question.key === key) return await continueHere();
      if (!dueMistakes(state, section).some(row => row.key === key)) {
        location.replace('#records');
        return;
      }
      return await start(section, { reviewKey: key });
    }
    if (target === 'continue' && state.active) return await continueHere();
    if (Object.hasOwn(sectionNames, target)) {
      if (state.active?.section === target && state.active.phase !== 'feedback') return await continueHere();
      if (target === 'poetry') {
        const { titles } = await api('catalog');
        if (id === routeId) show(renderPoemCatalog(titles));
      } else await start(target);
      return;
    }
    show(renderHome(state, {
      pendingCount: state.mistakes.filter(m => m.status === 'pending').length,
      dueCount: dueMistakes(state).length,
    }));
    closeWindow = mountDeskWindow(main.querySelector('.desk-spread'));
  } catch (error) {
    if (id !== routeId) return;
    show('<section class="paper"><div class="actions"><button class="button-primary" data-action="retry">再试一次</button><a class="back-link" href="#desk">回练习书桌</a></div></section>');
    notify(error.message);
  }
}

function formDraft(form) {
  const data = new FormData(form);
  switch (form.dataset.form) {
    case 'choice': return { index: data.get('index') };
    case 'pick': return { selectedKeys: Array.from(form.querySelectorAll('input:checked'), input => input.value), writing: false };
    case 'diagnose': return { answers: Object.fromEntries(data), writing: true };
    case 'poetry': return { text: data.get('text') };
    case 'recall': return { answer: data.get('answer') };
  }
  return null;
}

function saveDraft(event) {
  const form = event.target.form;
  if (busy || !form || !state.active || !main.contains(form)) return;
  const patch = formDraft(form);
  if (!patch) return;
  if (form.dataset.form === 'pick') form.querySelector('[type="submit"]').disabled = !patch.selectedKeys.length;
  const { id, phase } = state.active;
  const journal = {
    id, phase, writing: Boolean(state.active.draft.writing), revision: state.revision,
    draft: { ...state.active.draft, ...patch, editor }, token: crypto.randomUUID(),
  };
  const encoded = JSON.stringify(journal);
  // A reload can interrupt an outstanding Web Lock, even after the input event.
  // Save the latest form synchronously and clear it after the shared state commits.
  try { localStorage.setItem(draftKey, encoded); }
  catch (error) { notify(error.message); }
  update(current => {
    if (current.active?.id !== id || current.active.phase !== phase) return current;
    return step(current, { type: 'draft', draft: journal.draft });
  }).then(() => clearJournal(encoded)).catch(error => notify(error.message));
}

function clearJournal(encoded) {
  if (localStorage.getItem(draftKey) === encoded) localStorage.removeItem(draftKey);
}

async function recoverDraft() {
  const encoded = localStorage.getItem(draftKey);
  if (!encoded) return;
  let pending;
  try { pending = JSON.parse(encoded); } catch { return; }
  await update(current => {
    const a = current.active;
    if (!a || !pending?.draft || a.id !== pending.id || a.phase !== pending.phase ||
        Boolean(a.draft.writing) !== pending.writing) return current;
    // Another tab may have replaced this draft in the meantime.
    if (current.revision !== pending.revision && a.draft.editor !== pending.draft.editor) return current;
    return step(current, { type: 'draft', draft: pending.draft });
  });
  clearJournal(encoded);
}

function act(task) {
  if (busy) return;
  busy = true;
  Promise.resolve().then(async () => { await writes; await task(); })
    .catch(error => notify(error.message)).finally(() => { busy = false; });
}

async function advance(action) {
  const id = state.active?.id;
  const from = routeId;
  await update(current => current.active?.id === id ? step(current, action) : current);
  if (from === routeId && state.active) await continueHere();
}

main.addEventListener('input', saveDraft);
main.addEventListener('toggle', event => {
  const details = event.target;
  const { exposeKey, exposeSection } = details.dataset;
  if (!details.open || !exposeKey) return;
  update(current => step(current, { type: 'expose', section: exposeSection, keys: [exposeKey] }))
    .then(() => {
      const due = state.mistakes.find(m => m.key === exposeKey && m.section === exposeSection)?.dueDate;
      const time = details.closest('.record-row')?.querySelector('[data-due-for]');
      if (time && due) { time.dateTime = due; time.textContent = due; }
    }).catch(error => { details.open = false; notify(error.message); });
}, true);
main.addEventListener('submit', event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const data = new FormData(form);
  const draft = formDraft(form);
  act(async () => {
    switch (form.dataset.form) {
      case 'choice': return advance({ type: 'choice', index: data.has('index') ? Number(data.get('index')) : -1 });
      case 'pick':
        if (!draft.selectedKeys.length) throw new Error('先点出拿不准的词，或直接跳过。');
        return advance({ type: 'draft', draft: { ...state.active.draft, ...draft, writing: true } });
      case 'diagnose': return advance({ type: 'diagnose', answers: draft.answers });
      case 'poetry': return advance({ type: 'poetry', text: data.get('text') });
      case 'recall': return advance({ type: 'recall', answer: data.get('answer') });
      case 'correct': return advance({ type: 'correct', key: form.dataset.key, answer: data.get('answer') });
    }
  });
});

main.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !main.contains(button)) return;
  const { poem, reviewKey, reviewSection, action } = button.dataset;
  if (poem) return act(() => start('poetry', { title: poem }));
  if (reviewKey) return act(() => {
    if (state.active?.kind === 'review' && state.active.question.key === reviewKey && state.active.phase === 'answer') return continueHere();
    return start(reviewSection, { reviewKey });
  });
  if (button.dataset.switch) return act(() => start(button.dataset.switch, {
    title: button.dataset.title, reviewKey: button.dataset.key, confirmedRevision: Number(button.dataset.revision),
  }));
  if (!action) return;
  act(async () => {
    switch (action) {
      case 'retry': return route();
      case 'skip': return advance({ type: 'diagnose', answers: {} });
      case 'repick': return advance({ type: 'draft', draft: { ...state.active.draft, writing: false } });
      case 'done':
        await update(current => step(current, { type: 'finish' }));
        location.hash = 'desk';
        break;
      case 'next': {
        const { section, question } = state.active;
        return start(section, { title: question.title, previous: question.prompt });
      }
    }
  });
});

window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !state) return;
  if (['desk', 'records'].includes(page()) || (page() === 'continue' && state.active?.phase === 'feedback')) route();
});
window.addEventListener('storage', event => {
  if ([paperReviewPrefix, keyboardAttemptPrefix, studyAttemptPrefix].some(prefix => event.key?.startsWith(prefix))) {
    if (page() === 'records') route();
    return;
  }
  if (event.key && event.key !== 'xiye.chinese.practice.v1') return;
  writes.then(() => {
    try { state = loadState(); route(); }
    catch (error) { notify(error.message); }
  });
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
try { state = loadState(); await recoverDraft(); await route(); }
catch (error) { notify(error.message); }
