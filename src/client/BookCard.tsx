import type { Book } from "./demo-books.ts";

type BookCardProps = {
  book: Book;
  completed: boolean;
};

export default function BookCard({ book, completed }: BookCardProps) {
  const showOwned = book.ownership === "owned";
  const showWishlist = book.ownership === "wishlist";
  const hasLabel = showOwned || showWishlist || completed;

  return (
    <article className="book-card">
      <p className="cover-placeholder">Pas de couverture</p>
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      {hasLabel && (
        <ul className="labels">
          {showOwned && <li>j’ai</li>}
          {showWishlist && <li>je veux</li>}
          {completed && <li>j’ai lu</li>}
        </ul>
      )}
    </article>
  );
}
