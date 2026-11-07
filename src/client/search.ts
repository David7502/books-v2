export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function bookMatchesQuery(
  book: { title: string; author: string },
  query: string,
): boolean {
  const needle = normalizeSearch(query);
  if (needle === "") {
    return true;
  }

  return (
    normalizeSearch(book.title).includes(needle) ||
    normalizeSearch(book.author).includes(needle)
  );
}

export function formatResultCount(count: number): string {
  if (count === 0) {
    return "Aucun livre";
  }
  if (count === 1) {
    return "1 livre";
  }
  return `${count} livres`;
}
