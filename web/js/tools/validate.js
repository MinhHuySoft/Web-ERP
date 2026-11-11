// @ts-check
/**
 * Bộ kiểm tra tuân thủ chuẩn ERP-HTML v1.0 (mục 19 của docs/kien-truc/02-chuan-html-erp.md).
 * Mỗi lỗi: level error (vi phạm PHẢI) / warning (vi phạm NÊN).
 */

/** @typedef {{ level:'error'|'warning', rule:string, msg:string, where:string }} Issue */

const ROLES = new Set(['login', 'session', 'menu', 'menu-group', 'menu-item', 'screen', 'toolbar', 'filter', 'record', 'tab', 'field', 'grid',
  'row-template', 'pager', 'tabs', 'tab-panel', 'messages', 'message', 'confirm', 'dialog', 'lookup-result', 'status', 'attachments',
  'report-result', 'lookup-text', 'hint', 'error', 'kpi', 'chart', 'options']);
const FORM_TYPES = ['LIST', 'LISTEDIT', 'EDIT', 'REPORT', 'DASHBOARD', 'CUSTOM'];
const MODES = ['view', 'new', 'edit', 'find'];
const CONTROLS = ['text', 'textarea', 'password', 'number', 'money', 'quantity', 'percent', 'date', 'datetime', 'select', 'multiselect',
  'lookup', 'checkbox', 'radio', 'color', 'label', 'html', 'button', 'file', 'search'];
const COL_TYPES = ['text', 'number', 'money', 'quantity', 'percent', 'date', 'datetime', 'bool', 'link', 'status', 'image'];
const MSG_TYPES = ['error', 'warning', 'info', 'success'];

