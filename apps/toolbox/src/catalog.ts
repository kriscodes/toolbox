export type ProjectGroup = 'AI tools' | 'Family' | 'Home';
export type ProjectFilter = 'all' | 'pinned' | ProjectGroup;

export interface Project {
  id: string;
  name: string;
  group: ProjectGroup;
  status: 'In design' | 'In progress' | 'Long term' | 'Ready';
  description: string;
  image: string;
  imageAlt: string;
  keywords: readonly string[];
  featured?: boolean;
  /** Set when the project has a usable, published destination. */
  url?: string;
}

export const PROJECT_GROUPS: readonly ProjectGroup[] = ['AI tools', 'Family', 'Home'];

export const PROJECTS: readonly Project[] = [
  {
    id: 'prompt',
    name: 'Prompt Builder',
    group: 'AI tools',
    status: 'Ready',
    description: 'Create, organize, and reuse prompts for ChatGPT. Saved project context keeps the important details close.',
    image: '/artwork/prompt-builder.webp',
    imageAlt: 'Pencil sketch of note cards, a chat bubble, and a pencil',
    keywords: ['AI', 'ChatGPT', 'writing', 'prompts'],
    featured: true,
    url: '/tools/prompt-builder/',
  },
  {
    id: 'family',
    name: 'Family Map',
    group: 'Family',
    status: 'In progress',
    description: 'A personal family-location app, inspired by Life360.',
    image: '/artwork/family-map.webp',
    imageAlt: 'Pencil sketch of a phone and a folded map with location pins',
    keywords: ['Life360', 'location', 'map', 'family'],
  },
  {
    id: 'cameras',
    name: 'Home Cameras',
    group: 'Home',
    status: 'Long term',
    description: 'A home-camera system built around a NAS, with room to choose compatible cameras as the project develops.',
    image: '/artwork/home-cameras.webp',
    imageAlt: 'Pencil sketch of a security camera connected to a NAS',
    keywords: ['NAS', 'Ring', 'security', 'cameras', 'home'],
  },
];

export const PINNED_STORAGE_KEY = 'toolbox.pinned-projects.v1';
export const DEFAULT_PINNED_IDS: readonly string[] = ['prompt'];

/** Matches every search term while applying the selected group or pinned filter. */
export function filterProjects(
  projects: readonly Project[],
  filter: ProjectFilter,
  query: string,
  pinned: ReadonlySet<string>,
): Project[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return projects.filter((project) => {
    const inGroup = filter === 'all'
      || (filter === 'pinned' ? pinned.has(project.id) : project.group === filter);
    const searchable = [project.name, project.group, project.status, ...project.keywords]
      .join(' ').toLocaleLowerCase();
    return inGroup && terms.every((term) => searchable.includes(term));
  });
}

/** Restores known project IDs and recovers safely from damaged or outdated browser storage. */
export function parsePinnedProjects(value: string | null): Set<string> {
  /** Creates a fresh default set so toggling a pin cannot change the defaults. */
  const fallback = () => new Set(DEFAULT_PINNED_IDS);
  if (value === null) return fallback();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallback();
    const known = new Set(PROJECTS.map((project) => project.id));
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)));
  } catch {
    return fallback();
  }
}

/** Allows known built-in tool routes and credential-free HTTPS destinations only. */
export function getSafeProjectUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (value === '/tools/prompt-builder/') return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
