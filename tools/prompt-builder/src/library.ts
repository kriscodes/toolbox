import {
  DEFAULT_MODEL_ID, FORMATS, MAX_CONTEXT_LENGTH, MAX_IDEA_LENGTH, MAX_PROMPT_LENGTH,
  MODELS, TASKS, TONES, type GenerationRequest, type ModelId,
} from '@toolbox/prompt-contracts';

export const STORAGE_KEY = 'toolbox.prompt-builder.library.v1';
export const MAX_LIBRARY_BYTES = 2_000_000;
export const MAX_GROUPS = 100;
export const MAX_PROMPTS = 500;
export const MAX_NAME_LENGTH = 60;

export interface Group { id: string; name: string; context: string }

export interface Draft {
  groupId: string;
  savedId: string | null;
  name: string;
  idea: string;
  prompt: string;
  includeContext: boolean;
  modelId: ModelId;
  generatedModelId: string | null;
  task: GenerationRequest['task'];
  tone: GenerationRequest['tone'];
  format: GenerationRequest['format'];
}

export interface SavedPrompt extends Omit<Draft, 'savedId'> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Library {
  version: 1;
  groups: Group[];
  prompts: SavedPrompt[];
  draft: Draft;
}

export interface LoadedLibrary { library: Library; recovery: string | null; error: string | null }

/** Measure serialized data using the same UTF-8 bytes reported by imported backup files. */
export function serializedBytes(value: string): number { return new TextEncoder().encode(value).length; }

/** Start a blank prompt in a known group with the shared, low-latency model default. */
export function createDraft(groupId: string): Draft {
  return { groupId, savedId: null, name: '', idea: '', prompt: '', includeContext: true,
    modelId: DEFAULT_MODEL_ID, generatedModelId: null, task: 'plan', tone: 'clear', format: 'structured' };
}

/** Seed familiar groups without inventing private project context or sample saved prompts. */
export function createLibrary(): Library {
  return { version: 1, groups: [
    { id: 'toolbox', name: 'Toolbox', context: '' },
    { id: 'family-map', name: 'Family Map', context: '' },
    { id: 'home-cameras', name: 'Home Cameras', context: '' },
    { id: 'personal', name: 'Personal', context: '' },
  ], prompts: [], draft: createDraft('toolbox') };
}

/** Require a plain record before inspecting data from storage or an imported backup. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup structure.');
  return value as Record<string, unknown>;
}

/** Validate bounded strings while retaining meaningful whitespace in prompt and context text. */
function text(value: unknown, maximum: number, required = false): string {
  if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) throw new Error('Invalid or oversized text in backup.');
  return value;
}

/** Read IDs separately so an imported object cannot introduce empty references. */
function identifier(value: unknown): string {
  return text(value, 128, true);
}

/** Keep saved content compatible when a formerly supported model is removed from the catalog. */
function currentModel(value: unknown): ModelId {
  const id = text(value, 100, true);
  // The fallback changes only the next generation setting; saved prompt text stays intact.
  return MODELS.find(function findModel(model) { return model.id === id; })?.id ?? DEFAULT_MODEL_ID;
}

/** Accept only the finite task, tone, and format options supported by both app and server. */
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error('Unknown prompt option in backup.');
  return value as T;
}

/** Validate a complete draft without trusting extra fields from external JSON. */
function readDraft(value: unknown): Draft {
  const input = record(value);
  if (typeof input.includeContext !== 'boolean') throw new Error('Invalid context option in backup.');
  return {
    groupId: identifier(input.groupId),
    savedId: input.savedId === null ? null : identifier(input.savedId),
    name: text(input.name, MAX_NAME_LENGTH), idea: text(input.idea, MAX_IDEA_LENGTH),
    prompt: text(input.prompt, MAX_PROMPT_LENGTH), includeContext: input.includeContext,
    modelId: currentModel(input.modelId),
    generatedModelId: input.generatedModelId === null ? null : text(input.generatedModelId, 100, true),
    task: choice(input.task, TASKS), tone: choice(input.tone, TONES), format: choice(input.format, FORMATS),
  };
}

/** Validate an ISO timestamp used for sorting saved prompts, rejecting impossible dates. */
function timestamp(value: unknown): string {
  const date = text(value, 30, true);
  if (!Number.isFinite(Date.parse(date))) throw new Error('Invalid saved date in backup.');
  return date;
}

