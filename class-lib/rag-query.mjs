const statuses = {
  candidate: '编题候选',
  text: '已核对的正文',
  title: '背诵篇名记录',
  review: '写法或语境待核，仅供回看',
  unclear: '原表括注待辨，仅供回看',
  reference: '图片识别文字未校对，仅供查阅'
};
const allowedForExercise = new Set(['candidate', 'text']);
const sectionWords = new Map([
  ['古诗', 'poetry'], ['古诗文', 'poetry'], ['背诵篇目', 'poetry'],
  ['字音', 'sound'], ['字形', 'spelling'], ['错别字', 'spelling'], ['原图', 'reference']
]);
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const toneMarks = ['\u0304', '\u0301', '\u030c', '\u0300'];
const fillerWords = new Set(['应该', '怎么', '如何', '什么', '不同', '分别', '读音', '读法', '拼音', '写法', '文字', '资料', '词语', '请问', '查找', '一下', '辨析']);

function compact(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

// Keep tone differences when specified. Unmarked "jue" can find any tone of that syllable.
function syllable(value) {
  if (!/^[\p{Script=Latin}\p{M}]+[1-5]?$/u.test(value)) return null;
  let base = value.normalize('NFD').replace(/u\u0308/g, 'v');
  const marked = toneMarks.findIndex(mark => base.includes(mark)) + 1;
  const digit = Number(base.match(/[1-5]$/u)?.[0] || 0);
  if (marked && digit && marked !== digit) return null;
  base = base.replace(/[\p{M}1-5]/gu, '');
  return { base, tone: digit || marked };
}

function pageNumber(label) {
  if (/^\d+$/u.test(label)) return Number(label);
  const digits = '零一二三四五六七八九';
  if (!label.includes('十')) return digits.indexOf(label);
  const [tens, ones] = label.split('十');
  return 10 * (tens ? digits.indexOf(tens) : 1) + (ones ? digits.indexOf(ones) : 0);
}

function parseQuery(q, selectedSection) {
  const input = q.normalize('NFKC').toLowerCase();
  const pageMatch = input.match(/第\s*(\d+|[一二三四五六七八九]?十[一二三四五六七八九]?|[一二三四五六七八九])\s*页(?:的)?/u);
  const page = pageMatch ? pageNumber(pageMatch[1]) : null;
  const normalized = pageMatch ? input.replace(pageMatch[0], '') : input;
  const plain = compact(normalized);
  const focused = plain
    .replace(/^(?:请问|请帮我|帮我|我想|请|查询|查找|查一下|查|给|怎么辨析|什么是)+/u, '')
    .replace(/(?:的)?(?:这个字|这个词|字)?(?:怎么读|如何读|读什么音|怎么念|怎么写|怎样写|有哪些读音|读音有哪些|的拼音是什么|的读音是什么|读音|拼音|注音|全文|原文|是什么)$/u, '');
  // Full-word matches take precedence. A one-character key only matches a deliberate
  // single-character search, not every compound sharing that character.
  const syllables = Array.from(normalized.matchAll(/[\p{Script=Latin}\p{M}]+[1-5]?/gu), m => syllable(m[0])).filter(Boolean);
  const tokens = [...new Set(Array.from(segmenter.segment(focused), part => part.segment)
    .filter(token => token.length >= 2 && !fillerWords.has(token)))];
  const broad = plain
    .replace(/^(?:请|给我|帮我|随机|找|查|来|选|出|做|练|一组|一道|一题|几个|几道|一些|一下)+/u, '')
    .replace(/(?:专项|练习|词例|词条|有哪些|题目|资料|范围|题)+$/u, '');
  let browse = sectionWords.get(broad);
  if (!broad && (page !== null || (selectedSection !== 'all' && /题|练习|词条/u.test(plain)))) browse = selectedSection;
  return { plain, focused, syllables, tokens, browse, page, polyphonic: broad === '多音字' };
}

function polyphonicWords(records) {
  const readings = new Map();
  const characters = new Map();
  for (const record of records) {
    if (record.section !== 'sound') continue;
    const character = record.terms.find(term => /^\p{Script=Han}$/u.test(term));
    const pinyin = record.terms.find(term => syllable(term));
    if (!character || !pinyin) continue;
    if (!readings.has(character)) readings.set(character, new Set());
    readings.get(character).add(pinyin);
    characters.set(record.id, character);
  }
  return records.filter(record => readings.get(characters.get(record.id))?.size > 1);
}

function termScore(value, query) {
  const term = compact(value);
  if (!term) return 0;
  const pronunciation = syllable(term);
  if (pronunciation) {
    const match = query.syllables.some(({ base, tone }) =>
      pronunciation.base === base && (!tone || tone === pronunciation.tone));
    return match ? 75 : 0;
  }
  if (query.focused === term) return 100 + term.length;
  if (term.length >= 2 && query.plain.includes(term)) return 80 + term.length;
  if (query.focused.length >= 2 && term.includes(query.focused)) return 60;
  return 0;
}

function passageScore(record, query) {
  const text = compact(record.text);
  const weak = record.section === 'reference';
  if (query.focused && text.includes(query.focused)) return weak ? 30 : 60;
  if (query.tokens.length && query.tokens.every(word => text.includes(word))) return weak ? 15 : 45;
  return 0;
}

function score(record, query) {
  if (query.polyphonic) return 1;
  if (query.browse) return record.section === query.browse || query.browse === 'all' ? 1 : 0;
  const wordScore = Math.max(termScore(record.title, query), ...record.terms.map(term => termScore(term, query)));
  if (wordScore) return wordScore + (record.status === 'text' ? 1 : 0);
  // Only actual reading passages and page transcriptions support full-text searches.
  // A mention inside the boilerplate of a spelling entry is not evidence for a query.
  return ['reference', 'text'].includes(record.status) ? passageScore(record, query) : 0;
}

function excerpt(text, query) {
  if (text.length <= 550) return text;
  const keys = [query.focused, ...query.tokens].filter(Boolean);
  const anchor = keys.map(key => text.toLowerCase().indexOf(key)).find(index => index >= 0) ?? 0;
  const start = Math.min(text.length - 550, Math.max(0, anchor - 120));
  return (start ? '…' : '') + text.slice(start, start + 550) + (start + 550 < text.length ? '…' : '');
}

/** Search only the supplied corpus and return extracts with their printed locations. */
export function queryKnowledge(records, { q, section = 'all', mode = 'lookup', limit = 6 }) {
  if (!['lookup', 'exercise'].includes(mode)) throw new TypeError('未知检索用途');
  if (!['all', 'sound', 'spelling', 'poetry', 'reference'].includes(section)) throw new TypeError('未知专项');
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('检索条数须为正整数');
  const query = parseQuery(q, section);
  const pool = query.polyphonic ? polyphonicWords(records) : records;
  const eligible = pool.filter(record => (section === 'all' || section === record.section)
    && (query.page === null || (record.page ?? Number(record.source.match(/\/(\d+)\.jpg$/iu)?.[1])) === query.page)
    && (mode !== 'exercise' || allowedForExercise.has(record.status)));
  const ranked = query.plain || query.page !== null ? eligible.map(record => ({ record, weight: score(record, query) }))
    .filter(entry => entry.weight > 0).sort((a, b) => b.weight - a.weight) : [];
  const hits = ranked.slice(0, limit).map(entry => entry.record);
  if (!hits.length) {
    let answer = mode === 'exercise'
      ? '在当前范围内没有检索到可用于编题的依据。'
      : '在当前资料中没有检索到匹配的条目。';
    if (mode === 'exercise') {
      const first = queryKnowledge(records, { q, section, mode: 'lookup', limit: 1 }).hits[0];
      if (first && !allowedForExercise.has(first.status)) {
        answer = `找到了「${first.title}」（${first.locator}）。${statuses[first.status]}，暂缓用于出题。`;
      }
    }
    return { hits, context: '', answer };
  }
  const evidence = hits.map((record, i) =>
    `[${i + 1}] ${record.title} · ${statuses[record.status]}\n${excerpt(record.text, query)}\n出处 ${record.locator}（${record.source}）`);
  const guidance = mode === 'exercise'
    ? '按检索问题和所列材料编题，注明出处。题目须另行检验答案唯一性。证据不足时说明缺少什么。'
    : '依据所列材料回答并注明出处。篇名只能确认背诵范围，待核及识别文字供查阅。';
  return {
    hits,
    context: `${guidance}\n检索问题　${q}\n\n${evidence.join('\n\n')}`,
    answer: evidence.join('\n\n')
  };
}
