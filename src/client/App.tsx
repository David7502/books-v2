import BookCard from "./BookCard.tsx";
import { demoBooks } from "./demo-books.ts";

export default function App() {
  return (
    <main>
      <h1>Bibliothèque</h1>
      <p className="banner">
        Données de démonstration. Rien n'est enregistré : ces livres n'existent
        que dans le fichier de démo.
      </p>
      <h2>Livres de démonstration</h2>
      <ul className="book-list">
        {demoBooks.map((book) => (
          <li key={book.id}>
            <BookCard book={book} />
          </li>
        ))}
      </ul>
    </main>
  );
}
