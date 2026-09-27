export const DRAFT_KEYS = ['invoice-kit-v3','invoice-kit-v2','wambur-rechnung-v3'];
export const STORAGE_CHOICE = 'invoice-kit-storage-enabled';
export function readDraft(storage, key='invoice-kit-v3') {
  for (const candidate of [key,...DRAFT_KEYS.filter(k => k !== key)]) {
    try { const value = JSON.parse(storage.getItem(candidate)); if (value && typeof value === 'object' && Array.isArray(value.items)) return value; } catch { /* Ältere oder beschädigte Daten überspringen. */ }
  }
  return null;
}
export function clearInvoiceData(storage) {
  const keys = Array.from({length:storage.length},(_,i) => storage.key(i));
  for (const key of keys) if (key?.startsWith('invoice-kit-') || /^wambur-rechnung-v\d+$/.test(key || '')) storage.removeItem(key);
}
