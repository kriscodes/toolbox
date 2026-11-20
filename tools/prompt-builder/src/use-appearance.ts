import { useEffect, useState } from 'react';

/** Share appearance with the Toolbox shell and other open tabs. */
export function useAppearance() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  /** Synchronize the shared Toolbox appearance without touching the prompt library. */
  function observeAppearance(): () => void {
    /** Follow appearance preferences changed in another tab. */
    function onAppearance(event: StorageEvent): void {
      if (event.key === 'toolbox.theme.v1' || event.key === null)
        setDark(event.newValue === 'dark');
    }
    window.addEventListener('storage', onAppearance);
    return function stopObservingAppearance(): void {
      window.removeEventListener('storage', onAppearance);
    };
  }
  useEffect(observeAppearance, []);

  /** Keep the appearance choice shared with the Toolbox homepage when storage is available. */
  function toggleAppearance(): void {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('toolbox.theme.v1', next ? 'dark' : 'light');
    } catch {
      /* Appearance remains available for this visit. */
    }
  }

  /** Apply appearance changes made in another Toolbox tab. */
  function applyAppearance(): void {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
  useEffect(applyAppearance, [dark]);

  return { dark, toggleAppearance };
}
