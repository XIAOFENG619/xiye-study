// The Chinese pages load this before their styles and first paint.
(() => {
  const key = 'xiye.reading.theme.v1';
  const root = document.documentElement;
  const browserColor = document.querySelector('meta[name="theme-color"]');

  function savedTheme() {
    try {
      return localStorage.getItem(key) === 'dusk' ? 'dusk' : 'day';
    } catch {
      return root.dataset.readingTheme || 'day';
    }
  }

  function apply(theme) {
    if (root.dataset.readingTheme !== theme) {
      root.dataset.readingTheme = theme;
      browserColor.content = theme === 'dusk' ? '#e6d4ae' : '#f6f2e9';
      document.dispatchEvent(new CustomEvent('readingthemechange', { detail: { theme } }));
    }
    return theme;
  }

  apply(savedTheme());
  window.readingTheme = {
    get current() { return root.dataset.readingTheme; },
    toggle() {
      const next = this.current === 'dusk' ? 'day' : 'dusk';
      try {
        localStorage.setItem(key, next);
      } catch {
        // Privacy settings can limit the preference to the current page.
      }
      return apply(next);
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(savedTheme());
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) apply(savedTheme());
  });

  // Let the IME consume its candidate-selection Enter. Safari can finish
  // composition just before it delivers an implicit form submission.
  let composingForm = null;
  let justCommittedForm = null;
  let committedAt = -Infinity;
  document.addEventListener('compositionstart', event => {
    composingForm = event.target.form;
    justCommittedForm = null;
  }, true);
  document.addEventListener('compositionend', event => {
    composingForm = null;
    justCommittedForm = event.target.form;
    committedAt = performance.now();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) {
      justCommittedForm = event.target.form;
      committedAt = performance.now();
    }
  }, true);
  document.addEventListener('click', event => {
    if (event.detail > 0 && event.target.closest?.('button[type=submit], input[type=submit], button:not([type])')) {
      justCommittedForm = composingForm = null;
    }
  }, true);
  document.addEventListener('submit', event => {
    if (event.target !== composingForm &&
        (event.target !== justCommittedForm || performance.now() - committedAt >= 100)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
