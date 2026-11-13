// @ts-check
/**
 * Đọc số thành chữ: chép nguyên thuật toán `Tools.Currency.CurrencyToWords` của ERP.NET (WinForms), gồm cả các chỗ
 * lạ của mã gốc (dấu phẩy giữa các hàng ở ngoại tệ, "Billion " thiếu khoảng trắng, bỏ phần lẻ ở VND tiếng Anh…), để
 * mẫu in trên web ra đúng chữ như WinForms. Đối chiếu bằng bộ test vàng `tools/print-tests/` (sinh từ mã C# gốc).
 *
 * Tên đơn vị lẻ của ngoại tệ (`CF_CurrencyTbl.DonViTienLe`) do BE gửi trong tham số in; thiếu thì dùng "xu" như gốc.
 * Mã gốc ném lỗi khi đọc VND tiếng Việt cho số trong khoảng (0; 1) — trình xem cũ khi đó giữ nguyên chữ số; ở đây trả `null`
 * để bộ dựng làm đúng như vậy.
 */

const DIGITS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['trăm', 'nghìn', 'triệu', 'tỷ'];
const EN_GROUP = ['', '', ' Thousand ', ' Million ', 'Billion ', ' Trillion ', '', '', '', ''];

/** Tên tiền chẵn tiếng Việt của các ngoại tệ có sẵn trong mã gốc. */
const VN_MAJOR = { USD: 'đô la Mỹ', EUR: 'EURO', AUD: 'đô la Úc', CAD: 'đô la Canada' };
const EN_MAJOR = { USD: 'Dollars', EUR: 'EURO', AUD: 'Australian dollar', CAD: 'Canadian dollar' };

/**
 * @param {number} number
 * @param {string} [currency] mã tiền tệ, mặc định VND (chuỗi rỗng cũng là VND)
 * @param {string} [lang] "VN" (mặc định) hoặc "EN" — phân biệt hoa thường như mã gốc
 * @param {string} [minorUnit] tên đơn vị lẻ của ngoại tệ khi đọc tiếng Việt (DonViTienLe), mặc định "xu"
 * @returns {string|null}
 */
export function currencyToWords(number, currency = 'VND', lang = 'VN', minorUnit = '') {
  try { return words(Number(number) || 0, currency, lang, minorUnit); } catch { return null; }
}

/** @param {number} n @param {string} currency @param {string} lang @param {string} minorUnit */
function words(n, currency, lang, minorUnit) {
  const minor = minorUnit || 'xu';
  if (currency === 'VND' || currency === '') return lang !== 'EN' ? vndVN(n) : vndEN(n);
  const known = /** @type {Record<string,string>} */ (VN_MAJOR)[currency];
  if (known) return lang !== 'EN' ? currency2WordsVN(n, known, minor) : currencyEN(n, /** @type {Record<string,string>} */ (EN_MAJOR)[currency], 'cent');
  return lang !== 'EN' ? currency2WordsVN(n, currency, minor) : currencyEN(n, currency, 'xu');
}

/* ---------------- hàm chuỗi kiểu VB ---------------- */

/** Mid(s, start 1-based, len?) */
const mid = (/** @type {string} */ s, /** @type {number} */ start, /** @type {number} */ len = Infinity) => (start < 1 ? s.slice(0, Math.max(0, len)) : s.substr(start - 1, len === Infinity ? undefined : Math.max(0, len)));
const left = (/** @type {string} */ s, /** @type {number} */ n) => s.slice(0, Math.max(0, n));
const right = (/** @type {string} */ s, /** @type {number} */ n) => (n <= 0 ? '' : s.slice(-n));
const last = (/** @type {string} */ s) => (s ? s[s.length - 1] : '');

/** Conversion.Val của VB: bỏ khoảng trắng, đọc phần số ở đầu chuỗi. @param {string} s */
export function val(s) {
  const t = String(s ?? '').replace(/[\s ]/g, '');
  const m = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(t);
  return m ? Number(m[0]) : 0;
}

/** Double.ToString() kiểu .NET Framework (15 chữ số có nghĩa), dấu chấm thập phân. @param {number} n */
export function dotnetG(n) {
  if (!Number.isFinite(n)) return String(n);
  return String(Number(n.toPrecision(15)));
}

