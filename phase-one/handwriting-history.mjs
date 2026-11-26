export const paperReviewPrefix = 'xiye.chinese.handwriting.v1.';

export function getPaperReview(id, storage = localStorage) {
  const data = storage.getItem(paperReviewPrefix + id);
  return data === null ? null : JSON.parse(data);
}

export function listPaperReviews(storage = localStorage) {
  const reviews = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(paperReviewPrefix)) reviews.push(JSON.parse(storage.getItem(key)));
  }
  return reviews.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function savePaperReview(review, storage = localStorage) {
  const { id, poemId, poemTitle, part = 0, reviewedLines, pendingCount,
    confirmedMistakes, decisions = [] } = review;
  if (!id || !poemId || !poemTitle || !Number.isInteger(reviewedLines) || reviewedLines < 0 ||
      !Number.isInteger(pendingCount) || pendingCount < 0 || !Array.isArray(confirmedMistakes)) {
    throw new Error('尚无可保存的纸上默写记录。');
  }
  const key = paperReviewPrefix + id;
  const write = () => {
    const previous = getPaperReview(id, storage);
    if (reviewedLines === 0 && (!previous || pendingCount !== 0 || confirmedMistakes.length !== 0)) {
      throw new Error('尚无可保存的纸上默写记录。');
    }
    const data = { id, poemId, poemTitle, part, reviewedLines, pendingCount, confirmedMistakes, decisions };
    if (previous && Object.keys(data).every(k => JSON.stringify(data[k]) === JSON.stringify(previous[k]))) return previous;
    if ((review.revision ?? 0) !== (previous?.revision ?? 0)) throw new Error('另一页已更新此次核对。请重新选择原照片，继续核对最新记录。');
    const saved = { ...data, revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    storage.setItem(key, JSON.stringify(saved));
    return saved;
  };
  const locks = globalThis.window?.navigator.locks;
  return locks ? locks.request(key, write) : write();
}
