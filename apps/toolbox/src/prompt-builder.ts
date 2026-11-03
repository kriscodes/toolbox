import { mountPromptBuilder } from '@toolbox/prompt-builder';
import './tool-shell.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
mountPromptBuilder(root);
