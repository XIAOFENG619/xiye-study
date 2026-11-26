// Only model files leave their host. The image and inference results stay on this device.
async function prepareImage(photo) {
  const url = URL.createObjectURL(photo);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    if (width * height > 50_000_000) throw Error('照片像素太大，请裁到默写区域后重试。');
    const scale = Math.min(1, 2000 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { width, height, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function recognizeHandwriting(photo, onProgress = () => {}) {
  const { width, height, pixels } = await prepareImage(photo);
  let lines;
  if (typeof OffscreenCanvas === 'function' && typeof Worker === 'function') {
    const worker = new Worker(new URL('./handwriting-inference.mjs', import.meta.url), { type: 'module' });
    try {
      lines = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data.progress) onProgress(data.progress);
          else if (data.error) reject(new Error(data.error));
          else resolve(data.lines);
        };
        worker.onerror = () => reject(new Error('识别组件未能运行，请刷新页面重试。'));
        worker.postMessage(pixels, [pixels.data.buffer]);
      });
    } finally {
      worker.terminate();
    }
  } else {
    const { readLines } = await import('./handwriting-inference.mjs');
    lines = await readLines(pixels, onProgress);
  }
  return { width, height, lines };
}
