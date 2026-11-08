INSERT INTO books (id, title, author, ownership, cover_key)
VALUES
  ('demo-brume', 'La brume du phare', 'Ada Quenelle', 'owned', NULL),
  ('demo-horloge', 'L''horloge sans aiguilles', 'Milo Sablier', 'wishlist', NULL),
  ('demo-jardin', 'Le jardin sous la gare', 'Nina Calebasse', 'none', NULL),
  ('demo-cartographe', 'Mémoires d''un cartographe distrait', 'Oscar Liseron', 'owned', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO readings (id, book_id, status)
VALUES
  ('demo-reading-brume', 'demo-brume', 'read'),
  ('demo-reading-jardin', 'demo-jardin', 'read')
ON CONFLICT (id) DO NOTHING;
