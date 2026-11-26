import * as ort from './ocr/ort.wasm.min.mjs';

const assets = new URL('./ocr/', import.meta.url);
ort.env.wasm.wasmPaths = assets.href;
ort.env.wasm.numThreads = 1;

function surface(width, height) {
  const canvas = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
}

// Both Paddle models expect BGR planes normalized to [-1, 1].
function tensor(context, inkWidth = context.canvas.width) {
  const { width, height } = context.canvas;
  const rgba = context.getImageData(0, 0, inkWidth, height).data;
  const plane = width * height;
  const data = new Float32Array(plane * 3);
  for (let y = 0, p = 0; y < height; y++) {
    for (let x = 0; x < inkWidth; x++, p += 4) {
      const i = y * width + x;
      data[i] = rgba[p + 2] / 127.5 - 1;
      data[i + plane] = rgba[p + 1] / 127.5 - 1;
      data[i + 2 * plane] = rgba[p] / 127.5 - 1;
    }
  }
  return new ort.Tensor('float32', data, [1, 3, height, width]);
}

// Text detection predicts the central strip of each line. Measure its
// principal axis and expand the strip to include the surrounding strokes.
function lineRegions(scores, width, height) {
  const visited = new Uint8Array(scores.length);
  const queue = new Int32Array(scores.length);
  const regions = [];
  for (let seed = 0; seed < scores.length; seed++) {
    if (visited[seed] || scores[seed] < .3) continue;
    let count = 1, sumX = 0, sumY = 0, xx = 0, xy = 0, yy = 0, confidence = 0;
    visited[seed] = 1;
    queue[0] = seed;
    for (let cursor = 0; cursor < count; cursor++) {
      const i = queue[cursor], x = i % width, y = Math.floor(i / width);
      sumX += x; sumY += y; xx += x * x; xy += x * y; yy += y * y;
      confidence += scores[i];
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const next = ny * width + nx;
          if (visited[next] || scores[next] < .3) continue;
          visited[next] = 1;
          queue[count++] = next;
        }
      }
    }
    if (count < 12 || confidence / count < .52) continue;
    const angle = .5 * Math.atan2(2 * (xy - sumX * sumY / count),
      xx - sumX * sumX / count - yy + sumY * sumY / count);
    // Short marks have no reliable direction. Keep them upright.
    const a = Math.abs(angle) < Math.PI / 4 ? angle : 0;
    const cos = Math.cos(a), sin = Math.sin(a);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < count; k++) {
      const x = queue[k] % width, y = Math.floor(queue[k] / width);
      const u = x * cos + y * sin, v = -x * sin + y * cos;
      x0 = Math.min(x0, u); x1 = Math.max(x1, u);
      y0 = Math.min(y0, v); y1 = Math.max(y1, v);
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 3 || h < 3) continue;
    const pad = .8 * w * h / (w + h);
    const u = (x0 + x1) / 2, v = (y0 + y1) / 2;
    regions.push({ cx: u * cos - v * sin, cy: u * sin + v * cos,
      width: w + 2 * pad, height: h + 2 * pad, angle: a });
  }
  return regions.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}

function decode(prediction, alphabet) {
  const [, steps, classes] = prediction.dims;
  if (classes !== alphabet.length) throw Error('识别模型与字表版本不一致，请刷新。');
  let previous = -1, confidence = 0;
  const symbols = [];
  for (let step = 0; step < steps; step++) {
    const offset = step * classes;
    let best = 0;
    for (let i = 1; i < classes; i++) {
      if (prediction.data[offset + i] > prediction.data[offset + best]) best = i;
    }
    if (best && best !== previous) {
      symbols.push(alphabet[best]);
      confidence += prediction.data[offset + best];
    }
    previous = best;
  }
  return { text: symbols.join(''), confidence: confidence / Math.max(1, symbols.length) };
}

async function infer(session, input, consume) {
  let output;
  try {
    output = (await session.run({ [session.inputNames[0]]: input }))[session.outputNames[0]];
    return consume(output);
  } finally {
    output?.dispose();
    input.dispose();
  }
}

function cropLine(photo, region, dw, dh) {
  const { cx, cy, width, height, angle } = region;
  const inkWidth = Math.min(1600, Math.max(8, Math.ceil(48 * width / height)));
  const context = surface(Math.max(320, Math.ceil(inkWidth / 8) * 8), 48);
  context.fillStyle = 'white';
  context.fillRect(0, 0, inkWidth, 48);
  context.translate(inkWidth / 2, 24);
  context.scale(inkWidth / width, 48 / height);
  context.rotate(-angle);
  context.drawImage(photo, -cx, -cy, dw, dh);
  const boxWidth = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height;
  const boxHeight = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height;
  const left = Math.max(0, (cx - boxWidth / 2) / dw), top = Math.max(0, (cy - boxHeight / 2) / dh);
  const right = Math.min(1, (cx + boxWidth / 2) / dw), bottom = Math.min(1, (cy + boxHeight / 2) / dh);
  return { input: tensor(context, inkWidth), box: [left, top, right - left, bottom - top] };
}

async function loadModel(file) {
  const response = await fetch(new URL(file, assets));
  if (!response.ok) throw Error('识别模型下载失败，请检查网络后点「重试识别」。');
  return ort.InferenceSession.create(await response.arrayBuffer(), { executionProviders: ['wasm'] });
}

export async function readLines(pixels, progress) {
  const photo = surface(pixels.width, pixels.height);
  photo.putImageData(pixels, 0, 0);
  const ratio = Math.min(1, 960 / Math.max(pixels.width, pixels.height));
  const round32 = n => Math.max(32, 32 * Math.round(n * ratio / 32));
  const dw = round32(pixels.width), dh = round32(pixels.height);
  const small = surface(dw, dh);
  small.drawImage(photo.canvas, 0, 0, dw, dh);
  progress('正在准备文字定位模型…');
  const detector = await loadModel('detect.onnx');
  let regions;
  try {
    progress('正在照片中定位文字行…');
    regions = await infer(detector, tensor(small), out => lineRegions(out.data, out.dims[3], out.dims[2]));
  } finally {
    await detector.release();
  }
  if (!regions.length) return [];
  if (regions.length > 120) throw Error('照片里文字较多，请裁到这次的默写范围后重试。');
  progress('正在准备中文识别模型…');
  const alphabetResponse = await fetch(new URL('alphabet.json', assets));
  if (!alphabetResponse.ok) throw Error('识别字表下载失败，请重试。');
  const alphabet = await alphabetResponse.json();
  const reader = await loadModel('read.onnx');
  const lines = [];
  try {
    for (const region of regions) {
      progress('正在辨认第 ' + (regions.indexOf(region) + 1) + ' / ' + regions.length + ' 行…');
      const { input, box } = cropLine(photo.canvas, region, dw, dh);
      const result = await infer(reader, input, out => decode(out, alphabet));
      if (result.text.trim()) lines.push({ ...result, box });
    }
  } finally {
    await reader.release();
  }
  return lines;
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = async ({ data }) => {
    try {
      const lines = await readLines(data, progress => self.postMessage({ progress }));
      self.postMessage({ lines });
    } catch (error) {
      self.postMessage({ error: error.message || '这张照片未能识别，请裁到默写区域后重试。' });
    }
  };
}
