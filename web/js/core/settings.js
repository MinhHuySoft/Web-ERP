// @ts-check
/**
 * Cài đặt người dùng (theme, mật độ, cỡ chữ, kiểu điều hướng, bố cục lưới, gần đây, yêu thích).
 * Hiện lưu ở localStorage của trình duyệt; khi backend có endpoint lưu cài đặt thì thay lớp lưu trữ ở đây.
 */

import { ensureContrast, inkOn, isHex, tones } from './color.js';

const KEY = 'erp.settings.v1';
const cfg = /** @type {any} */ (window).ERP_CONFIG || {};

/** vivid: nền gradient rực là bản sắc của theme ⇒ màu người dùng tô vào chính gradient đó thay vì thay nền.
 *  locked: theme giữ màu cố định (hỗ trợ tiếp cận), bỏ qua màu người dùng. */
export const THEMES = [
  { id: 'ribbon-classic', name: 'Ribbon cổ điển', note: 'Mặc định — giống Office/Janus', dark: false },
  { id: 'ribbon-dark', name: 'Ribbon tối', note: 'Ribbon nền tối', dark: true },
  { id: 'fluent-mica', name: 'Fluent Mica', note: 'Phong cách Windows 11', dark: false },
  { id: 'glassmorphism', name: 'Glassmorphism', note: 'Kính mờ trên nền gradient', dark: true, vivid: true },
  { id: 'glassy-aero', name: 'Glassy Aero', note: 'Kính bóng, viền sáng', dark: false },
  { id: 'neumorphism', name: 'Neumorphism', note: 'Soft UI nổi / chìm', dark: false },
  { id: 'claymorphism', name: 'Claymorphism', note: 'Khối đất sét bo tròn, pastel', dark: false },
  { id: 'aurora', name: 'Aurora', note: 'Gradient cực quang chuyển động nhẹ', dark: true, vivid: true },
  { id: 'neon-cyber', name: 'Neon Cyber', note: 'Công nghệ, viền phát sáng', dark: true },
  { id: 'material-you', name: 'Material You', note: 'Material 3, màu nhấn động', dark: false },
  { id: 'minimal-flat', name: 'Minimal Flat', note: 'Phẳng tối giản', dark: false },
  { id: 'high-contrast', name: 'Tương phản cao', note: 'Dễ đọc, hỗ trợ tiếp cận', dark: true, locked: true },
];

/** Màu chủ đạo gợi ý (đều đủ tương phản chữ trắng). */
export const ACCENT_PRESETS = [
  { id: '#1f5fbf', name: 'Xanh dương' }, { id: '#0369a1', name: 'Xanh biển' }, { id: '#0f766e', name: 'Xanh ngọc' },
  { id: '#15803d', name: 'Xanh lá' }, { id: '#4d7c0f', name: 'Xanh rêu' }, { id: '#b45309', name: 'Cam đất' },
  { id: '#b91c1c', name: 'Đỏ' }, { id: '#be185d', name: 'Hồng' }, { id: '#6d28d9', name: 'Tím' }, { id: '#334155', name: 'Xám than' },
];

/** Gradient gợi ý (mọi điểm màu đạt ≥ 4.5:1 với chữ trắng); chọn mẫu thì màu chủ đạo đổi theo `accent` của mẫu. */
export const GRADIENT_PRESETS = [
  { id: 'bien', name: 'Biển', colors: ['#075985', '#0369a1', '#0e7490'], accent: '#0369a1' },
  { id: 'rung', name: 'Rừng', colors: ['#14532d', '#15803d', '#4d7c0f'], accent: '#15803d' },
  { id: 'ngoc', name: 'Ngọc lục', colors: ['#0f766e', '#0e7490'], accent: '#0f766e' },
  { id: 'hoanghon', name: 'Hoàng hôn', colors: ['#c2410c', '#be123c'], accent: '#c2410c' },
  { id: 'hoangkim', name: 'Hoàng kim', colors: ['#a16207', '#c2410c'], accent: '#a16207' },
  { id: 'tim', name: 'Tím than', colors: ['#4c1d95', '#6d28d9', '#1d4ed8'], accent: '#6d28d9' },
  { id: 'dem', name: 'Đêm', colors: ['#0f172a', '#334155'], accent: '#334155' },
];

/** @typedef {{ theme:string, density:'compact'|'standard'|'comfortable', fontSize:number, nav:'ribbon'|'sidebar',
 *   accent:string, gradColors:string[], gradAngle:number, gradChrome:boolean, gradBg:boolean,
 *   reduceMotion:boolean, ribbonCollapsed:boolean, sidebarCollapsed:boolean, sidebarWidth:number,
 *   recordLayout:'compact'|'erp' }} Settings */

export const SIDEBAR_W = { min: 200, max: 480, def: 268 };

