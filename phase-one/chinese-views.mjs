import { assistedQueue, dueMistakes, getScreening } from './chinese-state.mjs';
import { isClassEdition } from './practice-edition.mjs';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const esc = escapeHtml;
function paperLink(poem, part = 0) {
  const query = new URLSearchParams({ poem });
  if (part) query.set('part', part);
  return './handwriting.html?' + esc(query.toString());
}
function learningModes(title) {
  const query = new URLSearchParams({ poem: title });
  return `<span class="poem-study-modes">
    <a class="paper-study-link" aria-label="${esc(title)}，键盘默写" href="./keyboard.html?${esc(query)}">键盘默写</a>
    <a class="paper-study-link" aria-label="${esc(title)}，纸上默写" href="${paperLink(title)}">纸上默写</a>
  </span>`;
}
const titles = { poetry: '古诗练习', sound: '字音练习', spelling: '字形练习' };
const formats = { group: '成组辨析', passage: '短文辨音', review: '换句复考', poetry: '情境默写' };
const letter = i => 'ABCD'[i] ?? '';
const button = (action, label, style = 'button-secondary') => `<button type="button" class="${style}" data-action="${action}">${label}</button>`;
const submit = (label, disabled = false) => `<button class="button-primary" type="submit"${disabled ? ' disabled' : ''}>${label}</button>`;
const field = (name, value, extra = '') => `<input type="text" name="${esc(name)}" value="${esc(value)}" autocomplete="off" spellcheck="false" required ${extra}>`;
function pageHead(title, note = '') {
  return `<header class="folio-head"><h1>${esc(title)}</h1>${note ? `<span>${esc(note)}</span>` : ''}</header>`;
}

export function renderModeMenu(section, resume = null) {
  const poetry = section === 'poetry';
  const modes = [
    ['直接做题', '#' + section, { poetry: '选一篇，根据情境默写原句', sound: '成组辨音，兼练短文辨音', spelling: '在四组词语中辨别正误' }[section]],
    poetry ? ['学习古诗', './poem-study.html', '选一段读背，再按刚才的表现巩固']
      : ['先摸底', './screening.html?section=' + section, '逐字四选一，找出错选和拿不准的字'],
  ];
  const links = modes.map(([label, href, detail], i) => `<li><a href="${href}" aria-labelledby="mode-${i}" aria-describedby="mode-note-${i}">
    <strong id="mode-${i}">${label}</strong><span id="mode-note-${i}">${detail}</span></a></li>`).join('');
  if (poetry) {
    const bookmark = resume ? `<a class="scroll-bookmark" href="${esc(resume.href)}">续前卷<span>${esc(resume.label)}</span></a>` : '';
    return `<section class="workbook mode-menu poetry-sheet" aria-labelledby="scroll-title">
      <header class="scroll-heading">
        <a class="scroll-close" data-close-scroll href="#desk" aria-label="合卷，返回练习书桌">合卷</a>
        <h1 id="scroll-title" tabindex="-1">${titles[section]}</h1>
        <span class="scroll-volume">卷一</span>
      </header>
      <div class="scroll-options">${bookmark}<ul aria-label="选择练习方式">${links}</ul></div>
    </section>`;
  }
  return `<div class="workbook mode-menu">${pageHead(titles[section])}<ul aria-label="选择练习方式">${links}</ul>
    <a class="back-link" href="#desk">回练习书桌</a></div>`;
}

function markedWord(word, target) {
  if (!target || !word.includes(target)) return esc(word);
  return word.split(target).map(esc).join(`<span class="marked">${esc(target)}</span>`);
}

function passageText(text, words) {
  const spans = [];
  for (const item of words) {
    const start = text.indexOf(item.word);
    if (start >= 0) spans.push({ start, item });
  }
  let end = 0, html = '';
  for (const { start, item } of spans.sort((a,b) => a.start - b.start)) {
    if (start < end) continue;
    html += esc(text.slice(end, start)) + markedWord(item.word, item.target);
    end = start + item.word.length;
  }
  return html + esc(text.slice(end));
}

