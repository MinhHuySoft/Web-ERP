// @ts-check
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openDialog, toast } from '../core/ui.js';
import { isHex } from '../core/color.js';
import { THEMES, ACCENT_PRESETS, GRADIENT_PRESETS, colorState, getSettings, setSettings } from '../core/settings.js';

const DEFAULT_CUSTOM = ['#1f5fbf', '#0e7490'];
const same = (/** @type {string[]} */ a, /** @type {string[]} */ b) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
const gradCss = (/** @type {string[]} */ colors, angle = 135) => `linear-gradient(${angle}deg, ${colors.join(', ')})`;

/** Bảng chọn giao diện: theme, màu sắc (màu chủ đạo, gradient), mật độ, kiểu menu, cỡ chữ, giảm chuyển động. */
export function openSettingsPanel() {
  const s = getSettings();
  const colorBox = h('section', { class: 'erp-colorset', 'aria-labelledby': 'set-color-h' });
  const renderColors = () => colorBox.replaceChildren(...colorSection(renderColors));

  const themes = h('div', { class: 'erp-themes', role: 'radiogroup', 'aria-label': 'Theme' },
    ...THEMES.map((t) => {
      const card = h('button', { type: 'button', role: 'radio', class: 'erp-themecard', 'aria-checked': String(s.theme === t.id), dataset: { themePreview: t.id },
        onclick: () => {
          setSettings({ theme: t.id });
          themes.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === card)));
          renderColors();
        } },
      h('span', { class: 'erp-themecard__preview', 'aria-hidden': 'true' },
        h('span', { class: 'p-bar' }), h('span', { class: 'p-ribbon' }), h('span', { class: 'p-body' }, h('span', {}), h('span', {}), h('span', {}))),
      h('strong', {}, t.name), h('small', {}, t.note));
      return card;
    }));

  const radio = (/** @type {string} */ name, /** @type {[string,string][]} */ opts, /** @type {string} */ value, /** @type {(v:string)=>void} */ on) =>
    h('div', { class: 'erp-seg', role: 'radiogroup' }, ...opts.map(([v, label]) => {
      const id = `set-${name}-${v}`;
      const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'radio', name: `set-${name}`, id, value: v, checked: v === value, onchange: () => on(v) }));
      return h('label', { for: id }, inp, h('span', {}, label));
    }));

  const font = /** @type {HTMLInputElement} */ (h('input', { type: 'range', min: '12', max: '18', step: '1', value: String(s.fontSize), id: 'set-font',
    oninput: () => { setSettings({ fontSize: Number(font.value) }); fontOut.textContent = `${font.value}px`; } }));
  const fontOut = h('output', { for: 'set-font' }, `${s.fontSize}px`);
  const motion = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id: 'set-motion', checked: s.reduceMotion, onchange: () => setSettings({ reduceMotion: motion.checked }) }));

  renderColors();
  const body = h('div', { class: 'erp-settings' },
    h('section', {}, h('h3', {}, 'Theme'), themes),
    colorBox,
    h('section', { class: 'erp-settings__grid' },
      h('div', {}, h('h3', {}, 'Mật độ hiển thị'), radio('density', [['compact', 'Gọn'], ['standard', 'Chuẩn'], ['comfortable', 'Thoáng']], s.density, (v) => setSettings({ density: /** @type {any} */ (v) }))),
      h('div', {}, h('h3', {}, 'Kiểu menu'), radio('nav', [['ribbon', 'Ribbon (ngang)'], ['sidebar', 'Sidebar (dọc)']], s.nav, (v) => setSettings({ nav: /** @type {any} */ (v) })),
        h('label', { class: 'erp-check erp-settings__sub' }, h('input', { type: 'checkbox', checked: s.sidebarCollapsed, onchange: (/** @type {Event} */ e) => setSettings({ sidebarCollapsed: /** @type {HTMLInputElement} */ (e.target).checked }) }),
          h('span', {}, 'Sidebar thu gọn thành thanh biểu tượng'))),
      h('div', {}, h('h3', {}, h('label', { for: 'set-font' }, 'Cỡ chữ')), h('div', { class: 'erp-settings__row' }, font, fontOut)),
      h('div', {}, h('h3', {}, 'Chuyển động'), h('label', { class: 'erp-check' }, motion, h('span', {}, 'Giảm hiệu ứng chuyển động')))),
  );
  openDialog({ title: 'Giao diện & hiển thị', body, size: 'lg', footer: [h('small', { class: 'erp-muted' }, 'Cài đặt lưu theo người dùng trên trình duyệt này.')] });
}

