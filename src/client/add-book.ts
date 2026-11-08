import type { Book, Ownership } from "./demo-books.ts";

export type NewBookInput = {
  title: string;
  author: string;
  ownership: Ownership;
  read?: boolean;
};

export type NewBookField = "title" | "author";

export function validateNewBook(draft: NewBookInput):
  | { ok: true; book: NewBookInput }
  | { ok: false; errors: NewBookField[] } {
  const title = draft.title.trim();
  const author = draft.author.trim();
  const errors: NewBookField[] = [];

  if (title === "") {
    errors.push("title");
  }
  if (author === "") {
    errors.push("author");
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    book: { title, author, ownership: draft.ownership, read: draft.read === true },
  };
}

export function createBook(input: NewBookInput, id: string): Book {
  return {
    id,
    title: input.title,
    author: input.author,
    ownership: input.ownership,
  };
}

export function appendBook(books: readonly Book[], book: Book): Book[] {
  return [...books, book];
}

export function replaceBook(
  books: readonly Book[],
  id: string,
  input: NewBookInput,
): Book[] {
  return books.map((book) =>
    book.id === id
      ? {
          ...book,
          title: input.title,
          author: input.author,
          ownership: input.ownership,
        }
      : book,
  );
}
