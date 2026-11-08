import { createIcons, ArrowUpRight, Box, FolderOpen, House, LayoutGrid, MapPin, MessageSquare, Pin, Search, X } from 'lucide';
import { DEFAULT_PINNED_IDS, filterProjects, getSafeProjectUrl, parsePinnedProjects, PINNED_STORAGE_KEY, PROJECTS, type Project, type ProjectFilter } from './catalog';
import './styles.css';

const icons = { ArrowUpRight, Box, FolderOpen, House, LayoutGrid, MapPin, MessageSquare, Pin, Search, X };
/** Produces an accessible placeholder that Lucide replaces with an SVG icon. */
const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
/** Escapes text before it is interpolated into the dashboard's HTML templates. */
const escape = (value: string) => value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);

/** Loads the user's pins without preventing the dashboard from opening when storage is unavailable. */
function readPins(): Set<string> {
  try { return parsePinnedProjects(localStorage.getItem(PINNED_STORAGE_KEY)); }
  catch { return new Set(DEFAULT_PINNED_IDS); }
}

let pinned = readPins();
let activeFilter: ProjectFilter = 'all';
let query = '';
let dialogOpener: HTMLElement | null = null;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing application root');

const navigation: { filter: ProjectFilter; label: string; icon: string; group?: boolean }[] = [
  { filter: 'all', label: 'All projects', icon: 'layout-grid' },
  { filter: 'pinned', label: 'Pinned', icon: 'pin' },
  { filter: 'AI tools', label: 'AI tools', icon: 'message-square', group: true },
  { filter: 'Family', label: 'Family', icon: 'map-pin' },
  { filter: 'Home', label: 'Home', icon: 'house' },
];

/** Renders published tools as links and planned projects as detail-dialog buttons. */
function projectCard(project: Project): string {
  const name = escape(project.name);
  const url = getSafeProjectUrl(project.url);
  const tag = url ? 'a' : 'button';
  const action = url ? `href="${escape(url)}" aria-label="Open ${name}"` : `type="button" data-open="${project.id}" aria-label="View ${name}" aria-haspopup="dialog"`;
  return `<article class="project ${project.featured ? 'project-featured' : ''}" data-project="${project.id}">
    <${tag} class="project-open" ${action}>
      <span class="project-art"><img src="${project.image}" alt="${escape(project.imageAlt)}" width="960" height="640" decoding="async" ${project.featured ? 'fetchpriority="high"' : ''} /></span>
      <span class="project-meta"><span>${project.featured ? `<span class="project-kicker">${escape(project.group)}</span>` : ''}<span class="project-title" role="heading" aria-level="2">${name}</span><span class="project-status">${project.status}</span></span><span class="project-arrow">${icon('arrow-up-right')}</span></span>
    </${tag}>
    <button type="button" class="pin-button" data-pin="${project.id}" aria-label="Pin ${name}" aria-pressed="${pinned.has(project.id)}">${icon('pin')}</button>
  </article>`;
}

app.innerHTML = `<div class="workspace">
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="Toolbox home">${icon('box')}<span>toolbox</span></a>
    <nav aria-label="Project navigation">${navigation.map((item) => `${item.group ? '<div class="nav-label">Groups</div>' : ''}<button type="button" class="nav-button" data-filter="${item.filter}" aria-pressed="${item.filter === 'all'}">${icon(item.icon)}${item.label}</button>`).join('')}</nav>
    <a class="owner" href="https://kristiansalmeron.com/" aria-label="Kristian Salmeron's website"><span class="avatar" aria-hidden="true">KS</span><span>Kristian<small>Personal workspace</small></span></a>
  </aside>
  <main id="workbench" tabindex="-1">
    <div class="main-inner">
      <header class="header"><h1>Workbench</h1><form class="search" role="search">${icon('search')}<label class="sr-only" for="project-search">Find a project</label><input id="project-search" type="search" placeholder="Find a project" autocomplete="off" spellcheck="false" /><button class="clear-search" type="button" aria-label="Clear search" hidden>${icon('x')}</button></form></header>
      <div class="projects">${PROJECTS.map(projectCard).join('')}</div>
      <section class="empty-state" hidden>${icon('folder-open')}<h2>No projects found.</h2><p>Try a different search or group.</p><button type="button" class="reset-button">Clear filters</button></section>
      <p class="sr-only" id="results-status" role="status" aria-live="polite"></p>
      <p class="sr-only" id="pin-status" role="status" aria-live="polite"></p>
    </div>
  </main>
</div>
<dialog class="project-dialog" aria-labelledby="detail-title" aria-describedby="detail-description">
  <div class="dialog-art"><img alt="" width="960" height="640" /></div>
  <button type="button" class="close-dialog" aria-label="Close project details" autofocus>${icon('x')}</button>
  <div class="dialog-body"><div class="dialog-top"><span class="dialog-group"></span><span class="dialog-status"></span></div><h2 id="detail-title"></h2><p id="detail-description"></p><a class="project-link" target="_blank" rel="noopener noreferrer" hidden>Open project ${icon('arrow-up-right')}</a></div>
</dialog>`;

const searchInput = app.querySelector<HTMLInputElement>('#project-search')!;
const clearSearch = app.querySelector<HTMLButtonElement>('.clear-search')!;
const empty = app.querySelector<HTMLElement>('.empty-state')!;
const resultsStatus = app.querySelector<HTMLElement>('#results-status')!;
const pinStatus = app.querySelector<HTMLElement>('#pin-status')!;
const dialog = app.querySelector<HTMLDialogElement>('.project-dialog')!;

