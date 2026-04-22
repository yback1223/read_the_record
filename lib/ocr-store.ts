// In-memory store for passing photo files from BookView to the OCR page
// within the same app session. Survives route navigation (module singleton)
// but not page reload.

const store = new Map<string, File[]>();

export function setOcrFiles(bookId: string, files: File[]): void {
  store.set(bookId, files);
}

export function consumeOcrFiles(bookId: string): File[] | null {
  const files = store.get(bookId);
  if (files) store.delete(bookId);
  return files ?? null;
}

export function peekOcrFiles(bookId: string): File[] | null {
  return store.get(bookId) ?? null;
}
