CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  ownership TEXT NOT NULL CHECK (ownership IN ('owned', 'wishlist', 'none')),
  cover_key TEXT
);

CREATE TABLE readings (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('to_read', 'reading', 'read')),
  FOREIGN KEY (book_id) REFERENCES books (id)
);
