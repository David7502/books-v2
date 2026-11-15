import { bookMatchesQuery, normalizeSearch } from "./search.ts";

export const LIBRARY_FILTERS = ["all", "read", "wishlist", "owned"] as const;

export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export type CountedBook = {
  title: string;
  author: string;
  ownership: string;
  completed: boolean;
  category?: string | null;
  collection?: string | null;
};

const filterLabel: Record<LibraryFilter, string> = {
  all: "Tous",
  read: "Lu",
  wishlist: "Je veux",
  owned: "J’ai",
};

export function libraryFilterLabel(filter: LibraryFilter): string {
  return filterLabel[filter];
}

export function bookMatchesFilter(
  book: { ownership: string; completed: boolean },
  filter: LibraryFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "owned") {
    return book.ownership === "owned";
  }
  if (filter === "wishlist") {
    return book.ownership === "wishlist";
  }
  return book.completed;
}

export function libraryCounts(books: readonly { ownership: string; completed: boolean }[]) {
  return {
    all: books.length,
    read: books.filter((book) => book.completed).length,
    wishlist: books.filter((book) => book.ownership === "wishlist").length,
    owned: books.filter((book) => book.ownership === "owned").length,
  };
}

function bookMatchesCategory(book: CountedBook, category: string): boolean {
  if (category === "") {
    return true;
  }
  return book.category === category;
}

function bookMatchesCollection(book: CountedBook, collection: string): boolean {
  const needle = normalizeSearch(collection);
  if (needle === "") {
    return true;
  }
  return normalizeSearch(book.collection ?? "").includes(needle);
}

export function visibleLibraryBooks<T extends CountedBook>(
  books: readonly T[],
  query: string,
  filter: LibraryFilter,
  category = "",
  collection = "",
): T[] {
  return books.filter(
    (book) =>
      bookMatchesFilter(book, filter) &&
      bookMatchesQuery(book, query) &&
      bookMatchesCategory(book, category) &&
      bookMatchesCollection(book, collection),
  );
}

export function emptyLibraryMessage(
  filter: LibraryFilter,
  query: string,
  extra = "",
): string {
  const label = filterLabel[filter];
  const trimmed = query.trim();
  const detail = extra.trim();
  const scope = [filter === "all" ? "" : label, detail].filter((part) => part !== "").join(", ");
  if (trimmed !== "" && scope !== "") {
    return `Aucun livre pour ${scope} ne correspond à « ${trimmed} ».`;
  }
  if (trimmed !== "") {
    return "Aucun livre ne correspond à cette recherche.";
  }
  if (scope !== "") {
    return `Aucun livre pour ${scope}.`;
  }
  return `Aucun livre pour ${label}.`;
}
