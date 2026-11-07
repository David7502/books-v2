import { useEffect, useState, type MouseEvent } from "react";
import AddBookForm from "./AddBookForm.tsx";
import { appendBook, createBook, type NewBookInput } from "./add-book.ts";
import BookCard from "./BookCard.tsx";
import { demoBooks, hasCompletedReading } from "./demo-books.ts";
import { bookMatchesQuery, formatResultCount } from "./search.ts";
import { usePath } from "./use-path.ts";

type Navigate = (to: string) => void;

function PageLink({
  href,
  className,
  navigate,
  children,
}: {
  href: string;
  className: string;
  navigate: Navigate;
  children: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}

export default function App() {
  const [books, setBooks] = useState(() => [...demoBooks]);
  const [query, setQuery] = useState("");
  const [addedId, setAddedId] = useState<string | null>(null);
  const [searchCleared, setSearchCleared] = useState(false);
  const [path, navigate] = usePath();
  const visibleBooks = books.filter((book) => bookMatchesQuery(book, query));
  const empty = visibleBooks.length === 0;
  const added = books.find((book) => book.id === addedId) ?? null;

  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Bibliothèque",
      "/ajouter": "Ajouter un livre — Bibliothèque",
    };
    document.title = titles[path] ?? "Page introuvable — Bibliothèque";
    document.getElementById("page-title")?.focus();
  }, [path]);

  function addBook(input: NewBookInput) {
    const book = createBook(input, crypto.randomUUID());
    setBooks((previous) => appendBook(previous, book));
    setAddedId(book.id);
    setSearchCleared(query.trim() !== "");
    setQuery("");
    navigate("/");
  }

  if (path === "/ajouter") {
    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Ajouter un livre
        </h1>
        <PageLink href="/" className="back-link" navigate={navigate}>
          Annuler et revenir à la bibliothèque
        </PageLink>
        <AddBookForm onAdd={addBook} />
      </main>
    );
  }

  if (path !== "/") {
    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Page introuvable
        </h1>
        <p>Cette adresse n'existe pas.</p>
        <PageLink href="/" className="back-link" navigate={navigate}>
          Retour à la bibliothèque
        </PageLink>
      </main>
    );
  }

  return (
    <main>
      <h1 id="page-title" tabIndex={-1}>
        Bibliothèque
      </h1>
      <p className="banner">
        Les quatre livres du départ sont inventés. Un livre que tu ajoutes
        reste dans la mémoire de cette visite et disparaît au rechargement.
        Rien n'est envoyé. Les libellés et l'aspect sont provisoires.
      </p>
      <p className="home-actions">
        <PageLink href="/ajouter" className="add-link" navigate={navigate}>
          Ajouter un livre
        </PageLink>
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
      {added && (
        <p id="add-status" role="status">
          « {added.title} » est ajouté pour cette visite. Il n'a pas encore de
          lecture.
          {searchCleared ? " La recherche a été effacée pour l'afficher." : ""}
        </p>
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
