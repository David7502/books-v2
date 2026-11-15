export const OWNERSHIPS = ["owned", "wishlist", "none"] as const;

export type Ownership = (typeof OWNERSHIPS)[number];

export const CATEGORIES = ["novel", "essay", "comic", "philosophy", "other"] as const;

export type BookCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<BookCategory, string> = {
  novel: "Roman",
  essay: "Essai",
  comic: "Bande dessinée",
  philosophy: "Philosophie",
  other: "Autre",
};

export const COLLECTION_MAX = 80;

export type BookInput = {
  title: string;
  author: string;
  ownership: Ownership;
  category: BookCategory | null;
  collection: string | null;
};

const MAX_TEXT = 200;

function parseCategory(
  value: unknown,
): { ok: true; category: BookCategory | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, category: null };
  }
  if (typeof value !== "string" || !CATEGORIES.includes(value as BookCategory)) {
    return { ok: false, error: "La catégorie n'est pas reconnue." };
  }
  return { ok: true, category: value as BookCategory };
}

function parseCollection(
  value: unknown,
): { ok: true; collection: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, collection: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "La collection doit être un texte." };
  }
  const collection = value.trim();
  if (collection === "") {
    return { ok: true, collection: null };
  }
  if (collection.length > COLLECTION_MAX) {
    return { ok: false, error: "La collection est limitée à 80 caractères." };
  }
  return { ok: true, collection };
}

export function validateBookInput(
  value: unknown,
): { ok: true; book: BookInput } | { ok: false; error: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Le corps doit être un objet JSON." };
  }

  const body = value as Record<string, unknown>;
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return { ok: false, error: "Indique un titre." };
  }
  if (typeof body.author !== "string" || body.author.trim() === "") {
    return { ok: false, error: "Indique un auteur." };
  }

  const title = body.title.trim();
  const author = body.author.trim();
  if (title.length > MAX_TEXT || author.length > MAX_TEXT) {
    return { ok: false, error: "Le titre et l'auteur sont limités à 200 caractères." };
  }
  if (!OWNERSHIPS.includes(body.ownership as Ownership)) {
    return { ok: false, error: "Le lien avec le livre n'est pas reconnu." };
  }
  const category = parseCategory(body.category);
  if (!category.ok) {
    return category;
  }
  const collection = parseCollection(body.collection);
  if (!collection.ok) {
    return collection;
  }

  return {
    ok: true,
    book: {
      title,
      author,
      ownership: body.ownership as Ownership,
      category: category.category,
      collection: collection.collection,
    },
  };
}

export function validateCreateBook(
  value: unknown,
): { ok: true; book: BookInput; read: boolean } | { ok: false; error: string } {
  const parsed = validateBookInput(value);
  if (!parsed.ok) {
    return parsed;
  }
  const read = (value as Record<string, unknown>).read;
  if (read === undefined || read === false) {
    return { ok: true, book: parsed.book, read: false };
  }
  if (read === true) {
    return { ok: true, book: parsed.book, read: true };
  }
  return { ok: false, error: "« J’ai lu » doit être oui ou non." };
}
