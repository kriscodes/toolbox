export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'toolbox.theme.v1';

/** Accepts a supported appearance without interpreting unrelated browser data. */
export function parseTheme(value: string | null): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

/** Adds optional appearance controls while leaving all archived project storage untouched. */
export function initializeAppearance(): void {
  const button = document.querySelector<HTMLButtonElement>('.theme-toggle');
  const status = document.querySelector<HTMLElement>('#appearance-status');
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!button) return;

  /** Keeps the document, toggle state, and browser chrome in the same appearance. */
  function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    button!.setAttribute('aria-pressed', String(theme === 'dark'));
    if (themeColor) themeColor.content = theme === 'dark' ? '#13251d' : '#eef3e8';
  }

  applyTheme(parseTheme(document.documentElement.dataset.theme ?? null));
  button.hidden = false;

  // Only the new appearance key is written; existing libraries and pins stay byte-for-byte intact.
  button.addEventListener('click', () => {
    const theme: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    let persisted = true;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
    catch { persisted = false; }
    if (status) status.textContent = `${theme === 'dark' ? 'Dark' : 'Light'} appearance.${persisted ? '' : ' Saved for this visit only.'}`;
  });

  // A cross-tab preference change updates appearance without rewriting storage.
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyTheme(parseTheme(event.newValue));
  });
}
