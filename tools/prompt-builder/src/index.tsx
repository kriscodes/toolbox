import { createRoot } from 'react-dom/client';
import { PromptBuilder } from './prompt-builder';
import './styles.css';

/** Mount the independent tool inside the Toolbox shell and return its cleanup function. */
export function mountPromptBuilder(element: HTMLElement): () => void {
  const root = createRoot(element);
  root.render(<PromptBuilder />);
  /** Release React subscriptions when the shell navigates away from this tool. */
  function unmountPromptBuilder(): void { root.unmount(); }
  return unmountPromptBuilder;
}
