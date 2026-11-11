// @ts-check
import { h } from '../core/dom.js';
import { openDialog, toast } from '../core/ui.js';
import { THEMES, getSettings, setSettings } from '../core/settings.js';

/** Bảng chọn giao diện: theme, mật độ, cỡ chữ, kiểu điều hướng, màu nhấn, giảm chuyển động. */
export function openSettingsPanel() {
  const s = getSettings();
  const themes = h('div', { class: 'erp-themes', role: 'radiogroup', 'aria-label': 'Theme' },
    ...THEMES.map((t) => {
      const card = h('button', { type: 'button', role: 'radio', class: 'erp-themecard', 'aria-checked': String(s.theme === t.id), dataset: { themePreview: t.id },
        onclick: () => {
          setSettings({ theme: t.id });
          themes.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === card)));
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
  const accent = /** @type {HTMLInputElement} */ (h('input', { type: 'color', id: 'set-accent', value: s.accent || '#1f5fbf', oninput: () => setSettings({ accent: accent.value }) }));
  const motion = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id: 'set-motion', checked: s.reduceMotion, onchange: () => setSettings({ reduceMotion: motion.checked }) }));

  const body = h('div', { class: 'erp-settings' },
    h('section', {}, h('h3', {}, 'Theme'), themes),
    h('section', { class: 'erp-settings__grid' },
      h('div', {}, h('h3', {}, 'Mật độ hiển thị'), radio('density', [['compact', 'Gọn'], ['standard', 'Chuẩn'], ['comfortable', 'Thoáng']], s.density, (v) => setSettings({ density: /** @type {any} */ (v) }))),
      h('div', {}, h('h3', {}, 'Kiểu điều hướng'), radio('nav', [['ribbon', 'Ribbon'], ['sidebar', 'Menu bên trái']], s.nav, (v) => setSettings({ nav: /** @type {any} */ (v) }))),
      h('div', {}, h('h3', {}, h('label', { for: 'set-font' }, 'Cỡ chữ')), h('div', { class: 'erp-settings__row' }, font, fontOut)),
      h('div', {}, h('h3', {}, h('label', { for: 'set-accent' }, 'Màu nhấn')), h('div', { class: 'erp-settings__row' }, accent,
        h('button', { type: 'button', class: 'erp-btn erp-btn--sm', onclick: () => { setSettings({ accent: '' }); toast('Đã dùng màu nhấn của theme', 'info', 2000); } }, 'Theo theme'))),
      h('div', {}, h('h3', {}, 'Chuyển động'), h('label', { class: 'erp-check' }, motion, h('span', {}, 'Giảm hiệu ứng chuyển động')))),
  );
  openDialog({ title: 'Giao diện & hiển thị', body, size: 'lg', footer: [h('small', { class: 'erp-muted' }, 'Cài đặt lưu theo người dùng trên trình duyệt này.')] });
}
