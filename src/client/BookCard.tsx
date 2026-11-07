import type { Book, Ownership } from "./demo-books.ts";

const ownershipLabel: Record<Ownership, string> = {
  owned: "Possédé",
  wishlist: "Liste d'achat",
  none: "Ni possédé, ni sur la liste d'achat",
};

type BookCardProps = {
  book: Book;
};

export default function BookCard({ book }: BookCardProps) {
  return (
    <article className="book-card">
      <p className="cover-placeholder">Pas de couverture</p>
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      <p className="ownership">{ownershipLabel[book.ownership]}</p>
    </article>
  );
}
