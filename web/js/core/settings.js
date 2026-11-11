// @ts-check
/**
 * Cài đặt người dùng (theme, mật độ, cỡ chữ, kiểu điều hướng, bố cục lưới, gần đây, yêu thích).
 * Hiện lưu ở localStorage của trình duyệt; khi backend có endpoint lưu cài đặt thì thay lớp lưu trữ ở đây.
 */

const KEY = 'erp.settings.v1';
const cfg = /** @type {any} */ (window).ERP_CONFIG || {};

export const THEMES = [
  { id: 'ribbon-classic', name: 'Ribbon cổ điển', note: 'Mặc định — giống Office/Janus', dark: false },
  { id: 'ribbon-dark', name: 'Ribbon tối', note: 'Ribbon nền tối', dark: true },
  { id: 'fluent-mica', name: 'Fluent Mica', note: 'Phong cách Windows 11', dark: false },
  { id: 'glassmorphism', name: 'Glassmorphism', note: 'Kính mờ trên nền gradient', dark: true },
  { id: 'glassy-aero', name: 'Glassy Aero', note: 'Kính bóng, viền sáng', dark: false },
  { id: 'neumorphism', name: 'Neumorphism', note: 'Soft UI nổi / chìm', dark: false },
  { id: 'claymorphism', name: 'Claymorphism', note: 'Khối đất sét bo tròn, pastel', dark: false },
  { id: 'aurora', name: 'Aurora', note: 'Gradient cực quang chuyển động nhẹ', dark: true },
  { id: 'neon-cyber', name: 'Neon Cyber', note: 'Công nghệ, viền phát sáng', dark: true },
  { id: 'material-you', name: 'Material You', note: 'Material 3, màu nhấn động', dark: false },
  { id: 'minimal-flat', name: 'Minimal Flat', note: 'Phẳng tối giản', dark: false },
  { id: 'high-contrast', name: 'Tương phản cao', note: 'Dễ đọc, hỗ trợ tiếp cận', dark: true },
];

/** @typedef {{ theme:string, density:'compact'|'standard'|'comfortable', fontSize:number, nav:'ribbon'|'sidebar',
 *   accent:string, reduceMotion:boolean, ribbonCollapsed:boolean, sidebarCollapsed:boolean }} Settings */

/** @type {Settings} */
const DEFAULTS = {
  theme: cfg.defaultTheme || 'ribbon-classic', density: 'standard', fontSize: 14, nav: cfg.defaultNav || 'ribbon', accent: '',
  reduceMotion: false, ribbonCollapsed: false, sidebarCollapsed: false,
};

/** @param {string} key */
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
/** @param {string} key @param {any} value */
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* chế độ riêng tư / bị chặn: bỏ qua */ }
}

/** @type {Settings} */
let current = { ...DEFAULTS, ...(read(KEY) || {}) };
/** @type {Set<(s:Settings)=>void>} */
const listeners = new Set();

export const getSettings = () => current;

/** @param {Partial<Settings>} patch */
export function setSettings(patch) {
  current = { ...current, ...patch };
  store(KEY, current);
  applySettings();
  listeners.forEach((fn) => fn(current));
}

/** @param {(s:Settings)=>void} fn */
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function applySettings() {
  const root = document.documentElement;
  const theme = THEMES.some((t) => t.id === current.theme) ? current.theme : DEFAULTS.theme;
  root.dataset.theme = theme;
  root.dataset.density = current.density;
  root.dataset.nav = current.nav;
  root.dataset.sidebar = current.sidebarCollapsed ? 'rail' : 'full';
  root.dataset.motion = current.reduceMotion ? 'reduce' : 'auto';
  root.style.setProperty('--erp-font-size', `${current.fontSize}px`);
  if (current.accent) root.style.setProperty('--erp-accent-user', current.accent);
  else root.style.removeProperty('--erp-accent-user');
  const meta = THEMES.find((t) => t.id === theme);
  root.style.colorScheme = meta?.dark ? 'dark' : 'light';
}

/* ---- Bố cục lưới theo người dùng (thay cho file Layout\<DB>\<Form>.dat của WinForms) ---- */
/** @param {string} key */
export const getGridLayout = (key) => read(`erp.grid.${key}`);
/** @param {string} key @param {any} layout */
export const saveGridLayout = (key, layout) => store(`erp.grid.${key}`, layout);
/** @param {string} key */
export const clearGridLayout = (key) => { try { localStorage.removeItem(`erp.grid.${key}`); } catch { /* */ } };

/* ---- Gần đây / Yêu thích ---- */
/** @typedef {{ url:string, title:string, screenId?:string, at?:number }} NavEntry */
/** @returns {NavEntry[]} */
export const getRecent = () => read('erp.recent') || [];
/** @param {NavEntry} entry */
export function pushRecent(entry) {
  const list = getRecent().filter((x) => x.url !== entry.url);
  list.unshift({ ...entry, at: Date.now() });
  store('erp.recent', list.slice(0, 20));
}
/** @returns {NavEntry[]} */
export const getFavorites = () => read('erp.favorites') || [];
/** @param {NavEntry} entry */
export function toggleFavorite(entry) {
  const list = getFavorites();
  const i = list.findIndex((x) => x.url === entry.url);
  if (i >= 0) list.splice(i, 1); else list.push(entry);
  store('erp.favorites', list);
  return i < 0;
}
/** @param {string} url */
export const isFavorite = (url) => getFavorites().some((x) => x.url === url);
