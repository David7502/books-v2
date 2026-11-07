import { useState } from "react";
import BookCard from "./BookCard.tsx";
import { demoBooks, hasCompletedReading } from "./demo-books.ts";
import { bookMatchesQuery, formatResultCount } from "./search.ts";

export default function App() {
  const [query, setQuery] = useState("");
  const visibleBooks = demoBooks.filter((book) => bookMatchesQuery(book, query));
  const empty = visibleBooks.length === 0;

  return (
    <main>
      <h1>Bibliothèque</h1>
      <p className="banner">
        Données de démonstration, inventées. Rien n'est enregistré. Les
        libellés et l'aspect des cartes sont provisoires.
      </p>
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="library-search">Rechercher un titre ou un auteur</label>
        <div className="search-row">
          <input
            id="library-search"
            type="search"
            value={query}
            aria-describedby={empty ? "search-count search-empty" : "search-count"}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
              }}
            >
              Effacer
            </button>
          )}
        </div>
      </form>
      <h2>Livres de démonstration</h2>
      <p id="search-count" role="status">
        {formatResultCount(visibleBooks.length)}
      </p>
      {empty ? (
        <p id="search-empty">
          Aucun livre de démonstration ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="book-list">
          {visibleBooks.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                completed={hasCompletedReading(book.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
