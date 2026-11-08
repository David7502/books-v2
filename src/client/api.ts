import type { Ownership } from "./demo-books.ts";
import type { NewBookInput } from "./add-book.ts";
import type { ReadingInput } from "../worker/validate-reading.ts";

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  ownership: Ownership;
  coverKey: string | null;
  completed: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim() !== "") {
      return body.error;
    }
  } catch {
    // The server did not return JSON.
  }
  return "Le serveur n'a pas pu répondre.";
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, "La requête n'a pas abouti.");
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
  return response;
}

export async function fetchBooks(): Promise<LibraryBook[]> {
  const response = await request("/api/books");
  const body = (await response.json()) as { books?: LibraryBook[] };
  return body.books ?? [];
}

export async function createBookWithCover(
  input: NewBookInput,
  cover: File,
): Promise<LibraryBook> {
  const form = new FormData();
  form.set("title", input.title);
  form.set("author", input.author);
  form.set("ownership", input.ownership);
  form.set("read", input.read === true ? "true" : "false");
  form.set("cover", cover);
  const response = await request("/api/books", { method: "POST", body: form });
  return (await response.json()) as LibraryBook;
}

export async function uploadCover(id: string, cover: File): Promise<LibraryBook> {
  const response = await request(`/api/books/${encodeURIComponent(id)}/cover`, {
    method: "PUT",
    headers: { "content-type": cover.type },
    body: cover,
  });
  return (await response.json()) as LibraryBook;
}

export async function createBook(input: NewBookInput): Promise<LibraryBook> {
  const response = await request("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      author: input.author,
      ownership: input.ownership,
      read: input.read === true,
    }),
  });
  return (await response.json()) as LibraryBook;
}

export type ReadingRecord = {
  id: string;
  bookId: string;
  status: ReadingInput["status"];
  startedOn: string | null;
  finishedOn: string | null;
  location: string | null;
  rating: number | null;
};

export async function fetchReading(
  bookId: string,
): Promise<{ book: LibraryBook; reading: ReadingRecord | null; ambiguous: boolean }> {
  const response = await request(
    `/api/books/${encodeURIComponent(bookId)}/reading`,
  );
  return (await response.json()) as {
    book: LibraryBook;
    reading: ReadingRecord | null;
    ambiguous: boolean;
  };
}

export async function saveReading(
  bookId: string,
  input: ReadingInput,
): Promise<{ book: LibraryBook; reading: ReadingRecord | null; ambiguous: boolean }> {
  const response = await request(
    `/api/books/${encodeURIComponent(bookId)}/reading`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return (await response.json()) as {
    book: LibraryBook;
    reading: ReadingRecord | null;
    ambiguous: boolean;
  };
}

export async function updateBook(
  id: string,
  input: NewBookInput,
): Promise<LibraryBook> {
  const response = await request(`/api/books/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      author: input.author,
      ownership: input.ownership,
    }),
  });
  return (await response.json()) as LibraryBook;
}