/**
 * Định dạng số với đúng 2 chữ số lẻ, làm tròn nửa xa 0 trên dạng 15 chữ số như Format(x, "##0.00") của .NET Framework.
 * @param {number} n số không âm
 */
function fixed2(n) {
  const s = plain15(n);
  const [ip, fp = ''] = s.split('.');
  const f = (fp + '000').slice(0, 3);
  let cents = Number(f.slice(0, 2));
  let int = BigInt(ip || '0');
  if (Number(f[2]) >= 5) { cents += 1; if (cents === 100) { cents = 0; int += 1n; } }
  return `${int}.${String(cents).padStart(2, '0')}`;
}

/** Dạng thập phân thường (không mũ) của số làm tròn 15 chữ số có nghĩa. @param {number} n số không âm */
export function plain15(n) {
  const [m, e = '0'] = n.toPrecision(15).split('e');
  const exp = Number(e);
  let [a, b = ''] = m.split('.');
  if (exp > 0) { b = b.padEnd(exp, '0'); a += b.slice(0, exp); b = b.slice(exp); }
  else if (exp < 0) { b = '0'.repeat(-exp - 1) + a + b; a = '0'; }
  b = b.replace(/0+$/, '');
  return b ? `${a}.${b}` : a;
}

/** Chuỗi chữ số đảo ngược của phần nguyên như vòng lặp gốc (lấy các chữ số đầu tới ký tự không phải số). @param {string} s */
function reversedLeadingDigits(s) {
  let out = '';
  for (const ch of s) { if (ch >= '0' && ch <= '9') out = ch + out; else break; }
  return out;
}

/**
 * Vòng đọc các hàng của phần nguyên (dùng chung VND và ngoại tệ; ngoại tệ thêm dấu phẩy sau tên hàng).
 * @param {string} text2 chữ số đã đảo @param {boolean} comma
 */
function readInteger(text2, comma) {
  let text = '';
  let b = 0;
  for (let b3 = text2.length; b3 >= 1; b3--) {
    const d = Math.round(val(mid(text2, b3, 1)));
    switch (b3 % 3) {
      case 2:
        if (d === 1) text += ' mười';
        else if (d >= 2 && d <= 9) text += ` ${DIGITS[d]} mươi`;
        else if (d === 0 && b3 > 1 && val(mid(text2, b3 - 1, 1)) > 0) text += ' lẻ ';
        b = d;
        break;
      case 1: {
        if (d === 1) text += b <= 1 ? ' một' : ' mốt';
        else if (d === 5) text += b <= 0 ? ' năm' : ' lăm';
        else if (d >= 2 && d <= 9) text += ` ${DIGITS[d]}`;
        b = 0;
        let u = Math.floor(b3 / 3);
        while (u > 3) u = Math.floor(u / 3);
        // Mã gốc luôn tính Mid(text, Len(text), 1) (toán tử & không ngắt): text rỗng ⇒ Mid(…, 0, 1) ném lỗi.
        if (text === '') throw new RangeError('Mid: Start phải ≥ 1');
        if (u !== 0 && last(text) !== ',') text += ` ${UNITS[u]}${comma ? ',' : ''}`;
        break;
      }
      default: // 0: hàng trăm
        if (d !== 0) text += ` ${DIGITS[d]} ${UNITS[0]}`;
        if (d === 0 && text.length > 0 && val(mid(text2, 1, b3 - 1)) > 0) text += ` không ${UNITS[0]}`;
        break;
    }
  }
  return text;
}

/** Viết hoa chữ đầu, bỏ khoảng trắng đầu và (nếu có) dấu phẩy cuối — đúng biểu thức gốc. @param {string} t @param {boolean} upper */
function head(t, upper) {
  const first = left(t.replace(/^\s+/, ''), 1);
  const rest = last(t) !== ',' ? mid(t, 3, t.length - 2) : mid(t, 3, t.length - 3);
  return (upper ? first.toUpperCase() : first.toLowerCase()) + rest;
}

/** @param {string} s */
function cleanup(s) {
  return s.replace(/triệu nghìn đồng/g, 'triệu đồng').replace(/không trăm triệu/g, '').replace(/không trăm nghìn/g, '')
    .replace(/tỷ triệu đồng/g, 'tỷ đồng').split('  ').join(' ').split('  ').join(' ');
}

