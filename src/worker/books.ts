import { CATEGORIES, type BookCategory, type BookInput, type Ownership } from "./validate.ts";

export type BookRow = {
  id: string;
  title: string;
  author: string;
  ownership: string;
  category: string | null;
  collection: string | null;
  cover_key: string | null;
  completed: number;
};

export type StoredBook = {
  id: string;
  title: string;
  author: string;
  ownership: string;
  category: string | null;
  collection: string | null;
  coverKey: string | null;
  completed: boolean;
};

export const bookSelect = `
  SELECT
    books.id,
    books.title,
    books.author,
    books.ownership,
    books.category,
    books.collection,
    books.cover_key,
    EXISTS (
      SELECT 1 FROM readings
      WHERE readings.book_id = books.id AND readings.status = 'read'
    ) AS completed
  FROM books
`;

export function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function toBook(row: BookRow): StoredBook {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    ownership: row.ownership,
    category: row.category,
    collection: row.collection,
    coverKey: row.cover_key,
    completed: row.completed === 1,
  };
}

export async function storedBook(db: D1Database, id: string): Promise<BookRow | null> {
  return db.prepare(`${bookSelect} WHERE books.id = ?`).bind(id).first<BookRow>();
}

export async function findDuplicateBook(
  db: D1Database,
  title: string,
  author: string,
): Promise<StoredBook | null> {
  const titleKey = normalizeIdentity(title);
  const authorKey = normalizeIdentity(author);
  const rows = await db.prepare(bookSelect).bind().all<BookRow>();
  const match = rows.results.find(
    (row) =>
      normalizeIdentity(row.title) === titleKey && normalizeIdentity(row.author) === authorKey,
  );
  return match ? toBook(match) : null;
}

export async function insertStoredBook(
  db: D1Database,
  book: BookInput,
  read: boolean,
  coverKey: string | null,
): Promise<StoredBook | null> {
  const id = crypto.randomUUID();
  const statements = [
    db
      .prepare(
        `INSERT INTO books
          (id, title, author, ownership, category, collection, cover_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        book.title,
        book.author,
        book.ownership,
        book.category,
        book.collection,
        coverKey,
      ),
  ];
  if (read) {
    statements.push(
      db
        .prepare(
          `INSERT INTO readings
            (id, book_id, status, started_on, finished_on, location, rating)
           VALUES (?, ?, 'read', NULL, NULL, NULL, NULL)`,
        )
        .bind(crypto.randomUUID(), id),
    );
  }
  await db.batch(statements);
  const row = await storedBook(db, id);
  return row ? toBook(row) : null;
}

export function asOwnership(value: string): Ownership {
  return value === "owned" || value === "wishlist" ? value : "none";
}

export function asCategory(value: string | null): BookCategory | null {
  return value !== null && CATEGORIES.includes(value as BookCategory)
    ? (value as BookCategory)
    : null;
}
