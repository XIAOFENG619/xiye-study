const MAX_PETALS = 20;
const MAX_RIPPLES = 4;
const petalColorsDay = ['#f7e8d7', '#edc9bf', '#f4d8cf', '#f4eada'];
const petalColorsDusk = ['#ead2b4', '#dcb49f', '#e5c4b0', '#e7d3b6'];

function between(min, max) {
  return min + Math.random() * (max - min);
}

function isDuskTheme() {
  return document.documentElement.dataset.readingTheme === 'dusk';
}

function drawPetal(ctx, petal, age, progress, dusk) {
  const sway = Math.sin(petal.phase + age * 1.75) - Math.sin(petal.phase);
  const x = petal.x + age * petal.wind + sway * 6.5;
  const y = petal.y + age * petal.speed + 2.4 * age * age;
  const fadeIn = Math.min(1, age / .18);
  const fadeOut = Math.min(1, (1 - progress) / .48);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(petal.phase + age * petal.spin + sway * .14);
  ctx.scale(petal.size * .92, petal.size * (.82 + .16 * Math.cos(age * 1.9 + petal.phase)));
  ctx.globalAlpha = (dusk ? .64 : .76) * fadeIn * fadeOut;
  ctx.fillStyle = dusk ? petal.duskColor : petal.dayColor;
  ctx.beginPath();
  ctx.moveTo(0, -1.2);
  ctx.bezierCurveTo(1.12, -.72, .72, .52, 0, 1.28);
  ctx.bezierCurveTo(-.7, .64, -.88, -.62, 0, -1.2);
  ctx.fill();
  ctx.restore();
}

function drawRipple(ctx, ripple, progress, dusk) {
  const radius = 2.5 + ripple.radius * (1 - (1 - progress) ** 1.65);
  const alpha = .22 * Math.min(1, progress * 10) * (1 - progress) ** 1.35;
  ctx.save();
  ctx.strokeStyle = dusk ? '#634d37' : '#455851';
  ctx.lineWidth = .9;

  // 外圈纤细主水纹
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(ripple.x, ripple.y, radius, radius * .28, -.05, 0, Math.PI * 2);
  ctx.stroke();

  // 极淡内波余韵
  if (progress > .16) {
    const innerProgress = (progress - .16) / .84;
    const innerRadius = 1.8 + ripple.radius * .58 * (1 - (1 - innerProgress) ** 1.5);
    ctx.globalAlpha = alpha * .45;
    ctx.beginPath();
    ctx.ellipse(ripple.x, ripple.y, innerRadius, innerRadius * .28, -.05, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Input coordinates are CSS pixels relative to the visible canvas.
export function createDeskParticles(canvas) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let petals = [];
  let ripples = [];
  let ctx;
  let frame = 0;
  let detached = false;
  let width = 0;
  let height = 0;

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    petals.length = 0;
    ripples.length = 0;
    ctx?.clearRect(0, 0, width, height);
  }

  function sizeCanvas() {
    if (!ctx) return;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(cssWidth * scale);
    const pixelHeight = Math.round(cssHeight * scale);
    if (width === cssWidth && height === cssHeight &&
        canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    clear();
    width = cssWidth;
    height = cssHeight;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    if (width && height) ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  }

  function draw(now) {
    frame = 0;
    const dusk = isDuskTheme();
    ctx.clearRect(0, 0, width, height);
    petals = petals.filter(petal => {
      const age = Math.max(0, (now - petal.start) / 1000);
      if (age >= petal.life) return false;
      drawPetal(ctx, petal, age, age / petal.life, dusk);
      return true;
    });
    ripples = ripples.filter(ripple => {
      const progress = Math.max(0, (now - ripple.start) / 1000 / ripple.life);
      if (progress >= 1) return false;
      drawRipple(ctx, ripple, progress, dusk);
      return true;
    });
    if (petals.length || ripples.length) frame = requestAnimationFrame(draw);
  }

  const observer = new ResizeObserver(sizeCanvas);
  function canPaint() {
    if (detached || document.hidden || motion.matches) return false;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      if (!ctx) return false;
      observer.observe(canvas);
      window.addEventListener('resize', sizeCanvas);
    }
    sizeCanvas();
    return width > 0 && height > 0;
  }

  function scatter(x, y) {
    if (!canPaint()) return;
    const count = Math.min(MAX_PETALS - petals.length, Math.floor(between(3, 6)));
    if (count < 3) return;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const colorIndex = Math.floor(Math.random() * petalColorsDay.length);
      petals.push({
        x: x + between(-8, 8), y: y + between(-5, 5), start,
        life: between(3.0, 4.4), size: between(2.8, 4.6),
        phase: between(0, Math.PI * 2), wind: between(3, 13),
        speed: between(8, 15), spin: between(-.85, .85),
        dayColor: petalColorsDay[colorIndex],
        duskColor: petalColorsDusk[colorIndex],
      });
    }
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function ripple(x, y) {
    if (!canPaint() || ripples.length >= MAX_RIPPLES) return;
    ripples.push({ x, y, start: performance.now(), radius: Math.min(42, width * .105), life: 1.85 });
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function pauseIfNeeded() {
    if (document.hidden || motion.matches) clear();
  }
  document.addEventListener('visibilitychange', pauseIfNeeded);
  motion.addEventListener('change', pauseIfNeeded);

  function destroy() {
    detached = true;
    clear();
    observer.disconnect();
    window.removeEventListener('resize', sizeCanvas);
    document.removeEventListener('visibilitychange', pauseIfNeeded);
    motion.removeEventListener('change', pauseIfNeeded);
  }

  return { petals: scatter, ripple, clear, destroy };
}
