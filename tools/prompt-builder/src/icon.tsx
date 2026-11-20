import type { ReactNode } from 'react';

type IconName =
  'box' | 'plus' | 'folder' | 'copy' | 'spark' | 'arrow' | 'save' | 'close' | 'download' | 'lock';
const ICON_PATHS: Record<IconName, string> = {
  box: 'M21 8l-9 5-9-5M12 13v9M21 8v10l-9 5-9-5V8l9-5 9 5z',
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7V5a1 1 0 011-1h5l2 3h9a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V7z',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
  spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
  arrow: 'M15 5l-7 7 7 7M8 12h13',
  save: 'M5 3h14v19l-7-5-7 5V3z',
  close: 'M6 6l12 12M18 6L6 18',
  download: 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 018 0v4',
};

/** Draw small decorative interface icons without adding an icon framework to the tool. */
export function Icon({ name }: { name: IconName }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