/**
 * Phần "Màu sắc": màu chủ đạo (mọi theme dẫn xuất màu nhuốm từ màu này) + gradient tùy chọn cho thanh tiêu đề / nền.
 * Vẽ lại sau mỗi thay đổi để trạng thái chọn, ghi chú tương phản và nút đặt lại luôn đúng.
 * @param {() => void} rerender @returns {Node[]}
 */
function colorSection(rerender) {
  const s = getSettings();
  const meta = THEMES.find((t) => t.id === s.theme) || THEMES[0];
  const set = (/** @type {any} */ patch) => { setSettings(patch); rerender(); };
  const customized = !!s.accent || (s.gradColors || []).length > 0;
  const head = h('div', { class: 'erp-colorset__head' },
    h('h3', { id: 'set-color-h' }, 'Màu sắc'),
    h('button', { type: 'button', class: 'erp-btn erp-btn--sm', disabled: !customized,
      onclick: () => { set({ accent: '', gradColors: [] }); toast('Đã dùng màu mặc định của theme', 'info', 2000); } }, icon('reload'), 'Màu mặc định'));
  if (meta.locked) {
    return [head, h('p', { class: 'erp-colorset__note' }, `Theme “${meta.name}” giữ màu cố định để luôn dễ đọc. Chọn theme khác để tùy biến màu.`)];
  }

  // ---- Màu chủ đạo
  const themeAccent = getComputedStyle(document.documentElement).getPropertyValue('--erp-accent').trim() || '#1f5fbf';
  const isPreset = ACCENT_PRESETS.some((p) => p.id.toLowerCase() === (s.accent || '').toLowerCase());
  const swatch = (/** @type {string} */ value, /** @type {string} */ label, /** @type {string} */ color) => h('label', { class: 'erp-swatch', title: label },
    h('input', { type: 'radio', name: 'set-accent', value, checked: (s.accent || '') === value, 'aria-label': label, onchange: () => set({ accent: value }) }),
    h('span', { style: `--sw:${color}`, 'aria-hidden': 'true' }));
  const customInput = /** @type {HTMLInputElement} */ (h('input', { type: 'color', value: isHex(s.accent) ? s.accent : themeAccent, 'aria-label': 'Chọn màu khác',
    oninput: () => setSettings({ accent: customInput.value }), onchange: () => set({ accent: customInput.value }) }));
  const custom = h('label', { class: `erp-swatch erp-swatch--custom${s.accent && !isPreset ? ' is-checked' : ''}`, title: 'Màu khác…' }, customInput,
    h('span', { style: `--sw:${s.accent && !isPreset ? s.accent : 'transparent'}`, 'aria-hidden': 'true' }));
  const accentRow = h('div', { class: 'erp-colorset__row' },
    h('span', { class: 'erp-colorset__label', id: 'set-accent-l' }, 'Màu chủ đạo'),
    h('div', { class: 'erp-swatches', role: 'radiogroup', 'aria-labelledby': 'set-accent-l' },
      swatch('', `Theo theme (${meta.name})`, themeAccent), h('span', { class: 'erp-swatches__sep', 'aria-hidden': 'true' }),
      ...ACCENT_PRESETS.map((p) => swatch(p.id, p.name, p.id)), custom));

  // ---- Gradient
  const g = (s.gradColors || []).filter(isHex);
  const preset = g.length ? GRADIENT_PRESETS.find((p) => same(p.colors, g)) : null;
  const mode = !g.length ? 'none' : preset ? preset.id : 'custom';
  const chip = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ bg, /** @type {() => void} */ pick) => h('label', { class: 'erp-gradchip' },
    h('input', { type: 'radio', name: 'set-grad', value: id, checked: mode === id, onchange: pick }),
    h('span', { class: 'erp-gradchip__tile', style: `background:${bg}`, 'aria-hidden': 'true' }, id === 'none' ? icon('close') : id === 'custom' && mode !== 'custom' ? icon('edit') : null),
    h('span', { class: 'erp-gradchip__name' }, label));
  const gradRow = h('div', { class: 'erp-colorset__row' },
    h('span', { class: 'erp-colorset__label', id: 'set-grad-l' }, 'Gradient'),
    h('div', { class: 'erp-gradchips', role: 'radiogroup', 'aria-labelledby': 'set-grad-l' },
      chip('none', 'Không dùng', 'var(--erp-surface-2)', () => set({ gradColors: [] })),
      ...GRADIENT_PRESETS.map((p) => chip(p.id, p.name, gradCss(p.colors), () => set({ gradColors: p.colors, accent: p.accent }))),
      chip('custom', 'Tự tạo', mode === 'custom' ? gradCss(g, s.gradAngle) : 'var(--erp-surface-2)',
        () => set({ gradColors: g.length >= 2 ? g : [isHex(s.accent) ? s.accent : DEFAULT_CUSTOM[0], DEFAULT_CUSTOM[1]] }))));

  const nodes = [head, accentRow];
  if (colorState.accentAdjusted) {
    nodes.push(h('p', { class: 'erp-colorset__note' }, icon('info'), 'Màu chủ đạo đã được chỉnh đậm/nhạt hơn một chút để chữ và nút đủ tương phản (4.5:1).'));
  }
  nodes.push(gradRow);

  if (g.length >= 2) {
    const stops = g.map((c, i) => {
      const inp = /** @type {HTMLInputElement} */ (h('input', { type: 'color', value: c, 'aria-label': `Màu ${i + 1} của gradient`,
        oninput: () => { const n = [...g]; n[i] = inp.value; setSettings({ gradColors: n }); }, onchange: () => { const n = [...g]; n[i] = inp.value; set({ gradColors: n }); } }));
      return h('span', { class: 'erp-gradedit__stop' }, inp,
        g.length > 2 ? h('button', { type: 'button', class: 'erp-iconbtn', title: 'Bỏ màu này', 'aria-label': `Bỏ màu ${i + 1}`,
          onclick: () => set({ gradColors: g.filter((_, j) => j !== i) }) }, icon('close')) : null);
    });
    const angleOut = h('output', { for: 'set-grad-angle' }, `${s.gradAngle}°`);
    const angle = /** @type {HTMLInputElement} */ (h('input', { type: 'range', id: 'set-grad-angle', min: '0', max: '345', step: '15', value: String(s.gradAngle),
      oninput: () => { setSettings({ gradAngle: Number(angle.value) }); angleOut.textContent = `${angle.value}°`; } }));
    const check = (/** @type {string} */ key, /** @type {string} */ label) => h('label', { class: 'erp-check' },
      h('input', { type: 'checkbox', checked: /** @type {any} */ (s)[key], onchange: (/** @type {Event} */ e) => set({ [key]: /** @type {HTMLInputElement} */ (e.target).checked }) }), h('span', {}, label));
    nodes.push(h('div', { class: 'erp-gradedit' },
      h('div', { class: 'erp-gradedit__stops' }, ...stops,
        g.length < 3 ? h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => set({ gradColors: [...g, g[g.length - 1]] }) }, icon('add'), 'Thêm màu') : null),
      h('label', { class: 'erp-settings__row erp-gradedit__angle', for: 'set-grad-angle' }, h('span', {}, 'Góc'), angle, angleOut),
      h('div', { class: 'erp-gradedit__apply' }, h('span', {}, 'Áp dụng cho:'), check('gradChrome', 'Thanh tiêu đề'),
        meta.vivid ? h('span', { class: 'erp-muted' }, `Nền: theme ${meta.name} tô nền bằng chính các màu này`) : check('gradBg', 'Nền ứng dụng'))));
    if (s.gradChrome && colorState.chromeInkRatio && colorState.chromeInkRatio < 4.5) {
      nodes.push(h('p', { class: 'erp-colorset__note is-warning' }, icon('warning'),
        `Các màu gradient chênh sáng – tối nhiều nên chữ trên thanh tiêu đề chỉ đạt ${colorState.chromeInkRatio.toFixed(1)}:1. Nên chọn các màu có độ đậm gần nhau.`));
    }
  }

  // ---- Xem trước (dùng chính biến màu đang áp dụng nên luôn khớp)
  nodes.push(h('div', { class: 'erp-colorprev', 'aria-hidden': 'true' },
    h('div', { class: 'erp-colorprev__bar' }, h('span', { class: 'erp-colorprev__logo' }), h('strong', {}, 'ERP Web'), h('span', { class: 'erp-colorprev__chip' }, 'Hà Nội · 11/2026')),
    h('div', { class: 'erp-colorprev__body' },
      h('span', { class: 'erp-btn erp-btn--primary erp-btn--sm' }, icon('save'), 'Lưu'),
      h('span', { class: 'erp-colorprev__link' }, 'Liên kết'),
      h('span', { class: 'erp-colorprev__sel' }, 'Mục đang chọn'),
      h('span', { class: 'erp-colorprev__row' }, 'Dòng lưới đang chọn'))));
  return nodes;
}
