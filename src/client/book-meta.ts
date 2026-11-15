import { CATEGORY_LABELS, type BookCategory } from "../worker/validate.ts";

export function bookMeta(book: {
  category?: string | null;
  collection?: string | null;
}): string | null {
  const category =
    book.category && book.category in CATEGORY_LABELS
      ? CATEGORY_LABELS[book.category as BookCategory]
      : null;
  const parts = [category, book.collection?.trim() ? book.collection.trim() : null].filter(
    (part) => part !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
