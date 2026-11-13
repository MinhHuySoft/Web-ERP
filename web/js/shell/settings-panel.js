// @ts-check
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openDialog, toast } from '../core/ui.js';
import { isHex } from '../core/color.js';
import { THEMES, ACCENT_PRESETS, GRADIENT_PRESETS, colorState, getSettings, setSettings } from '../core/settings.js';

const DEFAULT_CUSTOM = ['#1f5fbf', '#0e7490'];
const same = (/** @type {string[]} */ a, /** @type {string[]} */ b) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
const gradCss = (/** @type {string[]} */ colors, angle = 135) => `linear-gradient(${angle}deg, ${colors.join(', ')})`;

const SECTIONS = [
  { id: 'theme', label: 'Theme', icon: 'cards', desc: 'Phong cách tổng thể của ứng dụng. Màu có thể chỉnh thêm ở mục Màu sắc.' },
  { id: 'color', label: 'Màu sắc', icon: 'theme', desc: 'Màu chủ đạo dùng cho nút chính, mục đang chọn và thanh tiêu đề. Mọi theme đổi theo màu này.' },
  { id: 'layout', label: 'Bố cục & chữ', icon: 'columns', desc: 'Mật độ hiển thị, kiểu menu, cỡ chữ và chuyển động.' },
];
let lastSection = 'theme';

