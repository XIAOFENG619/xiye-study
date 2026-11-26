// Both Chinese pages load this synchronously before their styles and first paint.
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
      browserColor.content = theme === 'dusk' ? '#e6d4ae' : '#f7f7f1';
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
})();
