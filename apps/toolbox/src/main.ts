import { ArrowUpRight, Plus, SunMoon, createIcons } from 'lucide';
import { initializeAppearance } from './theme';

// Decorative icons enhance the delivered HTML; the content and native details work without them.
createIcons({ icons: { ArrowUpRight, Plus, SunMoon }, attrs: { 'stroke-width': 1.5, 'aria-hidden': 'true' } });
initializeAppearance();