/** Bảng "Giao diện & hiển thị": menu trái (Theme · Màu sắc · Bố cục & chữ), mỗi mục một lưới nhãn – điều khiển thẳng cột. */
export function openSettingsPanel() {
  const nav = h('nav', { class: 'erp-setnav', role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': 'Mục cài đặt' });
  const pane = h('div', { class: 'erp-setpane', role: 'tabpanel', id: 'setpane' });
  const tabs = SECTIONS.map((sec) => {
    const b = h('button', { type: 'button', role: 'tab', id: `setnav-${sec.id}`, 'aria-controls': 'setpane', onclick: () => show(sec.id),
      onkeydown: (/** @type {KeyboardEvent} */ e) => {
        const i = SECTIONS.indexOf(sec);
        const j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : null;
        if (j === null) return;
        e.preventDefault();
        const next = SECTIONS[(j + SECTIONS.length) % SECTIONS.length];
        show(next.id);
        /** @type {HTMLElement|null} */ (nav.querySelector(`#setnav-${next.id}`))?.focus();
      } }, icon(sec.icon), h('span', {}, sec.label));
    nav.append(b);
    return b;
  });

  /** @param {string} id @param {boolean} [keepScroll] */
  function show(id, keepScroll = false) {
    lastSection = id;
    const top = pane.scrollTop;
    tabs.forEach((b, i) => { const on = SECTIONS[i].id === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    pane.setAttribute('aria-labelledby', `setnav-${id}`);
    const sec = SECTIONS.find((x) => x.id === id) || SECTIONS[0];
    pane.replaceChildren(...(id === 'color' ? colorPane(sec, () => show('color', true)) : id === 'layout' ? layoutPane(sec) : themePane(sec)));
    pane.scrollTop = keepScroll ? top : 0;
  }

  show(lastSection);
  openDialog({ title: 'Giao diện & hiển thị', body: h('div', { class: 'erp-setdlg__body' }, nav, pane), size: 'lg', className: 'erp-setdlg',
    footer: [h('small', { class: 'erp-muted' }, 'Cài đặt lưu theo người dùng trên trình duyệt này và áp dụng ngay.')] });
}

/** @param {{label:string, desc:string}} sec @param {Node|null} [action] */
const paneHead = (sec, action = null) => h('header', { class: 'erp-setpane__head' },
  h('div', {}, h('h3', {}, sec.label), h('p', {}, sec.desc)), action);

/** Một hàng của lưới nhãn – điều khiển. @param {string} label @param {Node[]} controls @param {string} [forId] */
const row = (label, controls, forId) => [
  forId ? h('label', { class: 'erp-formrows__label', for: forId }, label) : h('span', { class: 'erp-formrows__label' }, label),
  h('div', { class: 'erp-formrows__ctl' }, ...controls)];

/** Ghi chú ngắn dưới điều khiển. @param {string} text @param {'info'|'warning'} [tone] */
const note = (text, tone = 'info') => h('p', { class: `erp-setnote${tone === 'warning' ? ' is-warning' : ''}` }, icon(tone), h('span', {}, text));

// ---- Theme -------------------------------------------------------------------------------------------------------
/** @param {any} sec */
function themePane(sec) {
  const s = getSettings();
  const grid = h('div', { class: 'erp-themes', role: 'radiogroup', 'aria-label': 'Theme' },
    ...THEMES.map((t) => {
      const card = h('button', { type: 'button', role: 'radio', class: 'erp-themecard', 'aria-checked': String(s.theme === t.id), dataset: { themePreview: t.id },
        onclick: () => {
          setSettings({ theme: t.id });
          grid.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === card)));
        } },
      h('span', { class: 'erp-themecard__preview', 'aria-hidden': 'true' },
        h('span', { class: 'p-bar' }), h('span', { class: 'p-ribbon' }), h('span', { class: 'p-body' }, h('span', {}), h('span', {}), h('span', {}))),
      h('strong', {}, t.name), h('small', {}, t.note));
      return card;
    }));
  return [paneHead(sec), grid];
}

// ---- Bố cục & chữ ------------------------------------------------------------------------------------------------
/** @param {any} sec */
function layoutPane(sec) {
  const s = getSettings();
  const seg = (/** @type {string} */ name, /** @type {[string,string][]} */ opts, /** @type {string} */ value, /** @type {(v:string)=>void} */ on) =>
    h('div', { class: 'erp-seg', role: 'radiogroup', 'aria-labelledby': `set-${name}-l` }, ...opts.map(([v, label]) => {
      const id = `set-${name}-${v}`;
      return h('label', { for: id }, h('input', { type: 'radio', name: `set-${name}`, id, value: v, checked: v === value, onchange: () => on(v) }), h('span', {}, label));
    }));
  const font = /** @type {HTMLInputElement} */ (h('input', { type: 'range', min: '12', max: '18', step: '1', value: String(s.fontSize), id: 'set-font',
    oninput: () => { setSettings({ fontSize: Number(font.value) }); fontOut.textContent = `${font.value}px`; } }));
  const fontOut = h('output', { for: 'set-font' }, `${s.fontSize}px`);
  const check = (/** @type {string} */ label, /** @type {boolean} */ checked, /** @type {(v:boolean)=>void} */ on) => h('label', { class: 'erp-check' },
    h('input', { type: 'checkbox', checked, onchange: (/** @type {Event} */ e) => on(/** @type {HTMLInputElement} */ (e.target).checked) }), h('span', {}, label));
  const lbl = (/** @type {string} */ id, /** @type {string} */ text) => h('span', { class: 'erp-formrows__label', id }, text);
  return [paneHead(sec), h('div', { class: 'erp-formrows' },
    lbl('set-density-l', 'Mật độ hiển thị'),
    h('div', { class: 'erp-formrows__ctl' }, seg('density', [['compact', 'Gọn'], ['standard', 'Chuẩn'], ['comfortable', 'Thoáng']], s.density, (v) => setSettings({ density: /** @type {any} */ (v) })),
      h('small', { class: 'erp-formrows__hint' }, 'Gọn: nhiều dòng hơn trên màn hình. Thoáng: ô và dòng cao hơn, dễ bấm.')),
    lbl('set-record-l', 'Bố cục chứng từ'),
    h('div', { class: 'erp-formrows__ctl' }, seg('recordLayout', [['compact', 'Gọn'], ['erp', 'Theo ERP']], s.recordLayout || 'compact', (v) => setSettings({ recordLayout: /** @type {any} */ (v) })),
      h('small', { class: 'erp-formrows__hint' }, 'Gọn: các ô xếp nối nhau cho kín chiều ngang, phần chi tiết lên gần hơn. Theo ERP: xuống dòng đúng như form WinForms.')),
    lbl('set-number-l', 'Định dạng số'),
    h('div', { class: 'erp-formrows__ctl' }, seg('numberStyle', [['vn', '1.234.567,89'], ['us', '1,234,567.89']], s.numberStyle === 'us' ? 'us' : 'vn', (v) => setSettings({ numberStyle: /** @type {any} */ (v) })),
      h('small', { class: 'erp-formrows__hint' }, 'Chọn giống cài đặt vùng (Region) của Windows trên máy chạy ERP để số trên web và bản in khớp ERP. Áp dụng cho màn hình mở sau khi đổi.')),
    lbl('set-nav-l', 'Kiểu menu'),
    h('div', { class: 'erp-formrows__ctl' }, seg('nav', [['ribbon', 'Ribbon (ngang)'], ['sidebar', 'Sidebar (dọc)']], s.nav, (v) => setSettings({ nav: /** @type {any} */ (v) })),
      check('Sidebar thu gọn thành thanh biểu tượng', s.sidebarCollapsed, (v) => setSettings({ sidebarCollapsed: v }))),
    ...row('Cỡ chữ', [h('div', { class: 'erp-range' }, font, fontOut)], 'set-font'),
    ...row('Chuyển động', [check('Giảm hiệu ứng chuyển động', s.reduceMotion, (v) => setSettings({ reduceMotion: v }))]))];
}

// ---- Màu sắc -----------------------------------------------------------------------------------------------------
/**
 * Màu chủ đạo (mọi theme dẫn xuất màu nhuốm từ màu này) + gradient tùy chọn, kèm xem trước trực tiếp bên phải.
 * Vẽ lại sau mỗi thay đổi để trạng thái chọn, ghi chú tương phản và nút đặt lại luôn đúng.
 * @param {any} sec @param {() => void} rerender @returns {Node[]}
 */
function colorPane(sec, rerender) {
  const s = getSettings();
  const meta = THEMES.find((t) => t.id === s.theme) || THEMES[0];
  const set = (/** @type {any} */ patch) => { setSettings(patch); rerender(); };
  const customized = !!s.accent || (s.gradColors || []).length > 0;
  const reset = h('button', { type: 'button', class: 'erp-btn erp-btn--sm', disabled: !customized || meta.locked,
    onclick: () => { set({ accent: '', gradColors: [] }); toast('Đã dùng màu mặc định của theme', 'info', 2000); } }, icon('reload'), 'Màu mặc định');
  if (meta.locked) return [paneHead(sec, reset), note(`Theme “${meta.name}” giữ màu cố định để luôn dễ đọc. Chọn theme khác để tùy biến màu.`)];

  // Màu chủ đạo
  const themeAccent = getComputedStyle(document.documentElement).getPropertyValue('--erp-accent').trim() || '#1f5fbf';
  const isPreset = ACCENT_PRESETS.some((p) => p.id.toLowerCase() === (s.accent || '').toLowerCase());
  const isCustom = !!s.accent && !isPreset;
  const swatch = (/** @type {string} */ value, /** @type {string} */ label, /** @type {string} */ color) => h('label', { class: 'erp-swatch', title: label },
    h('input', { type: 'radio', name: 'set-accent', value, checked: (s.accent || '') === value, 'aria-label': label, onchange: () => set({ accent: value }) }),
    h('span', { style: `--sw:${color}`, 'aria-hidden': 'true' }));
  const customInput = /** @type {HTMLInputElement} */ (h('input', { type: 'color', value: isCustom ? s.accent : themeAccent, 'aria-label': 'Chọn màu khác',
    oninput: () => setSettings({ accent: customInput.value }), onchange: () => set({ accent: customInput.value }) }));
  const accentCtl = [h('div', { class: 'erp-swatches', role: 'radiogroup', 'aria-labelledby': 'set-accent-l' },
    swatch('', `Theo theme (${meta.name})`, themeAccent), h('span', { class: 'erp-swatches__sep', 'aria-hidden': 'true' }),
    ...ACCENT_PRESETS.map((p) => swatch(p.id, p.name, p.id)),
    h('label', { class: `erp-swatch erp-swatch--custom${isCustom ? ' is-checked' : ''}`, title: 'Màu khác…' }, customInput,
      h('span', { style: `--sw:${isCustom ? s.accent : 'transparent'}`, 'aria-hidden': 'true' })))];
  if (colorState.accentAdjusted) accentCtl.push(note('Đã chỉnh đậm/nhạt màu một chút để chữ và nút đủ tương phản (4.5:1).'));

  // Gradient
  const g = (s.gradColors || []).filter(isHex);
  const preset = g.length ? GRADIENT_PRESETS.find((p) => same(p.colors, g)) : null;
  const mode = !g.length ? 'none' : preset ? preset.id : 'custom';
  const chip = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ bg, /** @type {() => void} */ pick) => h('label', { class: 'erp-gradchip' },
    h('input', { type: 'radio', name: 'set-grad', value: id, checked: mode === id, onchange: pick }),
    h('span', { class: 'erp-gradchip__tile', style: `background:${bg}`, 'aria-hidden': 'true' },
      id === 'none' ? icon('close') : id === 'custom' && mode !== 'custom' ? icon('edit') : null),
    h('span', { class: 'erp-gradchip__name' }, label));
  const gradCtl = [h('div', { class: 'erp-gradchips', role: 'radiogroup', 'aria-labelledby': 'set-grad-l' },
    chip('none', 'Không dùng', 'var(--erp-surface-2)', () => set({ gradColors: [] })),
    ...GRADIENT_PRESETS.map((p) => chip(p.id, p.name, gradCss(p.colors), () => set({ gradColors: p.colors, accent: p.accent }))),
    chip('custom', 'Tự tạo', mode === 'custom' ? gradCss(g, s.gradAngle) : 'var(--erp-surface-2)',
      () => set({ gradColors: g.length >= 2 ? g : [isHex(s.accent) ? s.accent : DEFAULT_CUSTOM[0], DEFAULT_CUSTOM[1]] })))];

  const rows = h('div', { class: 'erp-formrows' },
    h('span', { class: 'erp-formrows__label', id: 'set-accent-l' }, 'Màu chủ đạo'), h('div', { class: 'erp-formrows__ctl' }, ...accentCtl),
    h('span', { class: 'erp-formrows__label', id: 'set-grad-l' }, 'Gradient'), h('div', { class: 'erp-formrows__ctl' }, ...gradCtl));

  if (g.length >= 2) {
    const stops = g.map((c, i) => {
      const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'color', value: c, 'aria-label': `Màu ${i + 1} của gradient`,
        oninput: () => { const n = [...g]; n[i] = inp.value; setSettings({ gradColors: n }); }, onchange: () => { const n = [...g]; n[i] = inp.value; set({ gradColors: n }); } }));
      return h('span', { class: 'erp-gradstop' }, inp,
        g.length > 2 ? h('button', { type: 'button', class: 'erp-iconbtn', title: 'Bỏ màu này', 'aria-label': `Bỏ màu ${i + 1}`, onclick: () => set({ gradColors: g.filter((_, j) => j !== i) }) }, icon('close')) : null);
    });
    const stopCtl = [h('div', { class: 'erp-gradstops' }, ...stops,
      g.length < 3 ? h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => set({ gradColors: [...g, g[g.length - 1]] }) }, icon('add'), 'Thêm màu') : null)];
    if (s.gradChrome && colorState.chromeInkRatio && colorState.chromeInkRatio < 4.5) {
      stopCtl.push(note(`Các màu chênh sáng – tối nhiều nên chữ trên thanh tiêu đề chỉ đạt ${colorState.chromeInkRatio.toFixed(1)}:1. Nên chọn các màu có độ đậm gần nhau.`, 'warning'));
    }
    const angleOut = h('output', { for: 'set-grad-angle' }, `${s.gradAngle}°`);
    const angle = /** @type {HTMLInputElement} */ (h('input', { type: 'range', id: 'set-grad-angle', min: '0', max: '345', step: '15', value: String(s.gradAngle),
      oninput: () => { setSettings({ gradAngle: Number(angle.value) }); angleOut.textContent = `${angle.value}°`; } }));
    const check = (/** @type {'gradChrome'|'gradBg'} */ key, /** @type {string} */ label) => h('label', { class: 'erp-check' },
      h('input', { type: 'checkbox', checked: s[key], onchange: (/** @type {Event} */ e) => set({ [key]: /** @type {HTMLInputElement} */ (e.target).checked }) }), h('span', {}, label));
    const applyCtl = [check('gradChrome', 'Thanh tiêu đề'),
      meta.vivid ? h('small', { class: 'erp-formrows__hint' }, `Nền: theme ${meta.name} tô nền bằng chính các màu gradient này.`) : check('gradBg', 'Nền ứng dụng (pha nhạt)')];
    rows.append(...row('Màu gradient', stopCtl), ...row('Góc', [h('div', { class: 'erp-range' }, angle, angleOut)], 'set-grad-angle'), ...row('Áp dụng cho', applyCtl));
  }

  return [paneHead(sec, reset), h('div', { class: 'erp-colortab' }, rows, preview())];
}

