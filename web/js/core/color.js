// @ts-check
/**
 * Tính toán màu cho phần tùy biến màu của người dùng: đo tương phản (WCAG), tự chỉnh đậm/nhạt cho đủ đọc,
 * chọn chữ trắng/đen trên nền màu, sinh màu phụ (xoay sắc độ) cho các theme có nền gradient.
 */

/** @param {string} hex @returns {[number, number, number]} */
export function rgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** @param {number[]} c @returns {string} */
export const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export const isHex = (/** @type {string} */ s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || '').trim());

/** Độ chói tương đối (WCAG 2.x). @param {string} h */
export function luminance(h) {
  const f = (/** @type {number} */ v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgb(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Tỉ lệ tương phản hai màu. @param {string} a @param {string} b */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Trộn màu a với b theo tỉ lệ t (0 = a, 1 = b). @param {string} a @param {string} b @param {number} t */
export function mix(a, b, t) {
  const [p, q] = [rgb(a), rgb(b)];
  return hex(p.map((v, i) => v + (q[i] - v) * t));
}

/**
 * Chỉnh màu cho đủ tương phản `min` so với nền `bg` (đậm dần về đen trên nền sáng, nhạt dần về trắng trên nền tối).
 * @param {string} color @param {string} bg @param {number} [min] @returns {{ color:string, adjusted:boolean }}
 */
export function ensureContrast(color, bg, min = 4.5) {
  if (contrast(color, bg) >= min) return { color, adjusted: false };
  const toward = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(color, toward, t);
    if (contrast(c, bg) >= min) return { color: c, adjusted: true };
  }
  return { color: toward, adjusted: true };
}

const INK_LIGHT = '#ffffff';
const INK_DARK = '#0b1220';

/** Màu chữ (trắng hoặc gần đen) đọc tốt nhất trên MỌI màu trong danh sách. @param {string[]} colors */
export function inkOn(colors) {
  const worst = (/** @type {string} */ ink) => Math.min(...colors.map((c) => contrast(ink, c)));
  const light = worst(INK_LIGHT), dark = worst(INK_DARK);
  return light >= dark ? { ink: INK_LIGHT, ratio: light, dark: false } : { ink: INK_DARK, ratio: dark, dark: true };
}

/** @param {string} h @returns {[number, number, number]} h(0–360) s l (0–1) */
function hsl(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}

/** @param {number} h @param {number} s @param {number} l */
function fromHsl(h, s, l) {
  const k = (/** @type {number} */ n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (/** @type {number} */ n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Bộ 3 màu cùng họ (màu gốc + hai màu xoay sắc độ) để tô nền các theme gradient. @param {string} base */
export function tones(base) {
  const [h, s, l] = hsl(base);
  const ss = Math.max(s, 0.55), ll = Math.min(Math.max(l, 0.42), 0.6);
  return [fromHsl(h, ss, ll), fromHsl((h + 42) % 360, ss, ll), fromHsl((h + 300) % 360, ss, ll)];
}