/** VND tiếng Việt. @param {number} n */
function vndVN(n) {
  let neg = false;
  if (n < 0) { n = -n; neg = true; }
  const text2 = reversedLeadingDigits(dotnetG(n));
  const text = n > 0 ? readInteger(text2, false) : '';
  const s = text !== '' ? `${neg ? 'Âm ' : ''}${head(text, true)} đồng ./.` : 'Không đồng ./.';
  return cleanup(s);
}

/** Ngoại tệ tiếng Việt (Currency2WordsVN). @param {number} n @param {string} major @param {string} minor */
export function currency2WordsVN(n, major = 'đô la Mỹ', minor = 'cent') {
  let neg = false;
  if (n < 0) { n = -n; neg = true; }
  const f = fixed2(n);                       // "##0.00"
  const f3 = f.startsWith('0.') ? f.slice(1) : f; // "###.00" (bỏ số 0 đầu)
  const intDigits = left(f, f3.length - 3);
  const centsStr = right(f, 2);
  const cents = Number(centsStr);
  const intText = n > 0 ? readInteger(reversedLeadingDigits(intDigits), true) : '';
  let centText = '';
  if (cents > 0) {
    const t2 = reversedLeadingDigits(centsStr);
    let b = 0;
    for (let b4 = t2.length; b4 >= 1; b4--) {
      const d = Math.round(val(mid(t2, b4, 1)));
      if (b4 % 3 === 2) {
        if (d === 1) centText += ' mười';
        else if (d !== 0 && d <= 9) centText += ` ${DIGITS[d]} mươi`;
        b = d;
      } else if (b4 % 3 === 1) {
        if (d === 1) centText += b <= 1 ? ' một' : ' mốt';
        else if (d === 5) centText += b <= 0 ? ' năm' : ' lăm';
        else if (d >= 2 && d <= 9) centText += ` ${DIGITS[d]}`;
        b = 0;
      } else if (d !== 0) centText += ` ${DIGITS[d]} ${UNITS[0]}`;
    }
  }
  let s = intText !== '' ? `${head(intText, true)} ${major}` : `Không ${major}`;
  s += centText !== '' ? ` và ${head(centText, false)} ${minor}` : '.';
  return (neg ? 'Âm ' : '') + cleanup(s);
}

/* ---------------- tiếng Anh ---------------- */

/** @param {string} p */
function one(p) {
  const n = val(p);
  return ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][n >= 1 && n <= 9 && Number.isInteger(n) ? n : 0];
}

/** @param {string} p */
function tens(p) {
  if (val(left(p, 1)) === 1) {
    const n = val(p);
    return ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'][n - 10] ?? '';
  }
  const t = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '][val(left(p, 1))] ?? '';
  return t + one(right(p, 1));
}

/** @param {string} p */
function hundreds(p) {
  if (val(p) === 0) return '';
  p = right(`000${p}`, 3);
  let t = '';
  if (left(p, 1) !== '0') t = `${one(left(p, 1))} Hundred `;
  t += mid(p, 2, 1) === '0' ? one(mid(p, 3)) : tens(mid(p, 2));
  return t.trim();
}

/** @param {number} n @returns {{ int: string, cents: string }} */
function enParts(n) {
  let text = dotnetG(n).trim();
  let cents = '';
  const i = text.indexOf('.');
  if (i >= 0) {
    cents = tens(left(text.slice(i + 1) + '00', 2));
    text = left(text, i).trim();
  }
  let words = '';
  let g = 1;
  while (text !== '') {
    const t = hundreds(right(text, 3));
    if (t !== '') words = t + EN_GROUP[g] + words;
    text = text.length <= 3 ? '' : left(text, text.length - 3);
    g++;
  }
  return { int: words, cents };
}

/** VND tiếng Anh: bỏ phần lẻ như gốc. @param {number} n */
function vndEN(n) {
  const { int } = enParts(n);
  if (int === '') return 'No VND.';
  return int === 'One' ? 'One VND.' : `${int} VND.`;
}

/** @param {number} n @param {string} major @param {string} minor */
function currencyEN(n, major, minor) {
  const { int, cents } = enParts(n);
  const a = int === '' ? `No ${major}` : int === 'One' ? `One ${major}` : `${int} ${major}`;
  let b;
  if (cents !== '') b = cents === 'One' ? ` And One ${minor}.` : ` And ${cents} ${minor}.`;
  else b = a !== `No ${major}` ? ' Only.' : '';
  return a + b;
}
