import { guardApi } from "./access.ts";
import { validateCoverBytes, type CoverType } from "./validate-cover.ts";
import { validateReadingInput } from "./validate-reading.ts";
import { validateBookInput, validateCreateBook } from "./validate.ts";

const MAX_BODY_BYTES = 4096;

type BookRow = {
  id: string;
  title: string;
  author: string;
  ownership: string;
  cover_key: string | null;
  completed: number;
};

const bookSelect = `
  SELECT
    books.id,
    books.title,
    books.author,
    books.ownership,
    books.cover_key,
    EXISTS (
      SELECT 1 FROM readings
      WHERE readings.book_id = books.id AND readings.status = 'read'
    ) AS completed
  FROM books
`;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function toBook(row: BookRow) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    ownership: row.ownership,
    coverKey: row.cover_key,
    completed: row.completed === 1,
  };
}

async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, response: jsonError("Le contenu doit être du JSON.", 400) };
  }

  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError("Le message est trop grand.", 400) };
  }
  if (!request.body) {
    return { ok: false, response: jsonError("Le corps est vide.", 400) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, response: jsonError("Le message est trop grand.", 400) };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: jsonError("Le JSON n'est pas lisible.", 400) };
  }
}

async function listBooks(db: D1Database): Promise<Response> {
  const result = await db
    .prepare(`${bookSelect} ORDER BY books.title COLLATE NOCASE, books.id`)
    .all<BookRow>();
  return Response.json({ books: result.results.map(toBook) });
}