/** Validate the schema, references, and uniqueness of a versioned local library. */
export function parseLibrary(value: unknown): Library {
  const input = record(value);
  if (input.version !== 1) throw new Error('This backup uses an unsupported version.');
  if (!Array.isArray(input.groups) || input.groups.length < 1 || input.groups.length > MAX_GROUPS) throw new Error('A backup must have 1–100 groups.');
  if (!Array.isArray(input.prompts) || input.prompts.length > MAX_PROMPTS) throw new Error('A backup can contain up to 500 prompts.');
  // Rebuild each record from known fields rather than retaining arbitrary imported properties.
  const groups = input.groups.map(function readGroup(value): Group {
    const group = record(value);
    return { id: identifier(group.id), name: text(group.name, MAX_NAME_LENGTH, true), context: text(group.context, MAX_CONTEXT_LENGTH) };
  });
  const groupIds = new Set(groups.map(function groupId(group) { return group.id; }));
  if (groupIds.size !== groups.length) throw new Error('Duplicate group IDs in backup.');
  const prompts = input.prompts.map(function readPrompt(value): SavedPrompt {
    const prompt = record(value);
    const { savedId: _savedId, ...fields } = readDraft({ ...prompt, savedId: null });
    void _savedId;
    if (!fields.name.trim() || !fields.prompt.trim()) throw new Error('Saved prompts need a name and prompt text.');
    if (!groupIds.has(fields.groupId)) throw new Error('A saved prompt refers to a missing group.');
    return { ...fields, id: identifier(prompt.id), createdAt: timestamp(prompt.createdAt), updatedAt: timestamp(prompt.updatedAt) };
  });
  const promptIds = new Set(prompts.map(function promptId(prompt) { return prompt.id; }));
  if (promptIds.size !== prompts.length) throw new Error('Duplicate prompt IDs in backup.');
  const draft = readDraft(input.draft);
  if (!groupIds.has(draft.groupId)) throw new Error('The draft refers to a missing group.');
  if (draft.savedId !== null) {
    // A draft may only update the saved prompt belonging to its own group.
    const saved = prompts.find(function findSaved(prompt) { return prompt.id === draft.savedId; });
    if (!saved || saved.groupId !== draft.groupId) throw new Error('The draft refers to a missing saved prompt.');
  }
  return { version: 1, groups, prompts, draft };
}

/** Read storage safely and preserve unreadable content for a deliberate recovery download. */
export function loadLibrary(raw: string | null): LoadedLibrary {
  if (raw === null) return { library: createLibrary(), recovery: null, error: null };
  try {
    if (serializedBytes(raw) > MAX_LIBRARY_BYTES) throw new Error('The saved library is too large.');
    return { library: parseLibrary(JSON.parse(raw) as unknown), recovery: null, error: null };
  } catch {
    return { library: createLibrary(), recovery: raw, error: 'Your saved library could not be opened. Its original data has been kept for recovery.' };
  }
}

/** Load browser storage without crashing when privacy settings make it unavailable. */
export function readBrowserLibrary(): LoadedLibrary {
  try { return loadLibrary(localStorage.getItem(STORAGE_KEY)); }
  catch { return { library: createLibrary(), recovery: null, error: 'Browser storage is unavailable. Changes will last only for this visit; export a backup before leaving.' }; }
}

/** Enforce a bounded library before writing, leaving the prior stored value untouched on failure. */
export function serializeLibrary(library: Library): string {
  const serialized = JSON.stringify(library);
  if (serializedBytes(serialized) > MAX_LIBRARY_BYTES) throw new Error('This library is full. Export a recovery copy, then shorten the draft or remove unused prompts.');
  return serialized;
}

/** Compare all editable draft fields to determine whether replacing it would discard work. */
export function isDraftDirty(library: Library): boolean {
  const draft = library.draft;
  if (!draft.savedId) return Boolean(draft.name.trim() || draft.idea.trim() || draft.prompt.trim());
  // Exclude timestamps and IDs, which are persistence metadata rather than draft content.
  const saved = library.prompts.find(function findSaved(prompt) { return prompt.id === draft.savedId; });
  if (!saved) return true;
  const keys = ['groupId', 'name', 'idea', 'prompt', 'includeContext', 'modelId', 'generatedModelId', 'task', 'tone', 'format'] as const;
  return keys.some(function changedField(key) { return draft[key] !== saved[key]; });
}

/** Restore a saved prompt's editable fields without changing its content or current group context. */
export function draftFromPrompt(prompt: SavedPrompt): Draft {
  const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = prompt;
  void _createdAt; void _updatedAt;
  return { ...fields, savedId: id };
}

