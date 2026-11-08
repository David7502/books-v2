export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname === "" ? "/" : pathname;
}

export function readingBookId(path: string): string | null {
  const match = /^\/livres\/([^/]+)\/lecture$/.exec(normalizePath(path));
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export function editBookId(path: string): string | null {
  const match = /^\/livres\/([^/]+)\/modifier$/.exec(normalizePath(path));
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}
