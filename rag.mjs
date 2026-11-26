import { classFetch as fetch } from './class-api.mjs';
import { isClassEdition } from './practice-edition.mjs';

const el = id => document.getElementById(id);
const form = el('search-form');
const labels = { title: '篇目表', candidate: '编题候选', review: '写法或语境待核', unclear: '原图括注待辨', reference: '识别稿', text: '已核课文' };
let model;
let selection;
let revision = 0;

function clearResults({ keepHits = false } = {}) {
  revision++;
  selection = null;
  if (!keepHits) {
    el('results').hidden = true;
    el('hit-count').textContent = '';
  }
  el('draft-panel').hidden = true;
  el('model-panel').hidden = true;
  el('context-panel').open = false;
  el('context-panel').hidden = true;
  el('ask').disabled = false;
  el('message').textContent = '';
  el('copy-note').textContent = '';
  el('draft-note').textContent = '';
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请稍后再试。');
  return data;
}

function renderHit(hit) {
  const box = document.createElement('article');
  box.className = 'source-hit';
  const title = document.createElement('h3');
  title.textContent = hit.title;
  const excerpt = document.createElement('p');
  excerpt.textContent = hit.text;
  const source = document.createElement('small');
  source.textContent = [labels[hit.status], hit.locator].filter(Boolean).join(' · ');
  box.append(title);
  if (hit.status === 'reference' && hit.text.length > 160) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '展开原页识别文字';
    details.append(summary, excerpt);
    box.append(details);
  } else box.append(excerpt);
  box.append(source);
  const sourceUrl = hit.sourceUrl || (!isClassEdition && hit.imageUrl);
  if (sourceUrl) {
    const link = document.createElement('a');
    link.className = 'text-link';
    link.textContent = hit.sourceUrl ? '查看原文网页' : '查看原图';
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    box.append(link);
  }
  return box;
}

function showModel() {
  const active = Boolean(model && selection?.get('mode') === 'exercise' && !el('results').hidden);
  el('model-panel').hidden = !active;
  if (active) el('model-note').textContent = '拟题时将「' + selection.get('q') + '」和摘录发给 ' + model.name + '（' + model.host + '）。';
}

if (isClassEdition) form.elements.section.querySelector('option[value="reference"]').remove();
else request('/api/rag/info').then(info => { model = info.model; showModel(); }).catch(() => {});
const query = el('query');
query.addEventListener('input', () => {
  el('quick-search').hidden = Boolean(query.value.trim());
  clearResults({ keepHits: Boolean(query.value.trim()) });
});
form.addEventListener('change', event => {
  if (event.target.tagName === 'SELECT' && query.value.trim()) form.requestSubmit();
});
el('quick-search').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  query.value = button.textContent;
  query.focus();
  form.requestSubmit();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  clearResults();
  const current = revision;
  const params = new URLSearchParams(new FormData(form));
  if (params.get('mode') === 'exercise') params.set('limit', '20');
  const term = params.get('q').trim();
  if (!term) {
    el('message').textContent = '请输入词语或篇名。';
    query.focus();
    return;
  }
  el('quick-search').hidden = true;
  el('message').textContent = '正在检索…';
  try {
    const data = await request('/api/rag/search?' + params);
    if (current !== revision) return;
    el('message').textContent = data.hits.length ? '' : data.answer;
    el('result-title').textContent = '「' + term + '」的资料';
    el('hit-count').textContent = data.hits.length ? data.hits.length + ' 条结果' : '';
    el('results').hidden = !data.hits.length;
    el('hits').replaceChildren(...data.hits.map(renderHit));
    el('context').value = data.context;
    el('context-panel').hidden = !data.context;
    params.set('evidenceVersion', data.evidenceVersion);
    selection = params;
    showModel();
  } catch (error) {
    if (current === revision) el('message').textContent = error.message;
  }
});

el('copy').addEventListener('click', async () => {
  if (!selection) return;
  const current = revision;
  try {
    await navigator.clipboard.writeText(el('context').value);
    if (current !== revision) return;
    el('copy-note').textContent = '已复制摘录和出处。';
  } catch {
    if (current !== revision) return;
    el('context').select();
    el('copy-note').textContent = '摘录已选中，可按复制快捷键。';
  }
});

el('ask').addEventListener('click', async () => {
  if (!model || !selection) return;
  const current = revision;
  el('ask').disabled = true;
  el('draft-panel').hidden = true;
  el('draft-note').textContent = '正在拟题…';
  try {
    const data = await request('/api/rag/ask?' + selection, { method: 'POST' });
    if (current !== revision) return;
    if (!data.draft) {
      clearResults();
      el('message').textContent = data.answer || '资料已更新，请重新检索。';
      return;
    }
    el('draft').textContent = data.draft;
    el('draft-panel').hidden = false;
    el('context').value = data.context;
    el('hits').replaceChildren(...data.hits.map(renderHit));
    el('draft-note').textContent = '草稿已生成。';
  } catch (error) {
    if (current === revision) el('draft-note').textContent = error.message;
  } finally {
    if (current === revision) el('ask').disabled = false;
  }
});

for (const control of document.querySelectorAll('#search-form :disabled, #quick-search button:disabled')) {
  control.disabled = false;
}
