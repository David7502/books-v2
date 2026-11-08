import { useEffect, useRef, useState, type MouseEvent } from "react";
import { type NewBookInput } from "./add-book.ts";
import { ApiError, createBook, fetchBooks, updateBook, type LibraryBook } from "./api.ts";
import BookCard from "./BookCard.tsx";
import BookForm from "./BookForm.tsx";
import { editBookId, readingBookId } from "./path.ts";
import ReadingsPage from "./ReadingsPage.tsx";
import {
  emptyLibraryMessage,
  libraryCounts,
  libraryFilterLabel,
  LIBRARY_FILTERS,
  type LibraryFilter,
  visibleLibraryBooks,
} from "./library-filter.ts";
import { formatResultCount } from "./search.ts";
import { usePath } from "./use-path.ts";

type Navigate = (to: string) => void;

type Notice = {
  kind: "added" | "updated" | "reading";
  id: string;
  viewReset: "search" | "filter" | "both" | null;
};

const emptyBook: NewBookInput = {
  title: "",
  author: "",
  ownership: "none",
};

const memoryNote =
  "Ceci est enregistré dans la base locale. Un rechargement le garde. Rien n'est envoyé chez Cloudflare.";

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

function pageTitle(
  path: string,
  editing: LibraryBook | null,
  editingId: string | null,
): string {
  if (path === "/") {
    return "Bibliothèque";
  }
  if (path === "/ajouter") {
    return "Ajouter un livre — Bibliothèque";
  }
  if (readingBookId(path)) {
    return "Lecture — Bibliothèque";
  }
  if (editingId) {
    return editing
      ? "Modifier un livre — Bibliothèque"
      : "Livre introuvable — Bibliothèque";
  }
  return "Page introuvable — Bibliothèque";
}