/** Màn hình thu nhỏ dùng chính biến màu đang áp dụng nên luôn khớp với ứng dụng. */
function preview() {
  const tr = (/** @type {string} */ a, /** @type {string} */ b, sel = false) => h('div', { class: `erp-cprev__tr${sel ? ' is-selected' : ''}` }, h('span', {}, a), h('span', {}, b));
  return h('figure', { class: 'erp-cprev' },
    h('figcaption', {}, 'Xem trước'),
    h('div', { class: 'erp-cprev__app', 'aria-hidden': 'true' },
      h('div', { class: 'erp-cprev__bar' }, h('span', { class: 'erp-cprev__logo' }), h('strong', {}, 'ERP Web'), h('span', { class: 'erp-cprev__chip' }, 'Hà Nội · 11/2026')),
      h('div', { class: 'erp-cprev__main' },
        h('div', { class: 'erp-cprev__side' }, h('span', {}, icon('home'), 'Trang chủ'), h('span', { class: 'is-active' }, icon('sales'), 'Bán hàng'), h('span', {}, icon('warehouse'), 'Kho')),
        h('div', { class: 'erp-cprev__content' },
          h('div', { class: 'erp-cprev__title' }, h('strong', {}, 'Hóa đơn bán hàng'), h('span', { class: 'erp-cprev__badge' }, 'Đang sửa')),
          h('div', { class: 'erp-cprev__actions' }, h('span', { class: 'erp-btn erp-btn--primary erp-btn--sm' }, icon('save'), 'Lưu'), h('span', { class: 'erp-btn erp-btn--sm' }, 'Hủy')),
          h('div', { class: 'erp-cprev__table' }, tr('SI1126/0001', '48.500.000'), tr('SI1126/0002', '12.900.000', true), tr('SI1126/0003', '7.250.000')),
          h('span', { class: 'erp-cprev__link' }, 'Xem chứng từ gốc')))));
}
