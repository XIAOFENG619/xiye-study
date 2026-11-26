// The two real views coexist only while the sheet is travelling. Reversing
// direction keeps their current CSS transition and discards pending callbacks.
export function createDeskScroll(main, releaseDesk) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let timers = [];
  let finish = null;

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    finish = null;
    delete main.dataset.scrollPhase;
    delete main.dataset.scrollUnfurled;
    delete main.dataset.scrollInk;
    main.style.removeProperty('--scroll-sheet-offset');
  }

  function later(ms, callback) { timers.push(setTimeout(callback, ms)); }

  function begin(direction, offset) {
    timers.forEach(clearTimeout);
    timers = [];
    main.dataset.scrollPhase = direction;
    main.style.setProperty('--scroll-sheet-offset', offset + 'px');
    main.focus({ preventScroll: true });
  }

  function open(html, returnY) {
    const desk = main.querySelector('.desk-spread');
    let sheet = main.querySelector('.volume-sheet');
    if (!sheet) {
      main.insertAdjacentHTML('beforeend', html);
      sheet = main.lastElementChild;
    }
    if (returnY != null) window.scrollTo(0, returnY);
    begin('opening', window.scrollY);
    desk.inert = true;
    desk.querySelector(`.subject-${sheet.dataset.volume}`).classList.add('is-pressed');
    sheet.inert = true;
    sheet.setAttribute('aria-hidden', 'true');

    const reveal = () => {
      main.dataset.scrollInk = '';
      sheet.inert = false;
      sheet.removeAttribute('aria-hidden');
      if (document.activeElement === main) sheet.querySelector('h1').focus({ preventScroll: true });
    };
    finish = () => {
      reveal();
      releaseDesk();
      desk.remove();
      reset();
      window.scrollTo(0, 0);
    };
    if (reduced.matches || document.hidden) { finish(); return; }
    // Commit the folded style even when returning via browser Forward.
    sheet.getBoundingClientRect();
    later(95, () => { main.dataset.scrollUnfurled = ''; });
    later(310, reveal);
    later(620, finish);
  }

  function close(html, mount, returnY = 0) {
    const sheet = main.querySelector('.volume-sheet');
    const fresh = !main.dataset.scrollPhase;
    if (!main.querySelector('.desk-spread')) {
      main.insertAdjacentHTML('afterbegin', html);
      mount();
    }
    const desk = main.querySelector('.desk-spread');
    const sheetY = window.scrollY;
    // The entering desk is already at its saved reading position. Offset the
    // overlying sheet so that it visually stays put during the scroll restore.
    if (fresh) {
      main.dataset.scrollUnfurled = '';
      main.dataset.scrollInk = '';
    }
    begin('closing', fresh ? returnY - sheetY : returnY);
    desk.inert = true;
    sheet.inert = true;
    window.scrollTo(0, returnY);
    sheet.getBoundingClientRect();
    delete main.dataset.scrollInk;
    finish = () => {
      sheet.remove();
      desk.inert = false;
      const entry = desk.querySelector(`.subject-${sheet.dataset.volume}`);
      entry.classList.remove('is-pressed');
      reset();
      window.scrollTo(0, returnY);
      if (document.activeElement === main) entry.focus({ preventScroll: true });
    };
    if (reduced.matches || document.hidden) { finish(); return; }
    later(90, () => { delete main.dataset.scrollUnfurled; });
    later(490, finish);
  }

  reduced.addEventListener('change', () => { if (reduced.matches) finish?.(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish?.(); });
  return { open, close, reset };
}

// Native anchors still own keyboard activation, new tabs and navigation.
// A scrolling finger may leave the row before the browser sends pointercancel.
export function bindDeskPress(main) {
  let press = null, cancelledRow = null;
  function clear(cancelled = false) {
    if (!press) return;
    press.row.classList.remove('is-pressed');
    if (cancelled) cancelledRow = press.row;
    press = null;
  }
  main.addEventListener('pointerdown', event => {
    clear();
    cancelledRow = null;
    const row = event.target.closest('.subject-entry, .scroll-options [data-mode-action]');
    if (!row || !event.isPrimary || event.button !== 0) return;
    press = { row, id: event.pointerId, x: event.clientX, y: event.clientY };
    row.classList.add('is-pressed');
  });
  window.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 9) clear(true);
  }, { passive: true });
  window.addEventListener('pointercancel', event => { if (press?.id === event.pointerId) clear(true); });
  window.addEventListener('pointerup', event => { if (press?.id === event.pointerId) clear(); });
  window.addEventListener('blur', () => clear(true));
  main.addEventListener('click', event => {
    if (cancelledRow && event.detail && cancelledRow.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    cancelledRow = null;
  }, true);
}