/** @param {Element} el */
function where(el) {
  const s = el.outerHTML.replace(/\s+/g, ' ');
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

/** @param {Document} doc @returns {Issue[]} */
export function validate(doc) {
  /** @type {Issue[]} */ const out = [];
  const add = (/** @type {Issue['level']} */ level, /** @type {string} */ rule, /** @type {string} */ msg, /** @type {Element} */ el) => out.push({ level, rule, msg, where: where(el) });

  // 2.2 Không gửi trình bày
  doc.querySelectorAll('script').forEach((el) => add('error', '2.2', 'Không được gửi <script>.', el));
  doc.querySelectorAll('style, link[rel~="stylesheet"]').forEach((el) => add('error', '2.2', 'Không được gửi CSS (<style>/<link rel=stylesheet>).', el));
  doc.querySelectorAll('[style]').forEach((el) => add('error', '2.2', 'Không được dùng thuộc tính style.', el));
  doc.querySelectorAll('[class]').forEach((el) => add('warning', '2.2', 'Không nên dùng class (FE sẽ bỏ).', el));
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) if (a.name.toLowerCase().startsWith('on')) add('error', '2.2', `Không được dùng thuộc tính sự kiện ${a.name}.`, el);
    for (const n of ['href', 'action', 'formaction', 'src']) if (/^\s*javascript:/i.test(el.getAttribute(n) || '')) add('error', '18', `URL javascript: trong ${n}.`, el);
  });
  doc.querySelectorAll('[data-erp]').forEach((el) => { const r = el.getAttribute('data-erp') || ''; if (!ROLES.has(r)) add('warning', '4', `Vai trò data-erp="${r}" không có trong chuẩn.`, el); });

  // 6 Màn hình
  doc.querySelectorAll('[data-erp="screen"]').forEach((s) => {
    if (s.tagName !== 'SECTION') add('warning', '6', 'screen nên là <section>.', s);
    if (!s.getAttribute('data-screen-id')) add('error', '6', 'screen thiếu data-screen-id (FormName).', s);
    const ft = s.getAttribute('data-form-type') || '';
    if (!FORM_TYPES.includes(ft)) add('error', '6', `data-form-type "${ft}" không hợp lệ (${FORM_TYPES.join('/')}).`, s);
    const md = s.getAttribute('data-mode') || '';
    if (!MODES.includes(md)) add('error', '6', `data-mode "${md}" không hợp lệ (${MODES.join('/')}).`, s);
    if (!s.getAttribute('data-screen-key')) add('error', '6', 'screen thiếu data-screen-key.', s);
    if (!s.querySelector(':scope > h1')) add('error', '6', 'screen thiếu <h1> tiêu đề.', s);
  });

  // 7 Toolbar
  doc.querySelectorAll('[data-erp="toolbar"]').forEach((m) => {
    if (m.tagName !== 'MENU') add('warning', '7', 'toolbar nên là <menu>.', m);
    m.querySelectorAll('a, button').forEach((b) => {
      if (!b.getAttribute('data-action')) add('warning', '7', 'Nút toolbar thiếu data-action.', b);
      if (b.tagName === 'BUTTON' && (b.getAttribute('type') || 'submit') === 'submit' && !b.getAttribute('form') && !b.closest('form')) add('error', '7', 'Nút submit không gắn với form nào (thiếu thuộc tính form).', b);
    });
  });

  // 9.2 Ô nhập
  doc.querySelectorAll('[data-erp="field"]').forEach((f) => {
    const ctl = f.getAttribute('data-control') || 'text';
    if (!CONTROLS.includes(ctl)) add('error', '9.2', `data-control "${ctl}" không hợp lệ.`, f);
    const span = Number(f.getAttribute('data-span') || 10);
    if (!(span >= 1 && span <= 40)) add('error', '9.2', 'data-span phải từ 1 đến 40.', f);
    if (ctl === 'button' || ctl === 'radio') return;
    const label = f.querySelector(':scope > label');
    const control = f.querySelector('input:not([type=hidden]), select, textarea, output');
    if (!label) add('error', '9.2', 'field thiếu <label>.', f);
    else if (control && control.tagName !== 'OUTPUT' && label.getAttribute('for') !== control.id) add('error', '9.2', 'label[for] không trỏ đúng id của control.', f);
    if (!control) add('error', '9.2', 'field không có control (input/select/textarea/output).', f);
    if (['number', 'money', 'quantity', 'percent'].includes(ctl)) {
      const v = control?.getAttribute('value') || '';
      if (v && !/^-?\d+(\.\d+)?$/.test(v)) add('error', '2.5', `Giá trị số phải dạng bất biến (vd 1234.5), đang là "${v}".`, f);
    }
    if (ctl === 'date') {
      const v = control?.getAttribute('value') || '';
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) add('error', '2.5', `Ngày phải dạng ISO yyyy-MM-dd, đang là "${v}".`, f);
    }
    if (ctl === 'lookup' && !control?.getAttribute('data-lookup-src')) add('error', '10', 'Ô lookup thiếu data-lookup-src.', f);
  });

  // 9 Record + 3.3 CSRF
  doc.querySelectorAll('form').forEach((f) => {
    if ((f.getAttribute('method') || 'get').toLowerCase() === 'post' && !f.querySelector('input[type=hidden][name*="Token" i], input[type=hidden][name*="csrf" i]')) add('error', '3.3', 'Form POST thiếu input chống giả mạo (CSRF).', f);
  });
  doc.querySelectorAll('form[data-erp="record"]').forEach((f) => {
    if (!f.id) add('error', '9', 'record thiếu id.', f);
    const mode = f.closest('[data-erp="screen"]')?.getAttribute('data-mode');
    if (mode === 'edit' && !f.querySelector('input[name="__version"]')) add('warning', '9', 'record ở chế độ edit nên có __version để phát hiện xung đột.', f);
  });

  // 11 Lưới
  doc.querySelectorAll('table[data-erp="grid"]').forEach((t) => {
    const ths = Array.from(t.querySelectorAll('thead tr:last-child th'));
    if (!ths.length) add('error', '11', 'grid thiếu thead/th.', t);
    ths.forEach((th) => {
      if (!th.getAttribute('data-field')) add('error', '11.2', 'th thiếu data-field.', th);
      const ty = th.getAttribute('data-type');
      if (ty && !COL_TYPES.includes(ty)) add('error', '11.2', `data-type "${ty}" không hợp lệ.`, th);
    });
    const hasKey = !!t.getAttribute('data-key-field');
    t.querySelectorAll('tbody tr').forEach((tr, i) => {
      if (hasKey && !tr.hasAttribute('data-key')) add('error', '11.3', `Dòng ${i + 1} thiếu data-key.`, tr);
      if (tr.children.length !== ths.length) add('error', '11.3', `Dòng ${i + 1} có ${tr.children.length} ô, khác số cột (${ths.length}).`, tr);
      Array.from(tr.children).forEach((td, j) => {
        const ty = ths[j]?.getAttribute('data-type') || '';
        const v = td.getAttribute('data-value');
        if (['number', 'money', 'quantity', 'percent'].includes(ty) && v !== null && v !== '' && !/^-?\d+(\.\d+)?$/.test(v)) add('error', '2.5', `Ô số (dòng ${i + 1}, cột ${j + 1}) data-value không bất biến: "${v}".`, td);
        if (ty === 'date' && v && !/^\d{4}-\d{2}-\d{2}/.test(v)) add('error', '2.5', `Ô ngày (dòng ${i + 1}) data-value không phải ISO: "${v}".`, td);
      });
    });
    if (t.hasAttribute('data-editable') && t.getAttribute('data-form') && !doc.getElementById(t.getAttribute('data-form') || '')) add('warning', '11.1', 'data-form trỏ tới form không có trong tài liệu.', t);
  });

  // 13 Thông điệp
  doc.querySelectorAll('[data-erp="message"]').forEach((p) => {
    const ty = p.getAttribute('data-msg-type');
    if (!ty && !p.getAttribute('data-legacy-type')) add('warning', '13.1', 'message thiếu data-msg-type.', p);
    if (ty && !MSG_TYPES.includes(ty)) add('error', '13.1', `data-msg-type "${ty}" không hợp lệ.`, p);
  });
  doc.querySelectorAll('form[data-erp="confirm"]').forEach((f) => {
    if (!f.querySelector('input[name="__confirm"]')) add('error', '13.2', 'confirm thiếu input __confirm.', f);
    if (f.querySelectorAll('button[name="__answer"]').length < 2) add('error', '13.2', 'confirm cần 2 nút name="__answer" (yes/no).', f);
  });

  // 5.3 Menu
  doc.querySelectorAll('[data-erp="menu-item"]').forEach((li) => {
    if (!li.querySelector(':scope > a[href]')) add('error', '5.3', 'menu-item thiếu <a href>.', li);
    if (!li.getAttribute('data-menu-id')) add('warning', '5.3', 'menu-item thiếu data-menu-id.', li);
  });
  if (!doc.querySelector('[data-erp]')) out.push({ level: 'error', rule: '4', msg: 'Không tìm thấy vai trò data-erp nào trong tài liệu.', where: '' });
  return out;
}

