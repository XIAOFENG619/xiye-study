import { renderDeskWindow } from './desk-window.mjs';

const subjects = [
  { key: 'poetry', scene: 'poetry', title: '古诗练习', task: '选篇，情境默写' },
  { key: 'sound', scene: 'pronunciation', title: '字音练习', task: '辨读音，给考字注音' },
  { key: 'spelling', scene: 'character', title: '字形练习', task: '辨字形，写出完整词语' },
];

function subjectEntry({ key, scene, title, task }) {
  const practice = `<a class="subject-entry subject-${key}" data-scene-id="${scene}" href="#${key}">
    <div><h2>${title}</h2><p>${task}</p></div><span class="entry-arrow" aria-hidden="true"></span>
  </a>`;
  if (key === 'poetry') return practice;
  return `<div class="subject-row">${practice}
    <a class="screening-link" href="./screening.html?section=${key}">${key === 'sound' ? '字音筛查' : '字形筛查'}</a>
  </div>`;
}

export function renderHome(state, { pendingCount = 0, dueCount = 0 } = {}) {
  const active = state.active;
  const current = subjects.find(s => s.key === active?.section);
  const continueLink = current ? `<a class="desk-resume" href="#continue">${active.phase === 'feedback' ? '回看上题反馈' : '继续上次练习'}<span>${current.title}</span></a>` : '';
  const review = dueCount ? `今天可复考 ${dueCount} 个词` : `有 ${pendingCount} 个词等待复考`;
  return `<section class="desk-spread" aria-labelledby="desk-title">
    <div class="desk-index">
      <h1 id="desk-title">语文练习书桌</h1>
      ${continueLink}
      <div class="subject-list">${subjects.map(subjectEntry).join('')}</div>
      ${pendingCount || dueCount ? `<a class="desk-due" href="#records">${review}<span>查看记录</span></a>` : ''}
    </div>
    ${renderDeskWindow()}
  </section>`;
}
