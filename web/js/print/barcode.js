// @ts-check
/**
 * Mã vạch Code 128 (tự chọn bộ B / C) vẽ bằng SVG — không thư viện ngoài. QR làm ở giai đoạn sau (docs 06 §8).
 */

const PATTERNS = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 '
  + '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 '
  + '131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 '
  + '213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 '
  + '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 '
  + '421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 '
  + '2331112').split(' ');

/**
 * Mã hóa chuỗi thành dãy độ rộng vạch/khoảng (đơn vị module).
 * @param {string} text @returns {number[]|null} null nếu có ký tự ngoài ASCII 32–126
 */
export function code128(text) {
  if (!/^[\x20-\x7e]*$/.test(text)) return null;
  /** @type {number[]} */ const codes = [];
  let i = 0;
  let set = /^\d{4}/.test(text) ? 'C' : 'B';
  codes.push(set === 'C' ? 105 : 104);
  while (i < text.length) {
    if (set === 'C') {
      if (/^\d\d/.test(text.slice(i))) { codes.push(Number(text.slice(i, i + 2))); i += 2; continue; }
      codes.push(100); set = 'B'; continue;
    }
    if (/^\d{6}/.test(text.slice(i)) || (/^\d{4}$/.test(text.slice(i)))) { codes.push(99); set = 'C'; continue; }
    codes.push(text.charCodeAt(i) - 32); i++;
  }
  let sum = codes[0];
  for (let k = 1; k < codes.length; k++) sum += codes[k] * k;
  codes.push(sum % 103, 106);
  return codes.flatMap((c) => PATTERNS[c].split('').map(Number));
}

/**
 * SVG mã vạch vừa khung w×h (mm).
 * @param {string} text @param {number} w @param {number} h @param {boolean} showText
 */
export function code128Svg(text, w, h, showText) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', `${w}mm`);
  svg.setAttribute('height', `${h}mm`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const bars = code128(text);
  if (!bars) return svg;
  const quiet = 10;
  const total = bars.reduce((s, x) => s + x, 0) + quiet * 2;
  const unit = w / total;
  const textH = showText ? Math.min(h * 0.3, 3.5) : 0;
  let x = quiet * unit;
  bars.forEach((bw, k) => {
    if (k % 2 === 0) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x)); r.setAttribute('y', '0'); r.setAttribute('width', String(bw * unit)); r.setAttribute('height', String(h - textH));
      svg.append(r);
    }
    x += bw * unit;
  });
  if (showText) {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', String(w / 2)); t.setAttribute('y', String(h - 0.4)); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', String(textH * 0.9)); t.setAttribute('font-family', 'Arial, sans-serif');
    t.textContent = text;
    svg.append(t);
  }
  return svg;
}
