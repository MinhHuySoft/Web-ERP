// @ts-check
import { applySettings } from './core/settings.js';
import { Shell } from './shell/shell.js';

applySettings();
const root = document.getElementById('erp-app');
if (root) {
  const shell = new Shell(root);
  /** @type {any} */ (window).ErpApp = shell;
  shell.start();
}
