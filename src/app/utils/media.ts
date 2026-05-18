/** Normalize DB `text[]`, JSON string, or single URL into a clean URL list. */
export function normalizeImageUrls(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return normalizeImageUrls(parsed);
      } catch {
        return [];
      }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      return s
        .slice(1, -1)
        .split(',')
        .map((x) => x.replace(/^"|"$/g, '').trim())
        .filter(Boolean);
    }
    return [s];
  }
  return [];
}

export const PLACEHOLDER_PRODUCT_IMG = 'assets/img/placeholder-product.svg';
export const PLACEHOLDER_STORE_IMG = 'assets/img/placeholder-store.svg';

/** Read a local file as `data:image/...;base64,...` for storing in DB (no object storage). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === 'string') {
        resolve(r);
      } else {
        reject(new Error('Could not read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