async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; response: Response }> {
  const declared = request.headers.get("content-length");
  if (declared === null || !/^\d+$/.test(declared)) {
    return {
      ok: false,
      response: jsonError("La taille de l'image doit être annoncée.", 400),
    };
  }
  if (Number(declared) > maxBytes) {
    return { ok: false, response: jsonError("L'image dépasse 2 Mo.", 400) };
  }
  if (!request.body) {
    return { ok: false, response: jsonError("L'image est vide.", 400) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, response: jsonError("L'image dépasse 2 Mo.", 400) };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

async function storedBook(db: D1Database, id: string): Promise<BookRow | null> {
  return db.prepare(`${bookSelect} WHERE books.id = ?`).bind(id).first<BookRow>();
}

async function insertStoredBook(
  db: D1Database,
  book: { title: string; author: string; ownership: string },
  read: boolean,
  coverKey: string | null,
): Promise<Response> {
  const id = crypto.randomUUID();
  const statements = [
    db
      .prepare(
        "INSERT INTO books (id, title, author, ownership, cover_key) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, book.title, book.author, book.ownership, coverKey),
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
  if (!row) {
    return jsonError("Le serveur n'a pas pu répondre.", 500);
  }
  return Response.json(toBook(row), { status: 201 });
}

async function putCover(
  bucket: R2Bucket,
  bytes: Uint8Array,
  contentType: CoverType,
): Promise<string> {
  const key = `covers/${crypto.randomUUID()}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  return key;
}

async function discardCover(bucket: R2Bucket, key: string): Promise<void> {
  try {
    await bucket.delete(key);
  } catch {
    // An unreferenced object can remain. The cover still shown is not removed.
  }
}

async function insertBook(db: D1Database, bucket: R2Bucket, request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return insertBookWithCover(db, bucket, request);
  }

  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  const parsed = validateCreateBook(body.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }
  try {
    return await insertStoredBook(db, parsed.book, parsed.read, null);
  } catch {
    return jsonError("Le livre n'a pas été enregistré.", 500);
  }
}

async function insertBookWithCover(
  db: D1Database,
  bucket: R2Bucket,
  request: Request,
): Promise<Response> {
  const declared = request.headers.get("content-length");
  if (declared === null || !/^\d+$/.test(declared)) {
    return jsonError("La taille de l'image doit être annoncée.", 400);
  }
  if (Number(declared) > 2 * 1024 * 1024 + 65536) {
    return jsonError("L'image dépasse 2 Mo.", 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Le formulaire n'est pas lisible.", 400);
  }

  const readField = form.get("read");
  const parsed = validateCreateBook({
    title: form.get("title"),
    author: form.get("author"),
    ownership: form.get("ownership"),
    read: readField === "true" ? true : readField === "false" || readField === null ? false : readField,
  });
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const file = form.get("cover");
  if (!(file instanceof File) || (file.size === 0 && file.name === "")) {
    try {
      return await insertStoredBook(db, parsed.book, parsed.read, null);
    } catch {
      return jsonError("Le livre n'a pas été enregistré.", 500);
    }
  }

  if (file.size > 2 * 1024 * 1024) {
    return jsonError("L'image dépasse 2 Mo.", 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const cover = validateCoverBytes(bytes, file.type);
  if (!cover.ok) {
    return jsonError(cover.error, 400);
  }

  let key: string;
  try {
    key = await putCover(bucket, bytes, cover.contentType);
  } catch {
    return jsonError("La couverture n'a pas été enregistrée.", 500);
  }

  try {
    return await insertStoredBook(db, parsed.book, parsed.read, key);
  } catch {
    await discardCover(bucket, key);
    return jsonError("Le livre n'a pas été enregistré.", 500);
  }
}

async function replaceCover(
  db: D1Database,
  bucket: R2Bucket,
  request: Request,
  bookId: string,
): Promise<Response> {
  const current = await db
    .prepare("SELECT id, cover_key FROM books WHERE id = ?")
    .bind(bookId)
    .first<{ id: string; cover_key: string | null }>();
  if (!current) {
    return jsonError("Ce livre n'existe pas.", 404);
  }

  const body = await readBoundedBytes(request, 2 * 1024 * 1024);
  if (!body.ok) {
    return body.response;
  }
  const cover = validateCoverBytes(body.bytes, request.headers.get("content-type"));
  if (!cover.ok) {
    return jsonError(cover.error, 400);
  }

  let key: string;
  try {
    key = await putCover(bucket, body.bytes, cover.contentType);
  } catch {
    return jsonError("La couverture n'a pas été enregistrée.", 500);
  }

  try {
    const update = await db
      .prepare("UPDATE books SET cover_key = ? WHERE id = ?")
      .bind(key, bookId)
      .run();
    if ((update.meta.changes ?? 0) === 0) {
      await discardCover(bucket, key);
      return jsonError("Ce livre n'existe pas.", 404);
    }
  } catch {
    await discardCover(bucket, key);
    return jsonError("La couverture n'a pas été enregistrée.", 500);
  }

  if (current.cover_key && current.cover_key !== key) {
    await discardCover(bucket, current.cover_key);
  }

  const row = await storedBook(db, bookId);
  if (!row) {
    return jsonError("Ce livre n'existe pas.", 404);
  }
  return Response.json(toBook(row));
}

async function readCover(db: D1Database, bucket: R2Bucket, bookId: string): Promise<Response> {
  const row = await db
    .prepare("SELECT cover_key FROM books WHERE id = ?")
    .bind(bookId)
    .first<{ cover_key: string | null }>();
  if (!row) {
    return jsonError("Ce livre n'existe pas.", 404);
  }
  if (!row.cover_key) {
    return jsonError("Ce livre n'a pas de couverture.", 404);
  }

  const object = await bucket.get(row.cover_key);
  if (!object || !("body" in object) || !object.body) {
    return jsonError("La couverture est introuvable.", 404);
  }
  const contentType = object.httpMetadata?.contentType;
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
    return jsonError("La couverture est introuvable.", 404);
  }

  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=86400",
    },
  });
}

async function updateBook(db: D1Database, request: Request, id: string): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  const parsed = validateBookInput(body.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const update = await db
    .prepare("UPDATE books SET title = ?, author = ?, ownership = ? WHERE id = ?")
    .bind(parsed.book.title, parsed.book.author, parsed.book.ownership, id)
    .run();
  if ((update.meta.changes ?? 0) === 0) {
    return jsonError("Ce livre n'existe pas.", 404);
  }

  const row = await db
    .prepare(`${bookSelect} WHERE books.id = ?`)
    .bind(id)
    .first<BookRow>();
  if (!row) {
    return jsonError("Ce livre n'existe pas.", 404);
  }
  return Response.json(toBook(row));
}

type ReadingRow = {
  id: string;
  book_id: string;
  status: string;
  started_on: string | null;
  finished_on: string | null;
  location: string | null;
  rating: number | null;
};

function toReading(row: ReadingRow) {
  return {
    id: row.id,
    bookId: row.book_id,
    status: row.status,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
    location: row.location,
    rating: row.rating,
  };
}

async function bookExists(db: D1Database, bookId: string): Promise<boolean> {
  const row = await db.prepare("SELECT id FROM books WHERE id = ?").bind(bookId).first<{ id: string }>();
  return row !== null;
}

const readingSelect = `
  SELECT id, book_id, status, started_on, finished_on, location, rating
  FROM readings
  WHERE book_id = ?
  ORDER BY id
`;

async function readReadingSheet(db: D1Database, bookId: string): Promise<Response> {
  const book = await db.prepare(`${bookSelect} WHERE books.id = ?`).bind(bookId).first<BookRow>();
  if (!book) {
    return jsonError("Ce livre n'existe pas.", 404);
  }
  const rows = await db.prepare(readingSelect).bind(bookId).all<ReadingRow>();
  if (rows.results.length > 1) {
    return Response.json({
      book: toBook(book),
      reading: null,
      ambiguous: true,
    });
  }
  return Response.json({
    book: toBook(book),
    reading: rows.results[0] ? toReading(rows.results[0]) : null,
    ambiguous: false,
  });
}

async function saveReadingSheet(
  db: D1Database,
  request: Request,
  bookId: string,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return body.response;
  }
  const parsed = validateReadingInput(body.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }
  if (!(await bookExists(db, bookId))) {
    return jsonError("Ce livre n'existe pas.", 404);
  }

  const existing = await db.prepare(readingSelect).bind(bookId).all<ReadingRow>();
  if (existing.results.length > 1) {
    return jsonError(
      "Plusieurs fiches existent déjà pour ce livre. Aucune n'a été modifiée.",
      409,
    );
  }

  const reading = parsed.reading;
  if (existing.results.length === 1) {
    const id = existing.results[0].id;
    await db
      .prepare(
        `UPDATE readings
         SET status = ?, started_on = ?, finished_on = ?, location = ?, rating = ?
         WHERE id = ? AND book_id = ?`,
      )
      .bind(
        reading.status,
        reading.startedOn,
        reading.finishedOn,
        reading.location,
        reading.rating,
        id,
        bookId,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO readings
          (id, book_id, status, started_on, finished_on, location, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        bookId,
        reading.status,
        reading.startedOn,
        reading.finishedOn,
        reading.location,
        reading.rating,
      )
      .run();
  }

  return readReadingSheet(db, bookId);
}

async function route(request: Request, env: Env): Promise<Response> {
  const denied = await guardApi(request, env);
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    return Response.json({ ok: true });
  }

  if (url.pathname === "/api/books" && request.method === "GET") {
    return listBooks(env.DB);
  }
  if (url.pathname === "/api/books" && request.method === "POST") {
    return insertBook(env.DB, env.COVERS, request);
  }

  const coverMatch = /^\/api\/books\/([^/]+)\/cover$/.exec(url.pathname);
  if (coverMatch && request.method === "GET") {
    return readCover(env.DB, env.COVERS, decodeURIComponent(coverMatch[1]));
  }
  if (coverMatch && request.method === "PUT") {
    return replaceCover(env.DB, env.COVERS, request, decodeURIComponent(coverMatch[1]));
  }

  const readingMatch = /^\/api\/books\/([^/]+)\/reading$/.exec(url.pathname);
  if (readingMatch && request.method === "GET") {
    return readReadingSheet(env.DB, decodeURIComponent(readingMatch[1]));
  }
  if (readingMatch && request.method === "PUT") {
    return saveReadingSheet(env.DB, request, decodeURIComponent(readingMatch[1]));
  }

  const updateMatch = /^\/api\/books\/([^/]+)$/.exec(url.pathname);
  if (updateMatch && request.method === "PUT") {
    return updateBook(env.DB, request, decodeURIComponent(updateMatch[1]));
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonError("Cette adresse n'existe pas.", 404);
  }

  return new Response(null, { status: 404 });
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          name: error instanceof Error ? error.name : "Error",
        }),
      );
      return jsonError("Le serveur n'a pas pu répondre.", 500);
    }
  },
} satisfies ExportedHandler<Env>;
