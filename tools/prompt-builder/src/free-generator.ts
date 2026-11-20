import { parseGenerationRequest, type GenerationRequest } from '@toolbox/prompt-contracts';

const TASK_LABELS: Record<GenerationRequest['task'], string> = {
  build: 'building',
  debug: 'debugging',
  write: 'writing',
  research: 'research',
  plan: 'planning',
};
const TONE_GUIDANCE: Record<GenerationRequest['tone'], string> = {
  clear: 'Use clear, plain language.',
  friendly: 'Use a warm, approachable tone.',
  direct: 'Be direct and get to the point.',
};
const SCOPE_GUIDANCE =
  'Preserve the requested scope, order, and constraints. Use the task category and project context only as background; do not add work they suggest. If an essential detail is missing, ask a focused question. State any limits on what you can complete or verify.';

/** Assemble a ready-to-copy prompt locally without rewriting the idea or calling a provider. */
export function buildFreePrompt(value: GenerationRequest): string {
  const input = parseGenerationRequest(value);
  const category = `Task category: ${TASK_LABELS[input.task]}.`;
  const tone = TONE_GUIDANCE[input.tone];
  if (input.format === 'concise') {
    return `${input.idea}${input.context ? `\n\nProject context: ${input.context}` : ''}\n\n${category} ${tone} ${SCOPE_GUIDANCE} Keep the response concise while retaining the requested deliverables.`;
  }
  if (input.format === 'checklist') {
    return `Complete the following request:\n\n${input.idea}${input.context ? `\n\nProject context:\n${input.context}` : ''}\n\nResponse checklist:\n- [ ] ${category} ${SCOPE_GUIDANCE}\n- [ ] ${tone}\n- [ ] Organize the requested deliverables as an actionable checklist where useful.`;
  }
  return `## Request\n${input.idea}${input.context ? `\n\n## Project context\n${input.context}` : ''}\n\n## Response guidance\n${category}\n${tone}\n${SCOPE_GUIDANCE}\nUse brief sections where useful, and make the requested deliverables easy to find.`;
}
