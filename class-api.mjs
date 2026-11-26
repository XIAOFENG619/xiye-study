import { buildChineseQuestion } from './class-lib/chinese-bank.mjs';
import { poemCatalog, poemList, buildPoem } from './class-lib/chinese-poetry.mjs';
import { buildScreeningItems } from './class-lib/screening-bank.mjs';

let loading;
function loadClassRecords() {
  if (!loading) {
    loading = globalThis.fetch(new URL('./class-data.json', import.meta.url)).then(response => {
      if (!response.ok) throw new Error('未能读取班级题库');
      return response.json();
    }).catch(error => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

const invalid = (error, status = 400) => Response.json({ error }, { status });

// The static site passes the image directly to the browser recognizer. It never
// needs to send a photo (or the selected poem) to the web host.
let readingPhoto = false;
async function inspectHandwriting(options) {
  if (options.method !== 'POST') return invalid('请通过网页选择照片。', 405);
  const photo = options.body;
  const type = (new Headers(options.headers).get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!(photo instanceof Blob) || !['image/png', 'image/jpeg'].includes(type)) {
    return invalid('请选择 JPEG 或 PNG 照片。', 415);
  }
  if (photo.size > 15 * 1024 * 1024) return invalid('照片超过 15 MB，请缩小后再导入。', 413);
  if (readingPhoto) return invalid('另一张照片正在核对，请稍后重试。', 503);
  readingPhoto = true;
  try {
    const signature = type === 'image/jpeg' ? [255, 216, 255] : [137, 80, 78, 71, 13, 10, 26, 10];
    const head = new Uint8Array(await photo.slice(0, signature.length).arrayBuffer());
    if (!signature.every((byte, i) => head[i] === byte)) {
      return invalid('文件内容与所选图片格式不符，请重新选择。', 415);
    }
    const { recognizeHandwriting } = await import('./browser-handwriting.mjs');
    return Response.json(await recognizeHandwriting(photo, options.onProgress));
  } catch (error) {
    return invalid(error.message || '照片识别失败，请重新选择照片。', 503);
  } finally {
    readingPhoto = false;
  }
}

export async function classFetch(input, options = {}) {
  const { pathname, searchParams: params } = new URL(input, import.meta.url);
  const endpoint = pathname.slice(pathname.lastIndexOf('/api/'));
  if (endpoint === '/api/chinese/handwriting') return inspectHandwriting(options);
  if ((options.method || 'GET') !== 'GET') return invalid('此入口只支持取题与查询。', 405);
  if (endpoint === '/api/rag/info') return Response.json({ model: null });
  try {
    const records = await loadClassRecords();
    const section = params.get('section');
    switch (endpoint) {
      case '/api/chinese/catalog':
        return Response.json({ titles: poemCatalog(records) });
      case '/api/chinese/poems':
        return Response.json({ poems: poemList(records) });
      case '/api/chinese/screening':
        if (!['sound', 'spelling'].includes(section)) return invalid('请选择字音或字形筛查。');
        return Response.json({ items: buildScreeningItems(records, section) });
      case '/api/chinese/question': {
        if (section === 'poetry') {
          const question = buildPoem(records, params.get('title'), params.get('previous'));
          if (!question) return invalid('这篇还没有可用的情境题。', 422);
          const citation = records.find(record => record.id === question.sourceId);
          return Response.json({ ...question, sourceUrl: citation?.source });
        }
        if (!['sound', 'spelling'].includes(section)) return invalid('请选择练习专项。');
        const kind = section === 'sound' && params.get('kind') === 'passage' ? 'passage' : 'group';
        return Response.json(buildChineseQuestion(records, section, { kind }));
      }
      case '/api/rag/search': {
        const q = (params.get('q') || '').trim();
        const mode = params.get('mode') ?? 'lookup';
        const limit = Number(params.get('limit') ?? 6);
        if (!q || q.length > 300 || !Number.isInteger(limit) || limit < 1 || limit > 20 ||
            !['lookup', 'exercise'].includes(mode) ||
            !['all', 'poetry', 'sound', 'spelling', 'reference'].includes(section ?? 'all')) {
          return invalid('请输入 1–300 字的查询，并选择有效的专项、用途和返回条数（1–20）。');
        }
        const { queryKnowledge } = await import('./class-lib/rag-query.mjs');
        const result = queryKnowledge(records, { q, section: section ?? 'all', mode, limit });
        const hits = result.hits.map(({ id, section, status, title, text, locator, source }) => ({
          id, section, status, title, text, locator, source,
          ...(section === 'poetry' ? { sourceUrl: source } : {}),
        }));
        return Response.json({ ...result, hits });
      }
      default:
        return invalid('没有这个练习入口。', 404);
    }
  } catch {
    return invalid('未能读取练习资料，请刷新网页再试。', 503);
  }
}