/** Applies filters and pin states, announces results, and moves focus out of hidden cards. */
function updateProjects(announce = true): void {
  const focusedElement = document.activeElement;
  const visible = new Set(filterProjects(PROJECTS, activeFilter, query, pinned).map((project) => project.id));
  app!.querySelectorAll<HTMLElement>('[data-project]').forEach((card) => { card.hidden = !visible.has(card.dataset.project!); });
  app!.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)); });
  app!.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach((button) => { button.setAttribute('aria-pressed', String(pinned.has(button.dataset.pin!))); });
  clearSearch.hidden = query.length === 0;
  empty.hidden = visible.size > 0;
  const noPins = activeFilter === 'pinned' && pinned.size === 0 && !query.trim();
  empty.querySelector('h2')!.textContent = noPins ? 'Nothing pinned yet.' : 'No projects found.';
  empty.querySelector('p')!.textContent = noPins ? 'Pin a project to keep it close.' : 'Try a different search or group.';
  empty.querySelector('button')!.textContent = noPins ? 'Browse projects' : 'Clear filters';
  if (announce) resultsStatus.textContent = `${visible.size} ${visible.size === 1 ? 'project' : 'projects'} shown.`;
  if (focusedElement instanceof HTMLElement && focusedElement.closest('[hidden]')) {
    const next = app!.querySelector<HTMLButtonElement>('[data-project]:not([hidden]) .project-open')
      ?? empty.querySelector<HTMLButtonElement>('.reset-button');
    next?.focus();
  }
}

/** Toggles a known project pin and reports when browser persistence is unavailable. */
function togglePin(id: string): void {
  const project = PROJECTS.find((item) => item.id === id);
  if (!project) return;
  if (pinned.has(id)) pinned.delete(id);
  else pinned.add(id);
  let saved = true;
  try { localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...pinned])); }
  catch { saved = false; }
  updateProjects(false);
  pinStatus.textContent = `${project.name} ${pinned.has(id) ? 'pinned' : 'unpinned'}.${saved ? '' : ' Saved for this visit only.'}`;
}

/** Populates the project dialog and remembers its opener for keyboard focus restoration. */
function openProject(project: Project, opener: HTMLElement): void {
  dialogOpener = opener;
  dialog.querySelector<HTMLHeadingElement>('#detail-title')!.textContent = project.name;
  dialog.querySelector<HTMLElement>('#detail-description')!.textContent = project.description;
  dialog.querySelector<HTMLElement>('.dialog-group')!.textContent = project.group;
  dialog.querySelector<HTMLElement>('.dialog-status')!.textContent = project.status;
  const art = dialog.querySelector<HTMLImageElement>('img')!;
  art.src = project.image;
  const link = dialog.querySelector<HTMLAnchorElement>('.project-link')!;
  const url = getSafeProjectUrl(project.url);
  link.hidden = url === null;
  if (url) link.href = url;
  else link.removeAttribute('href');
  dialog.showModal();
}

// Searching updates cards in place, so form submission must not reload the page.
app.querySelector<HTMLFormElement>('.search')!.addEventListener('submit', (event) => event.preventDefault());
// Search text immediately filters the current project group.
searchInput.addEventListener('input', () => { query = searchInput.value; updateProjects(); });
// Clearing search restores all matching cards and keeps the keyboard in the search field.
clearSearch.addEventListener('click', () => { query = ''; searchInput.value = ''; updateProjects(); searchInput.focus(); });

// Delegate dashboard actions so one listener handles every project and navigation button.
app.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const filter = event.target.closest<HTMLButtonElement>('[data-filter]');
  if (filter) { activeFilter = filter.dataset.filter as ProjectFilter; updateProjects(); }
  const pin = event.target.closest<HTMLButtonElement>('[data-pin]');
  if (pin) togglePin(pin.dataset.pin!);
  const open = event.target.closest<HTMLButtonElement>('[data-open]');
  if (open) {
    const project = PROJECTS.find((item) => item.id === open.dataset.open);
    if (project) openProject(project, open);
  }
  if (event.target.closest('.reset-button')) {
    activeFilter = 'all'; query = ''; searchInput.value = ''; updateProjects(); searchInput.focus();
  }
});

// Close buttons use the native dialog lifecycle so focus restoration remains centralized.
dialog.querySelector<HTMLButtonElement>('.close-dialog')!.addEventListener('click', () => dialog.close());
// Dismiss a modal only when the click is outside its visible content bounds.
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
// Restore focus to the original card, or search if that card is no longer visible.
dialog.addEventListener('close', () => {
  if (dialogOpener?.isConnected && !dialogOpener.closest('[hidden]')) dialogOpener.focus();
  else searchInput.focus();
});

// Keep pin buttons synchronized when another tab changes or clears browser storage.
window.addEventListener('storage', (event) => {
  if (event.key !== PINNED_STORAGE_KEY && event.key !== null) return;
  pinned = parsePinnedProjects(event.newValue);
  updateProjects(false);
});

// Slash focuses search without intercepting typing or shortcuts inside form controls.
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || dialog.open) return;
  if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName))) return;
  event.preventDefault();
  searchInput.focus();
});

createIcons({ icons, attrs: { 'stroke-width': 1.65, 'aria-hidden': 'true' } });
updateProjects(false);
