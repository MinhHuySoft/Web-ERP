// @ts-check
import { applySettings } from './core/settings.js';
import { initPwa } from './core/pwa.js';
import { Shell } from './shell/shell.js';

applySettings();
initPwa();
const root = document.getElementById('erp-app');
if (root) {
  const shell = new Shell(root);
  /** @type {any} */ (window).ErpApp = shell;
  shell.start();
}