/** Add or update a group's name and reusable context, preventing ambiguous duplicate names. */
export function saveGroup(library: Library, id: string, name: string, context: string): Library {
  const cleanName = name.trim();
  text(cleanName, MAX_NAME_LENGTH, true); text(context, MAX_CONTEXT_LENGTH);
  // Names are case-insensitively unique in the visible group list.
  if (library.groups.some(function sameName(group) { return group.id !== id && group.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(); })) throw new Error('A group with that name already exists.');
  const existing = library.groups.some(function sameId(group) { return group.id === id; });
  if (!existing && library.groups.length >= MAX_GROUPS) throw new Error('You can keep up to 100 groups.');
  const group = { id, name: cleanName, context };
  const groups = existing ? library.groups.map(function replaceGroup(item) { return item.id === id ? group : item; }) : [...library.groups, group];
  const next = { ...library, groups };
  serializeLibrary(next);
  return next;
}

/** Remove a confirmed group and its prompts; at least one group always remains available. */
export function deleteGroup(library: Library, id: string): Library {
  if (library.groups.length <= 1) throw new Error('Keep at least one group in your workspace.');
  const groups = library.groups.filter(function keepGroup(group) { return group.id !== id; });
  const prompts = library.prompts.filter(function keepPrompt(prompt) { return prompt.groupId !== id; });
  return { ...library, groups, prompts, draft: library.draft.groupId === id ? createDraft(groups[0]!.id) : library.draft };
}

/** Save the current editable prompt, replacing an existing entry only when its saved ID matches. */
export function saveDraft(library: Library, id: string, now: string): Library {
  const { savedId, ...fields } = library.draft;
  if (!fields.name.trim()) throw new Error('Give this prompt a name before saving.');
  if (!fields.prompt.trim()) throw new Error('Add prompt text before saving.');
  if (!savedId && library.prompts.length >= MAX_PROMPTS) throw new Error('You can keep up to 500 saved prompts.');
  const existing = library.prompts.find(function findExisting(prompt) { return prompt.id === savedId; });
  if (savedId && !existing) throw new Error('The original saved prompt could not be found.');
  const prompt: SavedPrompt = { ...fields, name: fields.name.trim(), id: savedId ?? id, createdAt: existing?.createdAt ?? now, updatedAt: now };
  const prompts = existing ? library.prompts.map(function replacePrompt(item) { return item.id === savedId ? prompt : item; }) : [prompt, ...library.prompts];
  const next = { ...library, prompts, draft: draftFromPrompt(prompt) };
  serializeLibrary(next);
  return next;
}

/** Remove a confirmed saved prompt and reset its editor only if it is currently open. */
export function deletePrompt(library: Library, id: string): Library {
  return { ...library, prompts: library.prompts.filter(function keepPrompt(prompt) { return prompt.id !== id; }),
    draft: library.draft.savedId === id ? createDraft(library.draft.groupId) : library.draft };
}

/** Prepare only the selected context and generation options; other groups never leave the browser. */
export function generationRequest(library: Library): GenerationRequest {
  const draft = library.draft;
  const group = library.groups.find(function findGroup(group) { return group.id === draft.groupId; });
  return { modelId: draft.modelId, idea: draft.idea.trim(), context: draft.includeContext ? group?.context ?? '' : '', task: draft.task, tone: draft.tone, format: draft.format };
}

/** Import backup groups as new copies so restoring a file can never overwrite existing work. */
export function importLibrary(library: Library, imported: Library, makeId: () => string): Library {
  if (library.groups.length + imported.groups.length > MAX_GROUPS || library.prompts.length + imported.prompts.length > MAX_PROMPTS) throw new Error('This backup would exceed the library limit of 100 groups or 500 prompts.');
  const names = new Set(library.groups.map(function groupName(group) { return group.name.toLocaleLowerCase(); }));
  const ids = new Map<string, string>();
  // Unique names make the imported copies visible without altering the originals.
  const groups = imported.groups.map(function copyGroup(group): Group {
    let name = group.name;
    let suffix = 1;
    while (names.has(name.toLocaleLowerCase())) {
      const ending = ` (imported${suffix > 1 ? ` ${suffix}` : ''})`;
      name = `${group.name.slice(0, MAX_NAME_LENGTH - ending.length)}${ending}`;
      suffix += 1;
    }
    names.add(name.toLocaleLowerCase());
    const id = makeId(); ids.set(group.id, id);
    return { ...group, id, name };
  });
  const promptIds = new Map<string, string>();
  const prompts = imported.prompts.map(function copyPrompt(prompt): SavedPrompt {
    const id = makeId(); promptIds.set(prompt.id, id);
    return { ...prompt, id, groupId: ids.get(prompt.groupId)! };
  });
  // Restore unfinished work alongside remapped saved records after the UI confirms draft replacement.
  const draft = { ...imported.draft, groupId: ids.get(imported.draft.groupId)!,
    savedId: imported.draft.savedId ? promptIds.get(imported.draft.savedId)! : null };
  const merged = { ...library, groups: [...library.groups, ...groups], prompts: [...prompts, ...library.prompts], draft };
  serializeLibrary(merged);
  return merged;
}
