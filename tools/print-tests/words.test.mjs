// Đối chiếu web/js/print/words.js với kết quả của mã C# gốc (Tools.Currency.CurrencyToWords) trên ~320 số × 7 cặp tiền/ngôn ngữ.
// words-gold.tsv sinh một lần từ mã gốc (văn hóa vi-VN); dòng "!ERR" là chỗ mã gốc ném lỗi (web trả null).
import { readFileSync } from 'node:fs';
import { currencyToWords } from '../../web/js/print/words.js';

export default function run(t) {
  const lines = readFileSync(new URL('./words-gold.tsv', import.meta.url), 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const [n, cur, lang, expected] = line.split('\t');
    t.eq(currencyToWords(Number(n), cur, lang), expected.startsWith('!ERR') ? null : expected, `${n} ${cur} ${lang}`);
  }
}
