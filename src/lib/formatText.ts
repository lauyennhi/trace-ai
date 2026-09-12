/**
 * Utility functions for Vietnamese text sanitization, Unicode NFC normalization,
 * and fixing common separated diacritics / tone marks.
 */

export function normalizeVietnameseText(input: string | null | undefined): string {
  if (!input) return "";

  // 1. Unicode NFC Normalization (Composed Form)
  let text = String(input).normalize("NFC");

  // 2. Fix broken combining marks / space-separated backtick or accent patterns
  // e.g. "bă `ng", "bă`ng", "bă `", "bă`" -> "bằng" / "băng"
  text = text
    .replace(/bă\s*[`']\s*ng/gi, "bằng")
    .replace(/bă\s*[`']/gi, "bằ")
    .replace(/a\s*[`']\s*/g, "à")
    .replace(/á\s*[`']\s*/g, "á")
    .replace(/â\s*[`']\s*/g, "ầ")
    .replace(/ă\s*[`']\s*/g, "ằ")
    .replace(/e\s*[`']\s*/g, "è")
    .replace(/ê\s*[`']\s*/g, "ề")
    .replace(/i\s*[`']\s*/g, "ì")
    .replace(/o\s*[`']\s*/g, "ò")
    .replace(/ô\s*[`']\s*/g, "ồ")
    .replace(/ơ\s*[`']\s*/g, "ờ")
    .replace(/u\s*[`']\s*/g, "ù")
    .replace(/ư\s*[`']\s*/g, "ừ")
    .replace(/y\s*[`']\s*/g, "ỳ");

  // Fix separated letter 'o' vs '0' in common math contexts like "bằng 0"
  text = text.replace(/bằng\s+[oO]\b/g, "bằng 0");

  // 3. Fix stray backticks right after Vietnamese vowels
  text = text.replace(/([aáàảãạăắằẳẵặâấầẩẫậeéèẻẽẹêếềểễệiíìỉĩịoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữựyýỳỷỹỵ])[`'](?=[a-z0-9\s])/gi, "$1");

  return text;
}
