let current = null;

export function stopWord() {
  const previous = current;
  current = null;
  previous?.pause();
}

export async function playWord(item) {
  stopWord();
  const name = encodeURIComponent((item.word + '-' + item.targetReading).normalize('NFC'));
  const clip = new Audio(new URL('./audio/words/' + name + '.mp3', import.meta.url).href);
  current = clip;
  try {
    await clip.play();
  } catch (error) {
    if (current !== clip && error.name === 'AbortError') return;
    if (current === clip) current = null;
    throw new Error('这个词的读音暂时无法播放，请再点一次。', { cause: error });
  }
}
