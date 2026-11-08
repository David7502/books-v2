export const OWNERSHIPS = ["owned", "wishlist", "none"] as const;

export type Ownership = (typeof OWNERSHIPS)[number];

export type BookInput = {
  title: string;
  author: string;
  ownership: Ownership;
};

const MAX_TEXT = 200;

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

  return {
    ok: true,
    book: {
      title,
      author,
      ownership: body.ownership as Ownership,
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
