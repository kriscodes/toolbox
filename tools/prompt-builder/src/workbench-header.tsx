import type { ReactNode } from 'react';
import { Icon } from './icon';
import { useAppearance } from './use-appearance';

/** Render shared navigation, appearance and private-access entry points. */
export function WorkbenchHeader({
  busy,
  unlocked,
  showAccess,
}: {
  busy: boolean;
  unlocked: boolean;
  showAccess: () => void;
}): ReactNode {
  const { dark, toggleAppearance } = useAppearance();
  return (
    <>
      <header className="pb-top">
        <a className="pb-maker" href="https://kristiansalmeron.com/" referrerPolicy="origin">
          <strong>KS</strong>
          <span className="pb-maker-divider" />
          Kristian Salmeron
        </a>
        <nav className="pb-top-nav" aria-label="Main navigation">
          <a href="/">
            Toolbox <span aria-hidden="true">↗</span>
          </a>
          <a href="https://kristiansalmeron.com/" referrerPolicy="origin">
            Portfolio <span aria-hidden="true">↗</span>
          </a>
          <button
            className="pb-theme"
            type="button"
            aria-label="Dark appearance"
            aria-pressed={dark}
            onClick={toggleAppearance}
          >
            {dark ? '☀' : '◐'}
          </button>
        </nav>
      </header>
      <div className="pb-intro">
        <div>
          <p className="pb-kicker">
            <a href="/">TOOLBOX</a>
            <span aria-hidden="true"> / </span> PROMPT BUILDER
          </p>
          <h1>
            Prompt builder<span aria-hidden="true">✳</span>
          </h1>
          <p className="pb-intro-copy">
            Turn an idea into a useful prompt. The free template builder needs no account or access
            key.
          </p>
        </div>
        <button className="pb-access" type="button" onClick={showAccess} disabled={busy}>
          <Icon name="lock" />
          <span>{unlocked ? 'Private AI unlocked' : 'Private AI access'}</span>
        </button>
      </div>
    </>
  );
}
