import { SCENES, DEBUG_HOTSPOTS } from './desk-scenes.mjs';
import { createDeskParticles } from './desk-particles.mjs';

const [initial] = SCENES;
const fadeMs = 700;
const guideLabels = { sun: '红日', blossoms: '花树', water: '江面', sky: '留白' };

export function renderDeskWindow() {
  return `<div class="desk-plate" data-desk-window data-scene="${initial.id}" style="--fade-time:${fadeMs}ms">
    <div class="desk-plane base-plane"><div class="desk-pictures">
      <div class="landscape-slot resting"><img src="${initial.image}" alt="${initial.description}" fetchpriority="high"></div>
      <div class="landscape-slot"></div>
    </div></div>
    <div class="desk-plane mist-plane" aria-hidden="true"><div class="desk-mist"><div></div></div></div>
    <div class="desk-plane ink-plane"><div class="desk-ink">
      <div class="desk-verse"></div>
      <div class="desk-hotspots"></div>
      <canvas class="desk-canvas" aria-hidden="true"></canvas>
    </div></div>
  </div>`;
}

function stamp(text) {
  return `<svg class="desk-seal" aria-hidden="true" viewBox="0 0 23 38">
    <path fill="currentColor" d="M2 1.5 21.6 1l-.4 35.5-19.2.4z"/>
    <path fill="none" stroke="#f7e3cb" stroke-width=".7" d="m3.7 3.3 16.1-.5-.3 31.9-15.6.3z"/>
    <text x="11.5" y="16" text-anchor="middle">${text[0]}</text>
    <text x="11.5" y="31" text-anchor="middle">${text[1]}</text>
  </svg>`;
}

