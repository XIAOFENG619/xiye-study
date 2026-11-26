import { classFetch as fetch } from './class-api.mjs';
import { diffPaperLine, paperClauses } from './handwriting-review.mjs';
import { buildPaperRows, syncMissingRows, paperDecisions, isActive, isGap, isPending, pendingCount } from './handwriting-rows.mjs';
import { getPaperReview, savePaperReview } from './handwriting-history.mjs';
import { splitPoemParts } from './poem-parts.mjs';
import { isClassEdition } from './practice-edition.mjs';

const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const plain = value => String(value ?? '').normalize('NFKC').replace(/[\s\p{P}]/gu, '');
const params = new URLSearchParams(location.search);
let poems = [], poem, parts = [];
let review, photoUrl, lastFile, serial = 0;
let fetching = false;
const notice = text => { $('notice').textContent = text; };
const selectedText = () => parts[Number($('part').value) - 1] || poem.text;
const fileHint = isClassEdition ? '支持 JPG 或 PNG。首次识别会下载模型，照片在本设备处理。' : $('file-hint').textContent;
$('file-hint').textContent = fileHint;
$('camera').hidden = !navigator.maxTouchPoints;

async function loadPoems() {
  $('reload').hidden = true;
  try {
    const res = await fetch('/api/chinese/poems');
    if (!res.ok) throw Error();
    const data = await res.json();
    poems = data.poems;
    if (!poems?.length) throw Error();
    $('poem').replaceChildren(...poems.map(p => {
      const multiple = poems.some(other => other.id !== p.id && other.title === p.title);
      return new Option(multiple ? `${p.title} · ${p.locator}` : p.title, p.id);
    }));
    const initial = poems.find(p => p.id === params.get('poem')) || poems.find(p => p.title === '将进酒') || poems[0];
    $('poem').value = initial.id;
    selectPoem(params.get('part'));
    busy(false);
    $('reading').hidden = false;
    notice('');
  } catch {
    notice('篇目载入失败，可以重新载入。');
    $('reload').hidden = false;
  }
}
function selectPoem(part = 0) {
  poem = poems.find(p => p.id === $('poem').value);
  parts = splitPoemParts(poem.text);
  $('part').replaceChildren(new Option('全篇选句','0'));
  parts.forEach((_,i) => $('part').add(new Option(`第 ${i + 1} 段`, String(i + 1))));
  if (Number(part) >= 1 && Number(part) <= $('part').options.length - 1) $('part').value = String(Number(part));
  applyPart();
}
function applyPart() {
  $('keyboard-link').href = './keyboard.html?' + new URLSearchParams({ poem: poem.id, part: $('part').value });
  $('keyboard-link').hidden = false;
  $('reading').open = false;
  $('reading-text').textContent = selectedText();
  $('available-references').replaceChildren(...paperClauses(selectedText()).map(text => new Option(text)));
  const url = new URL(location.href);
  url.searchParams.set('poem',poem.id);
  if (+$('part').value) url.searchParams.set('part',$('part').value);
  else url.searchParams.delete('part');
  history.replaceState(null,'',url);
}
function busy(value) {
  fetching = value;
  $('poem').disabled = $('part').disabled = !!review || value;
  $('pick').disabled = $('camera').disabled = value || !poem;
  $('retry').disabled = value;
  $('new').disabled = value;
  $('review').inert = value;
}
function clearReview() {
  ++serial;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = undefined;
  review = undefined;
  lastFile = undefined;
  $('original-image').removeAttribute('src');
  $('lines').replaceChildren();
  $('review').hidden = $('new').hidden = $('retry').hidden = $('history-link').hidden = true;
  $('pick').textContent = '选择默写照片';
  $('file-hint').textContent = fileHint;
  $('file').value = '';
  notice('');
  busy(false);
}
async function identify(file) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  const hex = Array.from(digest, octet => octet.toString(16).padStart(2,'0')).join('');
  return `${poem.id}/${$('part').value}/${hex}`;
}
async function inspect(file) {
  if (!file || fetching) return;
  const request = ++serial;
  const type = file.type || (/\.png$/i.test(file.name) ? 'image/png' : /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : '');
  if (!['image/jpeg','image/png'].includes(type)) return notice('请选择 JPG 或 PNG 照片。');
  if (file.size > 15 * 1024 * 1024) return notice('照片超过 15 MB，请缩小后再选。');
  lastFile = file;
  $('retry').hidden = true;
  $('reading').open = false;
  busy(true);
  notice(isClassEdition ? '正在读取照片…' : '正在本机识别手写行…');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const id = await identify(file);
    const options = { method:'POST', headers:{'Content-Type':type}, body:file };
    if (isClassEdition) {
      notice('正在准备识别模型，首次载入可能需要一些时间…');
      options.onProgress = message => { if (request === serial && fetching) notice(message); };
    }
    const response = await fetch('/api/chinese/handwriting', options);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '照片识别失败。');
    if (request !== serial) return;
    let stored, storageUnavailable = false;
    try { stored = getPaperReview(id); }
    catch { storageUnavailable = true; }
    const rows = buildPaperRows(data.lines, selectedText(), Number($('part').value) > 0, stored?.decisions);
    const result = { id, revision:stored?.revision ?? 0, image, rows };
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = url;
    review = result;
    $('original-image').src = url;
    $('original').open = $('add-line').open = false;
    $('review').hidden = $('new').hidden = false;
    $('history-link').hidden = !stored;
    $('pick').textContent = '更换照片';
    $('file-hint').textContent = file.name;
    $('manual-form').reset();
    render();
    notice(storageUnavailable ? '暂时无法读取本机记录，本次照片可以继续核对。' : stored ? '已恢复这张照片的核对记录。' : '');
    $('review-title').focus();
  } catch (error) {
    if (request === serial) {
      notice(error.message || '照片读取失败，请重试。');
      $('retry').hidden = false;
    }
  } finally {
    if (photoUrl !== url) URL.revokeObjectURL(url);
    if (request === serial) busy(false);
  }
}
function highlighted(text,indices) {
  const wanted = new Set(indices);
  let pos=0;
  return Array.from(text ?? '', char => {
    const n = Array.from(plain(char)).length;
    const marked = Array.from({length:n},(_,i) => pos+i).some(i => wanted.has(i));
    pos+=n;
    return marked ? `<mark>${esc(char)}</mark>` : esc(char);
  }).join('');
}
function issueCrop(row) {
  const chars=Array.from(row.text);
  if (!Array.isArray(row.charBoxes) || row.charBoxes.length !== chars.length || !row.issues.length) return null;
  const rawIndices = chars.flatMap((c,i) => Array.from(plain(c),() => i));
  const boxes=[];
  for (const issue of row.issues) {
    const pos=issue.actualIndex;
    const start=Math.max(0,pos-1);
    const end=Math.min(rawIndices.length-1,pos+1);
    for (let i=start; i<=end; i++) {
      const b=row.charBoxes[rawIndices[i]];
      if (!b || b.length!==4 || !(b[2]>0 && b[3]>0)) return null;
      boxes.push(b);
    }
  }
  if (!boxes.length) return null;
  const left=Math.min(...boxes.map(b=>b[0])), top=Math.min(...boxes.map(b=>b[1]));
  return [left,top,Math.max(...boxes.map(b=>b[0]+b[2]))-left,Math.max(...boxes.map(b=>b[1]+b[3]))-top];
}
function canvasHtml(row,local) {
  return `<canvas class="hand-crop" data-line="${row.lineIndex}" data-local="${local}" aria-label="${local ? '疑点附近笔迹' : '整行笔迹'}"></canvas>`;
}
function paint(canvas) {
  if (!review || canvas.dataset.painted || !canvas.getClientRects().length) return;
  const row=review.rows.find(r=>r.lineIndex===+canvas.dataset.line);
  const box=canvas.dataset.local==='true' ? issueCrop(row) || row.box : row.box;
  if (!box) return;
  const image=review.image, w=image.naturalWidth, h=image.naturalHeight;
  const [x,y,bw,bh]=box;
  const padding=Math.max(2,bh*h*.13);
  const left=Math.max(0,x*w-padding),top=Math.max(0,y*h-padding);
  const cw=Math.max(1,Math.min(w,(x+bw)*w+padding)-left);
  const ch=Math.max(1,Math.min(h,(y+bh)*h+padding)-top);
  const scale=Math.min(2,850/cw,240/ch);
  canvas.width=Math.max(1,Math.round(cw*scale));
  canvas.height=Math.max(1,Math.round(ch*scale));
  canvas.getContext('2d').drawImage(image,left,top,cw,ch,0,0,canvas.width,canvas.height);
  canvas.dataset.painted='true';
}
const btn = (action,label,cls='text-link') => `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
function gapCard(row) {
  const labels = {open:'照片中未找到完整的这句', later:'留待核对', ignored:'已排除本句', checked:'已确认纸面'};
  const actions = isPending(row) ? [
    btn('correct','纸上已写全','button-secondary'), btn('edit','填写实际文字'),
    btn('missing','确认整句漏写'), btn('later','暂不确定'), btn('ignore','排除本句'),
  ] : [btn('reopen','重新核对')];
  const actual = row.state === 'checked' ? `<dt>纸上原字</dt><dd>${esc(row.actual) || '整句漏写'}</dd>` : '';
  return `<article class="review-line" data-index="${row.lineIndex}" data-clause="${row.clauseIndex}">
    <header><h3>所选段落第 ${row.clauseIndex+1} 句</h3><span class="line-state">${labels[row.state]}</span></header>
    <div class="line-evidence"><div>${btn('photo','对照整张原图')}</div><dl class="comparison"><dt>原句</dt><dd>${esc(row.reference)}</dd>${actual}</dl></div>
    <div class="line-actions">${actions.join('')}</div><div class="editor-slot"></div></article>`;
}
function lineCard(row,number) {
  if (isGap(row)) return gapCard(row);
  const local=!!issueCrop(row);
  const stateLabels={other:'未配到原句',ignored:'已排除',checked:'已确认',agreed:'识别一致',later:'留待核对',open:row.ambiguous?'请确认原句':'待核对'};
  if (row.faint && !row.ambiguous) stateLabels.open = '请核对笔迹';
  const confirmed = row.state === 'checked' ? diffPaperLine(row.actual,row.reference) : [];
  if (confirmed.length) stateLabels.checked = `已确认 ${confirmed.length} 处错漏`;
  const evidence = row.box ? `<figure><figcaption>${local?'疑点附近笔迹':'本行笔迹'}</figcaption>${canvasHtml(row,local)}
    ${local ? `<details><summary>看整行</summary>${canvasHtml(row,false)}</details>` : ''}</figure>` : '<p class="line-state">手动补录，可查看整张原图。</p>';
  const readings = `<dl class="comparison">${row.lineIndex>=0 ? `<dt>识别</dt><dd>${highlighted(row.text,row.issues.map(i=>i.actualIndex))}</dd>` : ''}
    ${row.alternate!=null && row.alternate!==row.text ? `<dt>另一个读法</dt><dd>${esc(row.alternate)}</dd>` : ''}
    ${row.reference ? `<dt>原句</dt><dd>${highlighted(row.reference,row.issues.map(i=>i.referenceIndex))}</dd>` : ''}
    ${row.state==='checked' || row.lineIndex<0 ? `<dt>纸上原字</dt><dd>${highlighted(row.actual,confirmed.map(i=>i.actualIndex))||'整行漏写'}</dd>` : ''}</dl>`;
  let quick = '';
  if (isPending(row) && row.reference && !row.ambiguous) {
    quick = btn('correct','纸上与原句相同','button-secondary');
    const actual = plain(row.text) === plain(row.reference) ? row.alternate : row.text;
    if (actual != null && plain(actual) !== plain(row.reference)) {
      const changes = diffPaperLine(actual,row.reference);
      const change = changes.length === 1 ? changes[0] : null;
      let label = '确认纸上与' + (actual === row.text ? '识别' : '另一个读法') + '相同';
      if (change) label = change.actual ? '确认纸上写的是「' + esc(change.actual) + '」' : '确认纸上漏了「' + esc(change.expected) + '」';
      quick += btn(actual === row.text ? 'accept-primary' : 'accept-alternate', label);
    }
  }
  const editLabel=row.ambiguous?'选择对应原句':isActive(row)?'按纸面核对':'纳入核对';
  return `<article class="review-line" data-index="${row.lineIndex}"><header><h3>${row.lineIndex<0?'补录行':number?'默写第 '+number+' 行':'其他笔迹'}</h3><span class="line-state">${stateLabels[row.state]}</span></header>
    <div class="line-evidence">${evidence}${readings}</div>
    <div class="line-actions">${quick}
      ${btn('edit',editLabel)}${row.state==='open'?btn('later','暂不确定'):''}
    </div><div class="editor-slot"></div>
    </article>`;
}
function render() {
  const expanded = new Set(Array.from($('lines').querySelectorAll('details[data-group][open]'), d=>d.dataset.group));
  const rows = review.rows;
  const active=rows.filter(isActive), pending=active.filter(isPending);
  const tally=pending.reduce((sum,r)=>sum+pendingCount(r),0);
  const physical = active.filter(row => !isGap(row));
  const numbers = new Map(physical.map((r,i)=>[r.lineIndex,i+1]));
  const card=r=>lineCard(r,numbers.get(r.lineIndex));
  function group(key,items,label) {
    return items.length ? `<details data-group="${key}" ${expanded.has(key)?'open':''}><summary>${label}（${items.length} 行）</summary>${items.map(card).join('')}</details>` : '';
  }
  const open=pending.filter(r=>r.state==='open');
  let message = '';
  if (!rows.length) message = '没有识别到文字，可以看原图手动补一行。';
  else if (!active.length) message = review.revision && rows.some(r=>r.state==='ignored')
    ? '已排除全部默写内容，可以保存本次变更。' : '请从其他笔迹中选入默写行，或手动补一行。';
  else if (!pending.length) message = active.every(r=>r.state==='agreed') ? '识别结果与对应原句一致。' : '疑点已核对，可以保存结果。';
  $('tally').textContent=`${physical.length} 行默写 · ${tally} 处待核`;
  $('lines').innerHTML = (message?`<p class="no-issues">${message}</p>`:'')+open.map(card).join('')+
    group('later',pending.filter(r=>r.state==='later'),'留待核对')+
    group('agreed',active.filter(r=>!isPending(r)),'已对上原句或已确认')+
    group('other',rows.filter(r=>!isActive(r) && !isGap(r)),'其他识别行')+
    group('excluded',rows.filter(r=>!isActive(r) && isGap(r)),'排除的原句');
  $('save').disabled=!active.length && !(review.revision && rows.some(r=>r.state==='ignored'));
  $('save').textContent=tally?'保存并保留待核':'保存核对结果';
  $('lines').querySelectorAll('canvas').forEach(paint);
}
function editor(row,article) {
  const slot=article.querySelector('.editor-slot');
  if (slot.firstElementChild) { slot.replaceChildren(); return; }
  const form=document.createElement('form');
  form.className='paper-editor';
  form.innerHTML=`<label>对应原句<input required name="reference" list="available-references" value="${esc(row.reference)}" ${isGap(row)?'readonly':''}></label>
    <label>纸上实际写的字<input name="actual" value="${esc(row.actual ?? row.text)}" placeholder="整行漏写时留空"></label>
    <div class="edit-buttons"><button class="button-secondary">确认纸面文字</button>
    ${btn('ignore','移出本次默写')}${btn('cancel','收起')}</div>`;
  slot.replaceChildren(form);
  form.elements[row.ambiguous || !row.reference ? 'reference':'actual'].focus();
}
function validReference(input) {
  const allowed=plain(selectedText());
  const value=plain(input.value);
  input.setCustomValidity(value && allowed.includes(value) ? '' : '请从当前范围选择或填写对应原句。');
  return input.reportValidity();
}
function change(row,state) {
  row.state=state;
  row.edited=true;
  review.rows = syncMissingRows(review.rows, selectedText(), Number($('part').value) > 0);
  $('history-link').hidden=true;
  render();
  notice('核对结果已更新，保存后可在学习记录查看。');
}
$('lines').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if (!button) return;
  const article=button.closest('.review-line');
  const row=review.rows.find(r=>r.lineIndex===+article.dataset.index);
  switch (button.dataset.action) {
    case 'edit': editor(row,article); break;
    case 'cancel': article.querySelector('.editor-slot').replaceChildren(); break;
    case 'correct': row.actual=row.reference; change(row,'checked'); break;
    case 'missing': row.actual=''; change(row,'checked'); break;
    case 'reopen': row.actual=''; change(row,'open'); break;
    case 'photo': $('original').open=true; $('original').querySelector('summary').focus(); break;
    case 'accept-primary': row.actual=row.text; change(row,'checked'); break;
    case 'accept-alternate': row.actual=row.alternate; change(row,'checked'); break;
    case 'later': change(row,'later'); break;
    case 'ignore': change(row,'ignored'); break;
  }
});
$('lines').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target;
  if (!validReference(form.elements.reference)) return;
  const row=review.rows.find(r=>r.lineIndex===+form.closest('.review-line').dataset.index);
  row.reference=form.elements.reference.value.trim();
  row.actual=form.elements.actual.value.trim();
  row.ambiguous=false;
  change(row,'checked');
});
$('review').addEventListener('input',event=>{
  if (event.target.name==='reference') event.target.setCustomValidity('');
});
$('lines').addEventListener('toggle',event=>{
  if (event.target.open) event.target.querySelectorAll('canvas').forEach(paint);
},true);
$('manual-form').addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target;
  if (!validReference(form.elements.reference)) return;
  const reference=form.elements.reference.value.trim();
  const actual=form.elements.actual.value.trim();
  const lineIndex=Math.min(0,...review.rows.map(r=>r.lineIndex))-1;
  const row={lineIndex,reference,text:actual,actual,box:null,matched:true,issues:diffPaperLine(actual,reference)};
  review.rows.push(row);
  $('add-line').open=false;
  form.reset();
  change(row,'open');
});
async function save() {
  const selected=review.rows.filter(isActive);
  if (fetching || $('save').disabled) return;
  if ($('lines').querySelector('form') || $('manual-form').elements.actual.value || $('manual-form').elements.reference.value) {
    notice('请先确认或收起正在编辑的行。');
    return;
  }
  const pending=selected.reduce((sum,r)=>sum+pendingCount(r),0);
  const mistakes=selected.filter(r=>r.state==='checked').flatMap(r=>
    diffPaperLine(r.actual,r.reference).map(({actual,expected})=>({actual,expected})));
  const decisions = paperDecisions(review.rows);
  busy(true);
  $('save').disabled=true;
  try {
    const stored=await savePaperReview({id:review.id,revision:review.revision,poemId:poem.id,poemTitle:poem.title,part:Number($('part').value),
      reviewedLines:selected.length,pendingCount:pending,confirmedMistakes:mistakes,decisions,
      status:pending?'pending':'confirmed'});
    review.revision=stored.revision;
    $('history-link').hidden=false;
    notice(`已保存。本次核对 ${selected.length} 行，确认错漏 ${mistakes.length} 处${pending?'，待核 '+pending+' 处。重选这张照片可以继续核对。':'。'}`);
  } catch (error) {
    notice(`保存失败。${error.message || '可以重试。'}`);
  } finally { busy(false); $('save').disabled=false; }
}
$('save').addEventListener('click',save);
$('cover').addEventListener('click',()=>{ $('reading').open=false; $('pick').focus(); });
$('poem').addEventListener('change',()=>selectPoem());
$('part').addEventListener('change',applyPart);
$('reload').addEventListener('click',loadPoems);
$('pick').addEventListener('click',()=>$('file').click());
$('camera').addEventListener('click',()=>$('camera-file').click());
for (const input of [$('file'), $('camera-file')]) {
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    void inspect(file);
  });
}
$('retry').addEventListener('click',()=>void inspect(lastFile));
$('new').addEventListener('click',()=>{clearReview(); $('poem').focus();});
loadPoems();