export default function App() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [path, navigate] = usePath();
  const loadGeneration = useRef(0);
  const visibleBooks = visibleLibraryBooks(books, query, filter);
  const counts = libraryCounts(books);
  const empty = visibleBooks.length === 0;
  const readingId = readingBookId(path);
  const editingId = editBookId(path);
  const editing = editingId
    ? (books.find((book) => book.id === editingId) ?? null)
    : null;
  const noticed = notice
    ? (books.find((book) => book.id === notice.id) ?? null)
    : null;

  useEffect(() => {
    document.title = pageTitle(path, editing, editingId);
    document.getElementById("page-title")?.focus();
  }, [path, editing, editingId]);

  async function loadBooks() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await fetchBooks();
      if (generation !== loadGeneration.current) {
        return;
      }
      setBooks(next);
      setLoading(false);
    } catch (error) {
      if (generation !== loadGeneration.current) {
        return;
      }
      setLoadError(
        error instanceof ApiError ? error.message : "La liste n'a pas pu être lue.",
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBooks();
  }, []);

  function remember(kind: Notice["kind"], id: string) {
    const hadSearch = query.trim() !== "";
    const hadFilter = filter !== "all";
    setNotice({
      kind,
      id,
      viewReset: hadSearch && hadFilter ? "both" : hadSearch ? "search" : hadFilter ? "filter" : null,
    });
    setQuery("");
    setFilter("all");
    navigate("/");
  }

  async function addBook(input: NewBookInput) {
    loadGeneration.current += 1;
    const book = await createBook(input);
    setBooks((previous) => [...previous.filter((item) => item.id !== book.id), book]);
    setLoadError(null);
    setLoading(false);
    remember("added", book.id);
  }

  async function saveBook(id: string, input: NewBookInput) {
    loadGeneration.current += 1;
    const book = await updateBook(id, input);
    setBooks((previous) => previous.map((item) => (item.id === book.id ? book : item)));
    setLoadError(null);
    setLoading(false);
    remember("updated", id);
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
        <BookForm
          initial={emptyBook}
          submitLabel="Ajouter"
          note={memoryNote}
          showRead
          onSubmitBook={addBook}
        />
      </main>
    );
  }

  if (readingId) {
    return (
      <ReadingsPage
        bookId={readingId}
        navigate={navigate}
        onSaved={async (savedBook) => {
          loadGeneration.current += 1;
          setBooks((previous) => {
            const exists = previous.some((item) => item.id === savedBook.id);
            if (!exists) {
              return [...previous, savedBook];
            }
            return previous.map((item) =>
              item.id === savedBook.id ? savedBook : item,
            );
          });
          setLoading(false);
          setLoadError(null);
          remember("reading", savedBook.id);
        }}
      />
    );
  }

  if (editingId) {
    if (loading) {
      return (
        <main>
          <h1 id="page-title" tabIndex={-1}>
            Modifier un livre
          </h1>
          <p>Chargement des livres…</p>
        </main>
      );
    }
    if (loadError) {
      return (
        <main>
          <h1 id="page-title" tabIndex={-1}>
            Modifier un livre
          </h1>
          <p>{loadError}</p>
          <button type="button" className="show-all" onClick={() => void loadBooks()}>
            Réessayer
          </button>
        </main>
      );
    }
    if (!editing) {
      return (
        <main>
          <h1 id="page-title" tabIndex={-1}>
            Livre introuvable
          </h1>
          <p>
            Ce livre n'est pas dans la base locale.
          </p>
          <PageLink href="/" className="back-link" navigate={navigate}>
            Retour à la bibliothèque
          </PageLink>
        </main>
      );
    }

    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Modifier un livre
        </h1>
        <PageLink href="/" className="back-link" navigate={navigate}>
          Annuler et revenir à la bibliothèque
        </PageLink>
        <BookForm
          key={editing.id}
          initial={{
            title: editing.title,
            author: editing.author,
            ownership: editing.ownership,
          }}
          submitLabel="Enregistrer"
          note={memoryNote}
          onSubmitBook={(input) => saveBook(editing.id, input)}
        />
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
        Ces livres sont enregistrés dans la base locale de cet ordinateur. Ils
        restent après un rechargement et après un redémarrage du serveur de
        développement. Ils ne sont pas copiés sur un autre ordinateur, ni chez
        Cloudflare. Ne déploie pas cette application tant que l'accès n'est pas
        protégé. Les libellés et l'aspect sont provisoires.
      </p>
      <p className="home-actions">
        <PageLink href="/ajouter" className="add-link" navigate={navigate}>
          Ajouter un livre
        </PageLink>
      </p>
      {!loading && !loadError ? (
        <div className="filters" role="group" aria-label="Filtres de la bibliothèque">
          {LIBRARY_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
              }}
            >
              {libraryFilterLabel(value)}, {counts[value]}
            </button>
          ))}
        </div>
      ) : null}
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
      {noticed && notice && (
        <p id="add-status" role="status">
          {notice.kind === "added"
            ? noticed.completed
              ? `« ${noticed.title} » est ajouté, avec une fiche Terminé.`
              : `« ${noticed.title} » est ajouté. Il n'a pas encore de lecture.`
            : notice.kind === "reading"
              ? `Lecture enregistrée pour « ${noticed.title} ».`
              : `Modification enregistrée : « ${noticed.title} ».`}
          {notice.viewReset === "both"
            ? " La recherche et le filtre ont été remis sur Tous pour l'afficher."
            : notice.viewReset === "search"
              ? " La recherche a été effacée pour l'afficher."
              : notice.viewReset === "filter"
                ? " Le filtre a été remis sur Tous pour l'afficher."
                : ""}
        </p>
      )}
      <h2>Livres</h2>
      {loading ? <p>Chargement des livres…</p> : null}
      {loadError ? (
        <p>
          {loadError}{" "}
          <button type="button" className="show-all" onClick={() => void loadBooks()}>
            Réessayer
          </button>
        </p>
      ) : null}
      {!loading && !loadError ? (
        <p id="search-count" role="status">
          {formatResultCount(visibleBooks.length)}
        </p>
      ) : null}
      {!loading && !loadError && books.length === 0 ? (
        <p>Aucun livre pour l'instant. Utilise Ajouter un livre.</p>
      ) : null}
      {!loading && !loadError && books.length > 0 && empty ? (
        <p id="search-empty">
          {emptyLibraryMessage(filter, query)}{" "}
          <button
            type="button"
            className="show-all"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Revenir à Tous
          </button>
        </p>
      ) : null}
      {!loading && !loadError && !empty ? (
        <ul className="book-list">
          {visibleBooks.map((book) => (
            <li key={book.id}>
              <BookCard book={book} completed={book.completed}>
                <span className="card-actions">
                  <PageLink
                    href={`/livres/${encodeURIComponent(book.id)}/modifier`}
                    className="edit-link"
                    navigate={navigate}
                  >
                    Modifier
                  </PageLink>
                  <PageLink
                    href={`/livres/${encodeURIComponent(book.id)}/lecture`}
                    className="edit-link"
                    navigate={navigate}
                  >
                    Lecture
                  </PageLink>
                </span>
              </BookCard>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
