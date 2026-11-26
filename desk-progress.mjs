import { dueMistakes, getScreening } from './chinese-state.mjs?v=ink-4';
import { getKeyboardAttempt, keyboardDraftPrefix } from './keyboard-history.mjs?v=ink-4';
import { studyDraftPrefix } from './poem-study-state.mjs?v=ink-4';

export function getDeskProgress(state) {
  const progress = {};
  for (const section of ['sound', 'spelling']) {
    const due = dueMistakes(state, section).length;
    const screened = Object.keys(getScreening(state, section).picks).length;
    if (due) progress[section] = `今日可复考 ${due} 字`;
    else if (screened) progress[section] = `已筛 ${screened} 字`;
  }
  const poems = state.history.filter(row => row.kind === 'poetry' && row.submittedAt).length;
  if (poems) progress.poetry = `情境默写已交 ${poems} 题`;
  return progress;
}

export function getVolumeResume(state, section) {
  if (section === 'poetry') return getPoetryResume(state);
  const active = state.active;
  if (active?.section !== section || active.phase === 'feedback') return null;
  const draft = active.draft;
  if (active.phase === 'diagnose') return { href:'#continue', label:'继续本题的错词辨析' };
  if (draft?.index == null && !draft?.answer?.trim()) return null;
  return { href:'#continue', label:active.kind === 'review' ? '继续本次复考' : '继续未提交的选项' };
}

// A reading visit or a submitted answer is not an unfinished exercise.
export function getPoetryResume(state, drafts = sessionStorage, records = localStorage) {
  const active = state.active;
  let recent = active?.section === 'poetry' && active.phase === 'answer' ? {
    href: '#continue', label: `《${active.question.title}》情境默写`, time: Date.parse(active.startedAt) || 0,
  } : null;
  for (let i = 0; i < drafts.length; i++) {
    const key = drafts.key(i);
    const keyboard = key?.startsWith(keyboardDraftPrefix);
    if (!keyboard && !key?.startsWith(studyDraftPrefix)) continue;
    try {
      const scope = new URLSearchParams(key.slice((keyboard ? keyboardDraftPrefix : studyDraftPrefix).length));
      const poem = scope.get('poem');
      const rawPart = scope.get('part');
      if (!poem || !/^\d+$/.test(rawPart)) continue;
      const part = Number(rawPart);
      const draft = JSON.parse(drafts.getItem(key));
      if (!draft?.reference || !Number.isSafeInteger(part)) continue;
      const query = new URLSearchParams({ poem, part });
      if (keyboard) {
        if (!draft.id || draft.poemId !== poem || draft.part !== part ||
          typeof draft.answer !== 'string' || getKeyboardAttempt(draft.id, records)) continue;
        if (draft.study) query.set('study', '1');
      } else {
        if (!part || !Array.isArray(draft.seen)) continue;
        if (draft.stage !== 'recall' && !(draft.stage === 'practice' && draft.evidence && draft.task && !draft.task.result)) continue;
      }
      const time = Number(draft.updatedAt) || 0;
      if (recent && time <= recent.time) continue;
      const title = draft.poemTitle ? `《${draft.poemTitle}》` : '';
      const range = part ? `第 ${part} 段` : '全篇';
      const action = keyboard ? '键盘默写' : draft.stage === 'recall' ? '试背' : '巩固';
      recent = { href: `./${keyboard ? 'keyboard' : 'poem-study'}.html?${query}`, label: title + range + ' · ' + action, time };
    } catch { /* Other drafts can still be resumed if this one is unreadable. */ }
  }
  return recent && { href: recent.href, label: recent.label };
}
