import type { ReactNode } from "react";
import type { Ownership } from "./demo-books.ts";

type BookCardProps = {
  book: {
    id: string;
    title: string;
    author: string;
    ownership: Ownership;
    coverKey: string | null;
  };
  completed: boolean;
  children?: ReactNode;
};

export default function BookCard({ book, completed, children }: BookCardProps) {
  const showOwned = book.ownership === "owned";
  const showWishlist = book.ownership === "wishlist";
  const hasLabel = showOwned || showWishlist || completed;

  return (
    <article className="book-card">
      {book.coverKey ? (
        <img
          className="cover"
          src={`/api/books/${encodeURIComponent(book.id)}/cover?v=${encodeURIComponent(book.coverKey)}`}
          alt={`Couverture de ${book.title}`}
        />
      ) : (
        <p className="cover-placeholder">Pas de couverture</p>
      )}
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      {hasLabel && (
        <ul className="labels">
          {showOwned && <li>j’ai</li>}
          {showWishlist && <li>je veux</li>}
          {completed && <li>j’ai lu</li>}
        </ul>
      )}
      {children}
    </article>
  );
}
