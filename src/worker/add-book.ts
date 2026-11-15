import { z } from "zod";
import {
  asCategory,
  asOwnership,
  findDuplicateBook,
  insertStoredBook,
  type StoredBook,
} from "./books.ts";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLLECTION_MAX,
  validateCreateBook,
} from "./validate.ts";

const MAX_TEXT = 200;

export const ADD_BOOK_OWNERSHIP_ERROR =
  "« none » n'est pas accepté. Le lien doit être owned (j’ai) ou wishlist (je veux).";

export const addBookInput = z.object({
  title: z.string().trim().min(1).max(MAX_TEXT),
  author: z.string().trim().min(1).max(MAX_TEXT),
  ownership: z.enum(["owned", "wishlist"], { error: ADD_BOOK_OWNERSHIP_ERROR }).optional(),
  read: z.boolean().optional(),
  category: z.enum(CATEGORIES).optional(),
  collection: z.string().trim().max(COLLECTION_MAX).optional(),
});

export type AddBookInput = z.infer<typeof addBookInput>;

export type AddedBook = {
  id: string;
  title: string;
  author: string;
  ownership: "owned" | "wishlist" | "none";
  category: (typeof CATEGORIES)[number] | null;
  collection: string | null;
  read: boolean;
};

export type AddBookResult =
  | { ok: true; created: boolean; book: AddedBook }
  | { ok: false; error: string };

function view(book: StoredBook): AddedBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    ownership: asOwnership(book.ownership),
    category: asCategory(book.category),
    collection: book.collection,
    read: book.completed,
  };
}

export async function addBook(db: D1Database, input: AddBookInput): Promise<AddBookResult> {
  const parsed = validateCreateBook({
    title: input.title,
    author: input.author,
    ownership: input.ownership ?? "wishlist",
    category: input.category ?? null,
    collection: input.collection ?? null,
    read: input.read ?? false,
  });
  if (!parsed.ok) {
    return parsed;
  }
  const existing = await findDuplicateBook(db, parsed.book.title, parsed.book.author);
  if (existing) {
    return { ok: true, created: false, book: view(existing) };
  }
  const stored = await insertStoredBook(db, parsed.book, parsed.read, null);
  if (!stored) {
    return { ok: false, error: "Le livre n'a pas été enregistré." };
  }
  return { ok: true, created: true, book: view(stored) };
}

export function formatAdd(result: { created: boolean; book: AddedBook }): string {
  const book = result.book;
  const head = result.created
    ? `« ${book.title} » de ${book.author} est ajouté.`
    : `« ${book.title} » de ${book.author} est déjà dans la bibliothèque. Rien n'a été ajouté.`;
  const details = [
    book.ownership === "owned" ? "j’ai" : null,
    book.ownership === "wishlist" ? "je veux" : null,
    book.read ? "j’ai lu" : null,
    book.category ? CATEGORY_LABELS[book.category] : null,
    book.collection,
  ].filter((part) => part !== null);
  if (details.length === 0) {
    return head;
  }
  return `${head}\n${details.join(", ")}.`;
}
