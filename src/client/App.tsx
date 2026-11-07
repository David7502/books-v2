import BookCard from "./BookCard.tsx";
import { demoBooks, hasCompletedReading } from "./demo-books.ts";

export default function App() {
  return (
    <main>
      <h1>Bibliothèque</h1>
      <p className="banner">
        Données de démonstration, inventées. Rien n'est enregistré. Les
        libellés et l'aspect des cartes sont provisoires.
      </p>
      <h2>Livres de démonstration</h2>
      <ul className="book-list">
        {demoBooks.map((book) => (
          <li key={book.id}>
            <BookCard
              book={book}
              completed={hasCompletedReading(book.id)}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
