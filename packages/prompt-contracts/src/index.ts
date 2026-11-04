/** The deliberately small model catalog is shared by the selector and server allowlist. */
export const MODELS = [
  { id: 'gpt-6-luna', name: 'GPT-6 Luna', label: 'Quick', description: 'A fast option for everyday prompts.' },
  { id: 'gpt-5.4-mini-2026-03-17', name: 'GPT-5.4 mini', label: 'Mini', description: 'A compact alternative for your ideas.' },
] as const;

export type ModelId = typeof MODELS[number]['id'];
// Keep the default independent of how the selector catalog is ordered.
export const DEFAULT_MODEL_ID: ModelId = 'gpt-6-luna';
export const TASKS = ['build', 'debug', 'write', 'research', 'plan'] as const;
export const TONES = ['clear', 'friendly', 'direct'] as const;
export const FORMATS = ['structured', 'concise', 'checklist'] as const;
export const MAX_IDEA_LENGTH = 6000;
export const MAX_CONTEXT_LENGTH = 12000;
export const MAX_PROMPT_LENGTH = 24000;

export interface GenerationRequest {
  modelId: ModelId;
  idea: string;
  context: string;
  task: typeof TASKS[number];
  tone: typeof TONES[number];
  format: typeof FORMATS[number];
}

export interface GenerationResponse {
  prompt: string;
  modelId: ModelId;
}

export interface ApiErrorResponse {
  error: { code: string; message: string };
}

/** Identifies invalid user input without exposing implementation or provider details. */
export class ValidationError extends Error {
  /** Preserve a readable, safe validation message for the client. */
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Accept only a member of a known list, preventing arbitrary model IDs and options. */
function readChoice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) {
    throw new ValidationError(`Choose a supported ${label}.`);
  }
  return value as T;
}

/** Trim text while bounding its original length so whitespace cannot bypass limits. */
function readText(value: unknown, label: string, maximum: number, required: boolean): string {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) {
    throw new ValidationError(`${label} ${required ? 'is required and ' : ''}must be at most ${maximum.toLocaleString('en-US')} characters.`);
  }
  return value.trim();
}

/** Turn untrusted JSON into the exact request shape accepted by prompt generation. */
export function parseGenerationRequest(value: unknown): GenerationRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('Send a prompt idea and its options.');
  }
  const input = value as Record<string, unknown>;
  // Extract model IDs from the same catalog used to render the selector.
  const modelIds = MODELS.map(model => model.id);
  return {
    modelId: readChoice(input.modelId, modelIds, 'model'),
    idea: readText(input.idea, 'Your idea', MAX_IDEA_LENGTH, true),
    context: readText(input.context, 'Project context', MAX_CONTEXT_LENGTH, false),
    task: readChoice(input.task, TASKS, 'task'),
    tone: readChoice(input.tone, TONES, 'tone'),
    format: readChoice(input.format, FORMATS, 'format'),
  };
}
