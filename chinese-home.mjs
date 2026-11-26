import { renderDeskWindow } from './desk-window.mjs?v=ink-4';
import { escapeHtml } from './chinese-views.mjs?v=ink-4';

const subjects = [
  { key: 'poetry', scene: 'poetry', volume: '壹', title: '古诗练习', task: '分段学诗 · 情境默写' },
  { key: 'sound', scene: 'pronunciation', volume: '贰', title: '字音练习', task: '辨读音 · 给字注音' },
  { key: 'spelling', scene: 'character', volume: '叁', title: '字形练习', task: '辨字形 · 依句填词' },
];

function subjectEntry({ key, scene, volume, title, task }, progress) {
  const shortcut = key === 'poetry' ? '' :
    `<a class="screening-link" href="./screening.html?section=${key}">${key === 'sound' ? '字音筛查' : '字形筛查'}</a>`;
  return `<div class="subject-row">
    <a class="subject-entry subject-${key}" data-scene-id="${scene}" href="#${key}-modes">
      <span class="volume-number" aria-hidden="true">${volume}</span>
      <div class="subject-copy"><h2>${title}</h2><p>${escapeHtml(progress || task)}</p></div>
      <span class="volume-open" aria-hidden="true"><span>启</span></span>
    </a>
    ${shortcut}
  </div>`;
}

export function renderHome(state, { pendingCount = 0, dueCount = 0, progressBySection = {} } = {}) {
  const active = state.active;
  const current = subjects.find(s => s.key === active?.section);
  const continueLink = current ? `<a class="desk-resume" href="#continue">${active.phase === 'feedback' ? '回看上题反馈' : '继续上次练习'}<span>${current.title}</span></a>` : '';
  const review = dueCount ? `今天可复考 ${dueCount} 个词` : `有 ${pendingCount} 个词等待复考`;
  return `<section class="desk-spread" aria-labelledby="desk-title">
    <header class="desk-index">
      <div class="desk-signature"><span aria-hidden="true">习</span>案头日课</div>
      <h1 id="desk-title" aria-label="语文练习书桌"><span>语文</span><span>练习书桌</span></h1>
      ${continueLink}
    </header>
    ${renderDeskWindow()}
    <div class="desk-contents">
      <nav class="subject-list" aria-label="练习卷目">${subjects.map(s => subjectEntry(s, progressBySection[s.key])).join('')}</nav>
      ${pendingCount || dueCount ? `<a class="desk-due" href="#records">${review}<span>查看记录</span></a>` : ''}
    </div>
  </section>`;
}
