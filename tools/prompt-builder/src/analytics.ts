interface StudioInsights {
  track: (event: 'tool_action', properties: { content: 'prompt-builder'; action: 'generate' }) => void;
}

declare global {
  interface Window { StudioInsights?: StudioInsights; }
}

/** Record only that a validated generation was attempted; analytics must never interrupt the tool. */
export function trackGenerationAttempt(): void {
  try {
    window.StudioInsights?.track('tool_action', { content: 'prompt-builder', action: 'generate' });
  } catch { /* Measurement is optional and must not prevent the requested generation. */ }
}
