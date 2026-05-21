/**
 * Supabase Storage rejects keys containing non-ASCII or unsafe characters
 * (e.g. "ç", spaces). This sanitizer NFD-decomposes the string so accented
 * letters become base + combining mark, strips the combining marks, then
 * collapses anything outside [\w.-] into "_".
 *
 *   "Declaração 20.05.pdf" → "Declaracao_20.05.pdf"
 *   "exámen médico.PDF"    → "examen_medico.PDF"
 */
const COMBINING_MARKS = /[̀-ͯ]/g;
const UNSAFE_CHARS = /[^\w.\-]+/g;

export function sanitizeStorageKey(name: string): string {
  return name.normalize("NFD").replace(COMBINING_MARKS, "").replace(UNSAFE_CHARS, "_");
}
