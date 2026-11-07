import { useState } from "react";
import AddBookForm from "./AddBookForm.tsx";
import { appendBook, createBook, type NewBookInput } from "./add-book.ts";
import BookCard from "./BookCard.tsx";
import { demoBooks, hasCompletedReading } from "./demo-books.ts";
import { bookMatchesQuery, formatResultCount } from "./search.ts";

export default function App() {
  const [books, setBooks] = useState(() => [...demoBooks]);
  const [query, setQuery] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const visibleBooks = books.filter((book) => bookMatchesQuery(book, query));
  const empty = visibleBooks.length === 0;
  const added = books.find((book) => book.id === addedId) ?? null;
  const addedHidden = added ? !bookMatchesQuery(added, query) : false;

  function addBook(input: NewBookInput) {
    const book = createBook(input, crypto.randomUUID());
    setBooks((previous) => appendBook(previous, book));
    setAddedId(book.id);
  }

  return (
    <main>
      <h1>Bibliothèque</h1>
      <p className="banner">
        Les quatre livres du départ sont inventés. Un livre que tu ajoutes
        reste seulement dans cette page et disparaît au rechargement. Rien
        n'est envoyé. Les libellés et l'aspect sont provisoires.
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
      <AddBookForm onAdd={addBook} />
      {added && (
        <p id="add-status" role="status">
          « {added.title} » est ajouté pour cette visite.
          {addedHidden
            ? " La recherche en cours ne l'affiche pas."
            : " Il n'a pas encore de lecture."}
        </p>
      )}
      {addedHidden && (
        <button
          type="button"
          className="show-all"
          onClick={() => {
            setQuery("");
          }}
        >
          Afficher tous les livres
        </button>
      )}
      <h2>Livres</h2>
      <p id="search-count" role="status">
        {formatResultCount(visibleBooks.length)}
      </p>
      {empty ? (
        <p id="search-empty">Aucun livre ne correspond à cette recherche.</p>
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
