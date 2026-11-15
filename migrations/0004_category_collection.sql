ALTER TABLE books ADD COLUMN category TEXT CHECK (
  category IS NULL OR category IN ('novel', 'essay', 'comic', 'philosophy', 'other')
);
ALTER TABLE books ADD COLUMN collection TEXT;