function source(item) {
  if (!item.locator) return '';
  const url = isClassEdition ? item.sourceUrl :
    item.sourceId && '/api/rag/source?' + new URLSearchParams({ id: item.sourceId });
  if (!url) return esc(item.locator);
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(item.locator)}</a>`;
}

function choiceView(a) {
  const q = a.question, sound = a.section === 'sound';
  const rows = q.rows.map((row, i) => {
    const cells = row.map(item => {
      if (!sound) return `<span>${esc(item.shownWord)}</span>`;
      if (q.kind === 'passage') return `<span>${esc(item.shownPinyin)}</span>`;
      return `<span><span class="term">${markedWord(item.shownWord, item.target)}</span><small class="shown-reading">（${esc(item.shownPinyin)}）</small></span>`;
    }).join('');
    return `<label class="choice-row"><input type="radio" required name="index" value="${i}" ${String(a.draft.index) === String(i) ? 'checked' : ''}><span class="choice-letter">${letter(i)}</span><span class="choice-words">${cells}</span></label>`;
  }).join('');
  return `<form data-form="choice"><fieldset><legend class="question">${esc(q.prompt)}（　）</legend>
    ${q.passage ? `<blockquote class="excerpt">${passageText(q.passage, q.rows[0])}</blockquote>` : ''}
    <div class="choices">${rows}</div></fieldset>
    <div class="actions">${submit('提交选择')}${button('done','结束本题','text-link')}</div></form>`;
}

function diagnosis(a) {
  const sound = a.section === 'sound', draft = a.draft;
  if (draft.writing) {
    const items = a.question.rows.flat();
    const entries = (draft.selectedKeys ?? []).map(key => items.find(w => w.key === key)).filter(Boolean);
    const inputs = entries.map(item => {
      const prompt = sound ? markedWord(item.word, item.target) : `${esc(item.pinyin)}<small class="meaning">${esc(item.hint)}</small>`;
      return `<label class="field write-entry"><span>${prompt}</span>${field(item.key, draft.answers?.[item.key])}</label>`;
    }).join('');
    return `<h2>${sound ? '给加点字注音' : '根据拼音写出完整词语'}</h2>
      ${sound ? '<p class="worksheet-note">拼音可带调，也可用数字或“四声”标调。</p>' : ''}
      <form data-form="diagnose">${inputs}<div class="actions">${submit('提交核对')}${button('repick','重新选词','text-link')}</div></form>`;
  }
  const selected = new Set(draft.selectedKeys || []);
  const groups = a.kind === 'passage' ? [a.question.rows[a.choiceIndex]] : a.question.rows;
  const chips = groups.map((row,i) => `<div class="pick-row">${groups.length > 1 ? `<span class="choice-letter">${letter(i)}</span>` : ''}
    <div class="word-chips">${row.map(item => `<label><input type="checkbox" name="keys" value="${esc(item.key)}" ${selected.has(item.key) ? 'checked' : ''}><span>${sound ? markedWord(item.shownWord,item.target) : esc(item.shownWord)}</span></label>`).join('')}</div></div>`).join('');
  return `<form data-form="pick"><fieldset><legend class="question">点出拿不准的词</legend><p class="worksheet-note">你选的 ${letter(a.choiceIndex)} 组有误，可勾选多个词。</p>${chips}</fieldset>
    <div class="actions">${submit(sound ? '给所选词注音' : '写出所选词', !selected.size)}${button('skip','直接看答案','text-link')}</div></form>`;
}

function poemAnswer(a) {
  const q = a.question;
  return `<h2>${esc(q.title)}</h2><p class="excerpt poem-scene">${esc(q.prompt)}</p>
    <form data-form="poetry"><label class="field"><span>默写原句</span><textarea required name="text" autocomplete="off" spellcheck="false">${esc(a.draft.text)}</textarea></label>
    <div class="actions">${submit('提交默写')}${button('done','结束本题','text-link')}</div></form>
    ${q.sourceId ? learningModes(q.title) : ''}`;
}

function reviewAnswer(a) {
  const item = a.question, sound = a.section === 'sound';
  const context = String(a.context ?? '').split(item.word).map(esc)
    .join(sound ? markedWord(item.word, item.target) : `<span class="blank">______</span>（${esc(item.pinyin)}）`);
  return `<h2>${sound ? '给句中的加点字注音' : '根据拼音填写空缺的词'}</h2><p class="excerpt">${context}</p>
    <form data-form="recall"><label class="field"><span>${sound ? '加点字的读音' : '完整词语'}</span>${field('answer',a.draft.answer)}</label>
    <div class="actions">${submit('提交复考')}${button('done','稍后再考','text-link')}</div></form>`;
}

function checkResult(a, check) {
  const result = a.corrections.filter(c => c.key === check.key).at(-1);
  const correctForm = check.correct || result?.correct ? '' : `<form class="repair-form" data-form="correct" data-key="${esc(check.key)}"><label>当场订正 ${field('answer','')}</label><button class="button-secondary" type="submit">核对订正</button></form>`;
  return `<div class="check-line"><strong>${esc(check.word)}</strong><p>你写的「${esc(check.raw)}」，${check.correct ? '独立作答正确。' : `正确答案是「${esc(check.expected)}」。`}</p>
    ${result ? `<p class="muted">${result.correct ? '当场已订正，保留跨日复考。' : '本次订正仍有误，可再写一次。'}</p>` : ''}${correctForm}</div>`;
}

function feedback(a) {
  const q = a.question;
  let body = '';
  if (a.kind === 'poetry') {
    body = `<h2>${a.correct ? '原句一致' : '用字有差异'}</h2><dl class="poem-comparison"><dt>你的默写</dt><dd>${esc(a.answer)}</dd><dt>对照原句</dt><dd>${esc(Array.isArray(q.expected) ? q.expected.join('，') : q.expected)}</dd></dl><p class="source-line">${source(q)}</p>`;
  } else if (a.kind === 'review') {
    body = `<h2>${a.correct ? '独立复考通过' : '三天后再考一次'}</h2>${a.checks.map(c => checkResult(a,c)).join('')}
      <p class="source-line">${source(q)}</p>`;
  } else {
    const sound = a.section === 'sound';
    const rows = q.rows.map((row,i) => {
      const wrong = row.filter(w => sound ? w.shownPinyin !== w.pinyin : w.shownWord !== w.word);
      const changed = wrong.map(item => sound ? `${markedWord(item.word,item.target)}（${esc(item.shownPinyin)} → ${esc(item.pinyin)}）` : `${esc(item.shownWord)} → ${esc(item.word)}`).join('、');
      return `<div class="answer-line"><span class="answer-letter">${letter(i)}</span><span>${changed || '全组正确'}</span></div>`;
    }).join('');
    const sources = [...new Map(q.rows.flat().map(item => [item.sourceId,item])).values()]
      .map(item => `<li>${esc(item.word)}　${source(item)}</li>`).join('');
    body = `<h2>${a.correct ? `选对了，答案是 ${letter(q.correctIndex)}` : `正确选项是 ${letter(q.correctIndex)}`}</h2>
      ${a.correct ? '' : `<p class="worksheet-note">你选了 ${letter(a.choiceIndex)}。</p>`}
      ${a.checks.length ? `<h3>你的独立作答</h3>${a.checks.map(c => checkResult(a,c)).join('')}` : ''}
      <div class="answer-lines">${rows}</div>
      <details class="source-list"><summary>查看词条出处</summary><ul>${sources}</ul></details>`;
  }
  return `${body}<div class="actions">${a.kind === 'review' ? '' : button('next','下一题','button-primary')}${button('done','结束本次练习',a.kind === 'review' ? 'button-primary' : 'button-secondary')}</div>`;
}

export function renderActive(state) {
  const a = state.active;
  if (!a) return '';
  let body;
  if (a.phase === 'feedback') body = feedback(a);
  else if (a.phase === 'diagnose') body = diagnosis(a);
  else if (a.kind === 'poetry') body = poemAnswer(a);
  else if (a.kind === 'review') body = reviewAnswer(a);
  else body = choiceView(a);
  let note = a.kind === 'poetry' && a.question.referenceOnly ? '样题试练，不计分' : formats[a.kind];
  if (a.section !== 'poetry' && a.phase === 'feedback') note = '作答反馈';
  return `<div class="workbook">${pageHead(titles[a.section], note)}<section class="study-paper">${body}</section></div>`;
}

export function renderPoemCatalog(titlesList) {
  const available = titlesList.filter(item => item.status === 'ready' || item.status === 'sample');
  const pending = titlesList.filter(item => !available.includes(item));
  const readyRows = available.map(item => `<li class="poem-modes"><button class="poem-item" data-poem="${esc(item.title)}"><span>${esc(item.title)}</span><small>${item.status === 'sample' ? '试做情境样题' : '情境默写'}</small></button>
    ${item.hasText ? learningModes(item.title) : ''}</li>`).join('');
  const missingTextOnly = pending.every(item => !item.hasText);
  const pendingRows = pending.map(item => `<li>${esc(item.title)}${item.hasText ? learningModes(item.title) : ''}${missingTextOnly ? '' : `<small>${item.hasText ? '待配题' : '待补课文'}</small>`}</li>`).join('');
  return `<div class="workbook">${pageHead('古诗练习', `共 ${titlesList.length} 篇`)}
    <section class="catalog-sheet"><h2>选择篇目</h2>${readyRows ? `<ul class="poem-list">${readyRows}</ul>` : '<p>补入课文并配好情境题后，就可以开始默写。</p>'}
    ${pending.length ? `<details class="poem-pending"><summary>${missingTextOnly ? '待补课文' : '准备中的篇目'}（${pending.length} 篇）</summary><ul>${pendingRows}</ul></details>` : ''}</section></div>`;
}

function recordDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN',{ year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function renderRecords(state, paperReviews = [], keyboardAttempts = [], studyAttempts = []) {
  const due = new Set(dueMistakes(state).map(m => m.key));
  const maskedSounds = new Set(state.mistakes.filter(m => m.section === 'sound' && m.status === 'pending').map(m => m.word));
  const maskedSpellings = new Set(state.mistakes.filter(m => m.section === 'spelling' && m.status === 'pending').map(m => m.word));
  for (const pick of assistedQueue(state, 'spelling')) maskedSpellings.add(pick.item.word);
  const screeningRows = ['sound', 'spelling'].map(section => {
    const screening = getScreening(state, section);
    const picks = Object.values(screening.picks);
    if (!picks.length) return '';
    const unsure = picks.filter(pick => pick.correct && pick.unsure);
    const wrong = picks.filter(pick => !pick.correct).length;
    const name = section === 'sound' ? '字音筛查' : '字形筛查';
    const waiting = assistedQueue(state, section).length;
    const studied = Object.values(screening.assistance ?? {}).filter(entry => entry.result);
    const uncertainWords = unsure.map(({ item }) => esc(maskedSpellings.has(item.word) ? item.word.replace(item.target, '□') : item.word));
    return `<div class="record-row"><div><strong>${name}</strong><small>已筛 ${picks.length} 个词例 · 选错 ${wrong} · 选对但拿不准 ${unsure.length}</small>
      ${studied.length ? `<small>当场辅助学习 ${studied.length} 题 · 答对 ${studied.filter(entry => entry.result.correct).length} 题</small>` : ''}
      ${unsure.length ? `<details><summary>拿不准的词</summary><p>${uncertainWords.join('、')}</p></details>` : ''}</div>
      <div class="record-links"><a href="./screening.html?section=${section}">打开${name}</a>
        ${waiting ? `<a href="./assisted.html?section=${section}">辅助学习 · ${waiting} 个词</a>` : ''}</div></div>`;
  }).join('');
  const mistakes = state.mistakes.map(m => {
    const ready = due.has(m.key), sound = m.section === 'sound', pending = m.status === 'pending';
    const clue = pending && !sound ? m.pinyin : m.word;
    const hidesOtherAnswer = (clue === m.word && maskedSpellings.has(m.word)) || (clue !== m.word && maskedSounds.has(m.word));
    const word = hidesOtherAnswer ? (sound ? '待核读音' : '待核词形') : esc(clue);
    const status = ready ? '今天可复考' : !pending ? '独立复考通过' : m.lastCorrection?.correct ? '已订正，待复考' : '待复考';
    const dueDate = pending ? ` · <time data-due-for="${esc(m.key)}" datetime="${esc(m.dueDate)}">${esc(m.dueDate)}</time>` : '';
    const expose = pending ? ` data-expose-key="${esc(m.key)}" data-expose-section="${esc(m.section)}"` : '';
    const fromScreen = m.firstWrongKind === 'screening';
    const origin = fromScreen ? ' · 筛查错选' : m.firstWrongKind === 'assisted-write' ? ' · 换句试写有误' : '';
    const firstExpected = sound ? m.pinyin : fromScreen ? m.target : m.word;
    const more = ready ? `<button type="button" class="button-primary" data-review-key="${esc(m.key)}" data-review-section="${esc(m.section)}">开始复考</button>`
      : `<details${expose}><summary>${pending ? '看答案，三天后再考' : '查看作答'}</summary><p>${fromScreen ? '最初选了' : '最初填写'}「${esc(m.firstWrong)}」，正确答案「${esc(firstExpected)}」。</p>
          ${m.lastCorrection ? `<p>最近当场订正　${esc(m.lastCorrection.raw)}（${m.lastCorrection.correct ? '正确' : '有误'}）</p>` : ''}
          ${(m.reviews ?? []).map(r => `<p>${esc(recordDate(r.at))} 独立复考　${esc(r.raw)}（${r.correct ? '正确' : '有误'}）</p>`).join('')}</details>`;
    return `<div class="record-row"><div><strong>${word}</strong><small>${sound ? '字音' : '字形'}${origin} · ${status}${dueDate}</small></div>${more}</div>`;
  }).join('');
  const history = state.history.map(a => {
    const result = a.kind === 'review' ? (a.correct ? '独立复考通过' : '独立复考有误') : a.kind === 'poetry' ? (a.correct ? '原句一致' : '用字有差异') : `首答 ${letter(a.choiceIndex)} · ${a.correct ? '选择正确' : '选择有误'}`;
    return `<div class="record-row"><div><strong>${esc(titles[a.section])}</strong><small>${esc(a.kind === 'poetry' ? a.question.title : formats[a.kind])} · ${esc(recordDate(a.submittedAt))}</small></div><span>${result}</span></div>`;
  }).join('');
  const paperRows = paperReviews.map(row => {
    const errors = row.confirmedMistakes.map(({actual, expected}) => {
      if (!actual) return '漏写「' + esc(expected) + '」';
      if (!expected) return '多写「' + esc(actual) + '」';
      return '纸上「' + esc(actual) + '」，原句「' + esc(expected) + '」';
    });
    const status = row.pendingCount ? `待核 ${row.pendingCount} 处` : row.reviewedLines ? '已核对' : '已排除本次所有行';
    return `<div class="record-row"><div><strong>${esc(row.poemTitle)}</strong><small>${esc(recordDate(row.updatedAt))} · ${row.reviewedLines} 行 · ${status}</small></div>
      ${errors.length ? `<details><summary>已确认错漏 ${errors.length} 处</summary><ul>${errors.map(e=>`<li>${e}</li>`).join('')}</ul></details>` : '<span>已确认错漏 0 处</span>'}
      ${row.pendingCount ? `<a href="${paperLink(row.poemId,row.part)}">重选原照片继续核对</a>` : ''}</div>`;
  }).join('');
  const keyboardRows = keyboardAttempts.map(attempt => {
    const label = attempt.part ? `第 ${attempt.part} 段` : '全篇';
    const result = attempt.correct ? '用字全部正确' : [`写错 ${attempt.wrong} 字`, `漏写 ${attempt.missing} 字`, `多写 ${attempt.extra} 字`].join(' · ');
    const link = './keyboard.html?' + esc(new URLSearchParams({ attempt: attempt.id }));
    return `<div class="record-row"><div><strong>${esc(attempt.poemTitle)}</strong><small>${esc(recordDate(attempt.submittedAt))} · ${esc(label)}</small></div><span>${esc(result)}</span><a href="${link}">回看默写</a></div>`;
  }).join('');
  const studyRows = studyAttempts.map(a => {
    const method = a.kind === 'scene' ? '情境默写' : '原句巩固';
    let outcome = a.correct ? '当场答对' : '当场未答对';
    if (!a.answer.trim()) outcome = '未写出 · 已看原句';
    else if (a.isRewrite) outcome = a.correct ? '看过原句后写对' : '看过原句后仍需练习';
    else if (a.usedHint) outcome = a.correct ? '提示后答对' : '提示后仍需练习';
    const source = { oral: '自己试背', keyboard: '键盘默写', paper: '纸面核对' }[a.source];
    return `<div class="record-row"><div><strong>${esc(a.poemTitle)} · 第 ${esc(a.part)} 段</strong>
      <small>${esc(recordDate(a.createdAt))} · ${method} · ${outcome}</small></div>
      <details><summary>回看作答</summary><p>本次试背 · ${source}</p><p>${esc(a.prompt)}</p><p>我的答案　${esc(a.answer) || '未写出'}</p>
      <p>参考原句　${esc(a.expected)}</p></details></div>`;
  }).join('');
  if (!mistakes && !history && !paperRows && !keyboardRows && !screeningRows && !studyRows) {
    return `<div class="workbook">${pageHead('学习记录')}<section class="record-book"><h2>还没有练习记录</h2><a class="button-primary" href="#desk">去做第一题</a></section></div>`;
  }
  return `<div class="workbook">${pageHead('学习记录')}<section class="record-book"><h2>错词复考</h2>${mistakes || '<p class="worksheet-note">暂时没有待考的词。</p>'}</section>
    ${screeningRows ? `<section class="record-book"><h2>逐字筛查</h2>${screeningRows}</section>` : ''}
    ${keyboardRows ? `<section class="record-book"><h2>键盘默写</h2>${keyboardRows}</section>` : ''}
    ${paperRows ? `<section class="record-book"><h2>纸上默写</h2>${paperRows}</section>` : ''}
    ${studyRows ? `<section class="record-book"><h2>古诗段后巩固</h2>${studyRows}</section>` : ''}
    <section class="record-book"><h2>作答记录</h2>${history || '<p class="worksheet-note">还没有正式作答记录。</p>'}</section></div>`;
}
