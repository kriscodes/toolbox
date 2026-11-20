import { useEffect } from 'react';

/** Protect work during navigation while edits or requests are pending. */
export function useUnsavedWarning(unsaved: boolean): void {
  useEffect(
    function protectDraft() {
      /** Ask the browser to protect unsaved work before leaving the page. */
      function beforeUnload(event: BeforeUnloadEvent): void {
        if (unsaved) {
          event.preventDefault();
          event.returnValue = '';
        }
      }
      window.addEventListener('beforeunload', beforeUnload);
      return function removeProtection() {
        window.removeEventListener('beforeunload', beforeUnload);
      };
    },
    [unsaved],
  );
}