/** @type {Settings} */
const DEFAULTS = {
  theme: cfg.defaultTheme || 'ribbon-classic', density: 'standard', fontSize: 14, nav: cfg.defaultNav || 'ribbon', accent: '',
  gradColors: [], gradAngle: 135, gradChrome: true, gradBg: true,
  reduceMotion: false, ribbonCollapsed: false, sidebarCollapsed: false, sidebarWidth: SIDEBAR_W.def,
  // Bố cục chứng từ: 'compact' = các ô xếp nối nhau lấp đầy chiều ngang; 'erp' = giữ xuống dòng như form WinForms.
  recordLayout: 'compact',
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
  const sw = Math.max(SIDEBAR_W.min, Math.min(SIDEBAR_W.max, Number(current.sidebarWidth) || SIDEBAR_W.def));
  root.style.setProperty('--erp-sidebar-w', `${sw}px`);
  root.dataset.motion = current.reduceMotion ? 'reduce' : 'auto';
  root.dataset.recordLayout = current.recordLayout === 'erp' ? 'erp' : 'compact';
  root.style.setProperty('--erp-font-size', `${current.fontSize}px`);
  const meta = THEMES.find((t) => t.id === theme);
  root.style.colorScheme = meta?.dark ? 'dark' : 'light';
  applyColors(root, meta);
}

/** Kết quả lần áp màu gần nhất (bảng cài đặt dùng để báo người dùng). */
export const colorState = { accentAdjusted: false, chromeInkRatio: 0, locked: false };

const USER_VARS = ['--erp-accent-user', '--erp-accent-contrast-user', '--erp-tone-1', '--erp-tone-2', '--erp-tone-3',
  '--erp-user-bg', '--erp-user-chrome', '--erp-user-chrome-text', '--erp-user-chrome-muted', '--erp-user-chrome-hover'];

/**
 * Màu người dùng chọn → biến CSS. Mọi theme dẫn xuất màu nhuốm (thanh tiêu đề, dòng chọn, nút ribbon, bề mặt tông màu,
 * ánh neon…) từ --erp-primary và --erp-tone-*, nên chỉ cần đặt các biến gốc ở đây.
 * Màu luôn được chỉnh cho đủ tương phản 4.5:1 (chữ, nút) — chuẩn giao diện mục 4.
 * @param {HTMLElement} root @param {any} meta
 */
function applyColors(root, meta) {
  USER_VARS.forEach((v) => root.style.removeProperty(v));
  delete root.dataset.userBg;
  delete root.dataset.userChrome;
  Object.assign(colorState, { accentAdjusted: false, chromeInkRatio: 0, locked: !!meta?.locked });
  if (meta?.locked) return;
  const dark = !!meta?.dark;
  const grad = (current.gradColors || []).filter(isHex).slice(0, 3);
  const accentRaw = isHex(current.accent) ? current.accent : '';
  if (accentRaw) {
    const safe = ensureContrast(accentRaw, dark ? '#161a24' : '#ffffff');
    colorState.accentAdjusted = safe.adjusted;
    root.style.setProperty('--erp-accent-user', safe.color);
    root.style.setProperty('--erp-accent-contrast-user', inkOn([safe.color]).ink);
  }
  const tone = grad.length >= 2 ? [grad[0], grad[1], grad[2] || grad[0]] : accentRaw ? tones(accentRaw) : null;
  if (tone) tone.forEach((c, i) => root.style.setProperty(`--erp-tone-${i + 1}`, c));
  if (grad.length < 2) return;
  const angle = Math.round(Number(current.gradAngle) || 135);
  if (current.gradChrome) {
    const ink = inkOn(grad);
    colorState.chromeInkRatio = ink.ratio;
    root.dataset.userChrome = '';
    root.style.setProperty('--erp-user-chrome', `linear-gradient(${angle}deg, ${grad.join(', ')})`);
    root.style.setProperty('--erp-user-chrome-text', ink.ink);
    root.style.setProperty('--erp-user-chrome-muted', ink.dark ? 'rgba(11, 18, 32, .72)' : 'rgba(255, 255, 255, .8)');
    root.style.setProperty('--erp-user-chrome-hover', ink.dark ? 'rgba(11, 18, 32, .08)' : 'rgba(255, 255, 255, .16)');
  }
  // Nền: pha nhạt vào màu nền của theme để chữ đặt thẳng trên nền (tiêu đề màn hình…) vẫn đủ tương phản.
  // Theme "vivid" đã tô nền bằng --erp-tone-* nên không thay.
  if (current.gradBg && !meta?.vivid) {
    const pct = dark ? 38 : 20;
    root.dataset.userBg = '';
    root.style.setProperty('--erp-user-bg', `linear-gradient(${angle}deg, ${grad.map((c) => `color-mix(in srgb, ${c} ${pct}%, var(--erp-bg))`).join(', ')})`);
  }
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
