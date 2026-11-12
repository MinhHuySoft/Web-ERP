// @ts-check
/// <reference lib="webworker" />
/**
 * Service worker của FE (PWA): giữ một bản sao VỎ TĨNH của FE (HTML/CSS/JS/icon, config.js) để app mở được ngay và
 * vẫn hiện được khi mạng chập chờn hoặc BE đang cập nhật. KHÔNG BAO GIỜ giữ dữ liệu nghiệp vụ: HTML của BE, POST,
 * mock, công cụ và mọi origin khác đi thẳng mạng như khi không có service worker.
 *
 * Cách lấy: mạng trước (bắt kiểm lại với máy chủ — ETag → 304), lỗi mạng / BE trả lỗi thì dùng bản đã giữ.
 * Nhờ vậy sau mỗi lần triển khai người dùng nhận bản FE mới ngay, không bị trộn module cũ và mới.
 *
 * Không có bước build: đổi danh sách SHELL hoặc cách xử lý dưới đây thì tăng VERSION.
 */
const VERSION = 'erp-fe-v1';
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const scope = new URL(sw.registration.scope);

/** Tải sẵn khi cài. Các tệp CSS/JS còn lại do trang gửi danh sách sau lần mở đầu (thông điệp 'warm'). */
const SHELL = ['./', 'config.js', 'manifest.webmanifest', 'assets/favicon.svg',
  'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'];
/** Tệp ở gốc FE và thư mục con của FE được giữ. Ngoài danh sách này service worker không đụng tới. */
const ROOT_FILES = new Set(['', 'index.html', 'config.js', 'manifest.webmanifest']);
const DIRS = ['css/', 'js/', 'assets/'];

/** @param {URL} url */
function isShell(url) {
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return false;
  const p = url.pathname.slice(scope.pathname.length);
  if (p.startsWith('js/tools/')) return false; // validator, chỉ dùng khi phát triển
  return ROOT_FILES.has(p) || DIRS.some((d) => p.startsWith(d));
}

/**
 * Tải một tệp vỏ và giữ lại nếu thành công. Khi trả cho trang, việc ghi vào cache chạy nền (keep = e.waitUntil) để
 * trang không phải chờ.
 * @param {Cache} cache @param {string} href @param {(p: Promise<void>) => unknown} [keep]
 */
async function refresh(cache, href, keep = (p) => p) {
  const res = await fetch(href, { cache: 'no-cache', credentials: 'same-origin' });
  if (res.ok && res.type === 'basic') await keep(cache.put(href, res.clone()));
  return res;
}

sw.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Từng tệp một: một tệp lỗi (vd BE đang bảo trì) không làm hỏng cả lần cài.
    await Promise.all(SHELL.map((p) => refresh(cache, new URL(p, scope).href).catch(() => undefined)));
    await sw.skipWaiting();
  })());
});

sw.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('erp-fe-') && key !== VERSION) await caches.delete(key);
    }
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isShell(url)) return; // không gọi respondWith ⇒ trình duyệt tự đi mạng
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const kept = () => cache.match(url.href, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? cache.match(scope.href) : undefined));
    try {
      const res = await refresh(cache, url.href, (p) => { e.waitUntil(p); });
      if (res.ok) return res;
      return (await kept()) || res; // vd 503 lúc BE đang cập nhật: dùng bản đã giữ để vỏ vẫn hiện
    } catch (err) {
      const hit = await kept();
      if (hit) return hit;
      throw err;
    }
  })());
});

/** Trang gửi danh sách tệp nó đã tải (CSS/JS lúc mở đầu, trước khi service worker nắm quyền) để giữ sẵn. */
sw.addEventListener('message', (e) => {
  const urls = e.data?.type === 'warm' && Array.isArray(e.data.urls) ? e.data.urls : null;
  if (!urls) return;
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    for (const u of urls.slice(0, 400)) {
      let url;
      try { url = new URL(String(u), scope); } catch { continue; }
      url.hash = '';
      if (!isShell(url) || await cache.match(url.href)) continue;
      try { await refresh(cache, url.href); } catch { /* bỏ qua, lần mở sau sẽ giữ */ }
    }
  })());
});