/* ---------------- Giao diện trang kiểm tra ---------------- */
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {string} html */
function run(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const issues = validate(doc);
  const e = issues.filter((i) => i.level === 'error').length, w = issues.length - e;
  $('result').hidden = false;
  $('summary').innerHTML = `<span class="${e ? 'v-err' : 'v-ok'}">${e} lỗi</span><span class="${w ? 'v-warn' : 'v-ok'}">${w} cảnh báo</span>`
    + (issues.length ? '' : '<span class="v-ok">Đạt chuẩn ERP-HTML v1.0</span>');
  const list = $('issues');
  list.replaceChildren(...issues.map((i) => {
    const li = document.createElement('li');
    li.dataset.level = i.level;
    li.innerHTML = `<strong>[${i.level === 'error' ? 'Lỗi' : 'Cảnh báo'} · mục ${i.rule}]</strong> <span></span><code></code>`;
    /** @type {HTMLElement} */ (li.querySelector('span')).textContent = i.msg;
    /** @type {HTMLElement} */ (li.querySelector('code')).textContent = i.where;
    return li;
  }));
}

if (document.getElementById('check')) initPage();

function initPage() {
$('check').addEventListener('click', () => run(/** @type {HTMLTextAreaElement} */ ($('src')).value));
$('fetch').addEventListener('click', async () => {
  const url = /** @type {HTMLInputElement} */ ($('url')).value.trim();
  if (!url) return;
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html', 'X-ERP-Request': 'fragment', 'X-ERP-Contract': '1.0' }, credentials: 'include' });
    const text = await res.text();
    /** @type {HTMLTextAreaElement} */ ($('src')).value = text;
    run(text);
  } catch (err) { alert(`Không tải được: ${String(/** @type {any} */ (err)?.message || err)}`); }
});
const q = new URLSearchParams(location.search).get('url');
if (q) { /** @type {HTMLInputElement} */ ($('url')).value = q; $('fetch').click(); }
}