export function mountDeskWindow(spread) {
  const frame = spread.querySelector('[data-desk-window]');
  const menu = spread.querySelector('.subject-list');
  const slots = Array.from(frame.querySelectorAll('.landscape-slot'));
  const caption = frame.querySelector('.desk-verse');
  const zones = frame.querySelector('.desk-hotspots');
  const canvas = frame.querySelector('canvas');
  const particles = createDeskParticles(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const images = new Map([[initial.id, Promise.resolve(slots[0].firstElementChild)]]);
  let front = slots[0], active = initial;
  let wanted = initial, pending = null;
  let hoverTimer, returnTimer, fadeTimer;
  let lastPetal = null, disposed = false;

  frame.toggleAttribute('data-debug', DEBUG_HOTSPOTS);
  function imageFor(scene) {
    if (!images.has(scene.id)) {
      const img = new Image();
      img.alt = scene.description;
      img.src = scene.image;
      images.set(scene.id, img.decode().then(() => img));
    }
    return images.get(scene.id);
  }

  function syncSun() {
    const sun = zones.querySelector('button');
    if (sun) sun.setAttribute('aria-pressed', String(window.readingTheme.current === 'dusk'));
  }

  function setInk(scene) {
    // Let the previous writing dissolve over the old painting during the turn.
    const old = caption.querySelector('[data-inscription]');
    if (old) {
      old.removeAttribute('data-inscription');
      old.setAttribute('aria-hidden', 'true');
      old.classList.add('fading');
    }
    const verse = document.createElement('div');
    verse.className = 'inscription';
    verse.dataset.inscription = '';
    verse.dataset.guide = '题跋';
    Object.assign(verse.style, scene.inscription);
    if (scene !== initial) {
      const lines = scene.verse.map(line => `<span>${line}</span>`).join('');
      verse.innerHTML = `<div class="inscription-block"><div class="ink-lines">${lines}</div>${stamp(scene.seal)}</div>`;
    }
    caption.append(verse);
    for (const [key, box] of Object.entries(scene.hotspots)) {
      let zone = zones.querySelector(`[data-hotspot="${key}"]`);
      if (!zone) {
        zone = document.createElement(key === 'sun' ? 'button' : 'div');
        zone.dataset.hotspot = key;
        zone.dataset.guide = guideLabels[key];
        if (key === 'sun') {
          zone.type = 'button';
          zone.setAttribute('aria-label', '灯下暮读');
        } else zone.setAttribute('aria-hidden', 'true');
        zones.append(zone);
      }
      Object.assign(zone.style, box);
    }
    for (const zone of [...zones.children]) {
      if (!Object.hasOwn(scene.hotspots, zone.dataset.hotspot)) zone.remove();
    }
    syncSun();
  }

  function finishFade() {
    if (!pending) return;
    clearTimeout(fadeTimer);
    front.className = 'landscape-slot';
    front.replaceChildren();
    front = pending;
    front.className = 'landscape-slot resting';
    pending = null;
    caption.querySelector('.fading')?.remove();
    if (!disposed && wanted !== active) prepare();
  }

  async function prepare() {
    const scene = wanted;
    if (disposed || pending || scene === active) return;
    let image;
    try { image = await imageFor(scene); }
    catch { images.delete(scene.id); return; }
    if (disposed || pending || wanted !== scene || scene === active) return;
    pending = slots.find(slot => slot !== front);
    pending.replaceChildren(image);
    pending.className = 'landscape-slot arriving';
    active = scene;
    frame.dataset.scene = scene.id;
    for (const link of menu.querySelectorAll('.subject-entry')) link.toggleAttribute('data-viewing', link.dataset.sceneId === scene.id);
    particles.clear();
    lastPetal = null;
    setInk(scene);
    if (reduced.matches) finishFade();
    else fadeTimer = setTimeout(finishFade, fadeMs);
  }

  function request(id, wait) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      wanted = SCENES.find(scene => scene.id === id) || initial;
      prepare();
    }, wait);
  }
  function enterLink(event) {
    if (event.pointerType === 'touch') return;
    const link = event.target.closest('[data-scene-id]') || event.target.closest('.subject-row')?.querySelector('.subject-entry');
    if (!link || link.contains(event.relatedTarget)) return;
    clearTimeout(returnTimer);
    request(link.dataset.sceneId, 120);
  }
  function armReturn() {
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => {
      if ([frame, menu].some(el => el.matches(':hover') || el.querySelector(':focus-visible'))) return;
      request(initial.id, 0);
    }, 1500);
  }
  listen(menu, 'pointerover', enterLink);
  listen(menu, 'focusin', enterLink);
  listen(menu, 'pointerleave', () => { clearTimeout(hoverTimer); armReturn(); });
  listen(menu, 'focusout', armReturn);
  listen(frame, 'pointerenter', () => clearTimeout(returnTimer));
  listen(frame, 'focusin', () => clearTimeout(returnTimer));
  listen(frame, 'focusout', armReturn);

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }
  listen(frame, 'pointermove', event => {
    if (reduced.matches || event.pointerType === 'touch') return;
    if (event.target.dataset.hotspot !== 'blossoms') { lastPetal = null; return; }
    const now = performance.now();
    const { clientX: x, clientY: y } = event;
    if (lastPetal && (now - lastPetal.time < 450 || Math.hypot(x - lastPetal.x, y - lastPetal.y) < 28)) return;
    particles.petals(...canvasPoint(event));
    lastPetal = { x, y, time: now };
  });
  listen(frame, 'pointerleave', () => { lastPetal = null; armReturn(); });
  listen(zones, 'click', event => {
    const key = event.target.closest('[data-hotspot]')?.dataset.hotspot;
    if (key === 'sun') window.readingTheme.toggle();
    if ((key === 'water' || key === 'sky') && !reduced.matches) particles.ripple(...canvasPoint(event));
  });
  listen(document, 'readingthemechange', syncSun);
  listen(reduced, 'change', () => {
    if (reduced.matches) { lastPetal = null; particles.clear(); finishFade(); }
  });
  setInk(initial);

  return () => {
    disposed = true;
    events.abort();
    clearTimeout(hoverTimer);
    clearTimeout(returnTimer);
    clearTimeout(fadeTimer);
    particles.destroy();
  };
}
