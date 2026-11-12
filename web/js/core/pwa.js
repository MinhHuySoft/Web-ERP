// @ts-check
/**
 * PWA: cài FE thành ứng dụng trên điện thoại / máy tính.
 * - Đăng ký service worker (sw.js — chỉ giữ vỏ tĩnh của FE, không giữ dữ liệu nghiệp vụ).
 * - Nút "Cài ứng dụng": Chrome / Edge / Android dùng hộp cài của trình duyệt; iPhone / iPad chỉ cài được bằng
 *   Chia sẻ → Thêm vào MH chính nên hiện hướng dẫn.
 * - Màu thanh trạng thái điện thoại (meta theme-color) theo theme đang dùng.
 * Cài được khi trang chạy qua HTTPS (hoặc localhost khi phát triển).
 */
import { onSettings } from './settings.js';
import { messageBox, toast } from './ui.js';

const cfg = /** @type {any} */ (window).ERP_CONFIG || {};

/** Sự kiện beforeinstallprompt giữ lại để mở hộp cài khi người dùng bấm. @type {any} */
let deferred = null;
/** @type {Set<() => void>} */
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function initPwa() {
  syncThemeColor();
  onSettings(() => syncThemeColor());
  const title = /** @type {HTMLMetaElement|null} */ (document.querySelector('meta[name="apple-mobile-web-app-title"]'));
  if (title && cfg.appName) title.content = cfg.appName;

  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  addEventListener('appinstalled', () => { deferred = null; notify(); toast('Đã cài ứng dụng. Mở từ màn hình chính.', 'success'); });

  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  navigator.serviceWorker.register('sw.js', { scope: './' })
    .catch((err) => console.warn('Không đăng ký được service worker:', err));
  // CSS/JS tải lúc mở đầu chưa qua service worker ⇒ gửi danh sách để nó giữ sẵn (mở lại khi mất mạng vẫn có vỏ).
  navigator.serviceWorker.ready.then((reg) => {
    const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
    reg.active?.postMessage({ type: 'warm', urls: [location.href, ...urls] });
  }).catch(() => undefined);
}

/** Đang chạy như ứng dụng đã cài (cửa sổ riêng, không thanh địa chỉ)? */
export function isInstalled() {
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => matchMedia(`(display-mode: ${m})`).matches)
    || /** @type {any} */ (navigator).standalone === true;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Có cách cài từ trang này không: 'prompt' (hộp cài của trình duyệt) | 'ios' (hướng dẫn) | '' (không). */
export function installMode() {
  if (isInstalled()) return '';
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : '';
}

/** Theo dõi khi khả năng cài thay đổi. @param {() => void} fn @returns {() => void} hủy theo dõi */
export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function install() {
  if (deferred) {
    const e = deferred;
    deferred = null;
    await e.prompt();
    const choice = await e.userChoice.catch(() => null);
    notify();
    if (choice?.outcome === 'dismissed') toast('Chưa cài. Lần mở sau có thể cài từ menu tài khoản.', 'info');
    return;
  }
  if (isIos()) {
    messageBox([
      { type: 'info', text: 'Mở trang này bằng Safari (hoặc Chrome / Edge trên iOS 16.4 trở lên).' },
      { type: 'info', text: 'Bấm nút Chia sẻ (ô vuông có mũi tên lên) ở thanh dưới hoặc thanh trên.' },
      { type: 'info', text: 'Chọn "Thêm vào MH chính" (Add to Home Screen), rồi bấm Thêm.' },
      { type: 'info', text: 'Mở ứng dụng từ biểu tượng trên màn hình chính.' },
    ], 'Cài lên iPhone / iPad');
  }
}

/** Màu thanh trạng thái = màu thanh tiêu đề của theme (gradient thì lấy màu chủ đạo). */
function syncThemeColor() {
  let meta = /** @type {HTMLMetaElement|null} */ (document.querySelector('meta[name="theme-color"]'));
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
  const cs = getComputedStyle(document.documentElement);
  for (const v of ['--erp-chrome-bg', '--erp-primary', '--erp-accent']) {
    const hex = toHex(cs.getPropertyValue(v).trim());
    if (hex) { meta.content = hex; return; }
  }
}

/** Màu CSS bất kỳ (kể cả color-mix…) → #rrggbb; không phải màu đặc thì trả ''. @param {string} value */
function toHex(value) {
  if (!value || !CSS.supports('color', value)) return '';
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return '';
  g.fillStyle = value;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
  if (a < 255) return '';
  return '#' + [r, gr, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
