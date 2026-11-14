import { z } from "zod";

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_MAX_QUERY = 200;

export const searchBooksInput = z.object({
  query: z.string().trim().max(SEARCH_MAX_QUERY).optional(),
  status: z.enum(["all", "owned", "read", "wishlist"]).optional(),
  limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
});

export type SearchBooksInput = z.infer<typeof searchBooksInput>;

export type SearchBook = {
  id: string;
  title: string;
  author: string;
  ownership: "owned" | "wishlist" | "none";
  read: boolean;
  readingStatus: "to_read" | "reading" | "read" | null;
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
};

export type SearchBooksResult = {
  total: number;
  books: SearchBook[];
};

type SearchRow = {
  id: string;
  title: string;
  author: string;
  ownership: string;
  reading_status: string | null;
  started_on: string | null;
  finished_on: string | null;
  rating: number | null;
};

const from = `
  FROM books
  LEFT JOIN readings ON readings.book_id = books.id
`;

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function filters(input: SearchBooksInput): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const query = input.query ?? "";
  if (query !== "") {
    const like = `%${escapeLike(query)}%`;
    clauses.push(
      "(books.title LIKE ? ESCAPE '\\' OR books.author LIKE ? ESCAPE '\\')",
    );
    params.push(like, like);
  }
  if (input.status === "owned" || input.status === "wishlist") {
    clauses.push("books.ownership = ?");
    params.push(input.status);
  }
  if (input.status === "read") {
    clauses.push("readings.status = ?");
    params.push("read");
  }
  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function toBook(row: SearchRow): SearchBook {
  const readingStatus =
    row.reading_status === "to_read" ||
    row.reading_status === "reading" ||
    row.reading_status === "read"
      ? row.reading_status
      : null;
  const ownership =
    row.ownership === "owned" || row.ownership === "wishlist" ? row.ownership : "none";
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    ownership,
    read: readingStatus === "read",
    readingStatus,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
    rating: row.rating,
  };
}

export async function searchBooks(
  db: D1Database,
  input: SearchBooksInput,
): Promise<SearchBooksResult> {
  const { where, params } = filters(input);
  const limit = input.limit ?? SEARCH_DEFAULT_LIMIT;
  const count = await db
    .prepare(`SELECT COUNT(*) AS total ${from} ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const list = await db
    .prepare(
      `SELECT
         books.id,
         books.title,
         books.author,
         books.ownership,
         readings.status AS reading_status,
         readings.started_on,
         readings.finished_on,
         readings.rating
       ${from}
       ${where}
       ORDER BY books.title COLLATE NOCASE, books.id
       LIMIT ?`,
    )
    .bind(...params, limit)
    .all<SearchRow>();
  return {
    total: count?.total ?? 0,
    books: list.results.map(toBook),
  };
}

function mark(book: SearchBook): string {
  const labels = [
    book.ownership === "owned" ? "j’ai" : null,
    book.ownership === "wishlist" ? "je veux" : null,
    book.read ? "j’ai lu" : null,
  ].filter((label) => label !== null);
  return labels.join(", ");
}

export function formatSearch(result: SearchBooksResult): string {
  const heading =
    result.total === 0
      ? "Aucun livre ne correspond."
      : result.total === 1
        ? "1 livre correspond."
        : `${result.total} livres correspondent.`;
  if (result.books.length === 0) {
    return heading;
  }
  const lines = result.books.map((book) => {
    const parts = [`${book.title} — ${book.author}`];
    const labels = mark(book);
    if (labels !== "") {
      parts.push(labels);
    }
    if (book.finishedOn) {
      parts.push(`terminé le ${book.finishedOn}`);
    } else if (book.startedOn) {
      parts.push(`commencé le ${book.startedOn}`);
    }
    if (book.rating !== null) {
      parts.push(`note ${book.rating}`);
    }
    return parts.join(" — ");
  });
  const shown =
    result.books.length < result.total
      ? `\n${result.books.length} ${result.books.length > 1 ? "affichés" : "affiché"} sur ${result.total}.`
      : "";
  return `${heading}\n${lines.join("\n")}${shown}`;
}
