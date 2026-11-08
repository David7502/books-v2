import { useEffect, useState, type MouseEvent } from "react";
import { appendBook, createBook, replaceBook, type NewBookInput } from "./add-book.ts";
import BookCard from "./BookCard.tsx";
import BookForm from "./BookForm.tsx";
import { demoBooks, hasCompletedReading, type Book } from "./demo-books.ts";
import { editBookId } from "./path.ts";
import { bookMatchesQuery, formatResultCount } from "./search.ts";
import { usePath } from "./use-path.ts";

type Navigate = (to: string) => void;

type Notice = {
  kind: "added" | "updated";
  id: string;
  searchCleared: boolean;
};

const emptyBook: NewBookInput = {
  title: "",
  author: "",
  ownership: "none",
};

const memoryNote =
  "Ceci reste dans la mémoire de cette visite. Un rechargement l'efface. Rien n'est envoyé.";

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

function pageTitle(path: string, editing: Book | null, editingId: string | null): string {
  if (path === "/") {
    return "Bibliothèque";
  }
  if (path === "/ajouter") {
    return "Ajouter un livre — Bibliothèque";
  }
  if (editingId) {
    return editing
      ? "Modifier un livre — Bibliothèque"
      : "Livre introuvable — Bibliothèque";
  }
  return "Page introuvable — Bibliothèque";
}

export default function App() {
  const [books, setBooks] = useState(() => [...demoBooks]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [path, navigate] = usePath();
  const visibleBooks = books.filter((book) => bookMatchesQuery(book, query));
  const empty = visibleBooks.length === 0;
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

  function remember(kind: Notice["kind"], id: string) {
    setNotice({
      kind,
      id,
      searchCleared: query.trim() !== "",
    });
    setQuery("");
    navigate("/");
  }

  function addBook(input: NewBookInput) {
    const book = createBook(input, crypto.randomUUID());
    setBooks((previous) => appendBook(previous, book));
    remember("added", book.id);
  }

  function saveBook(id: string, input: NewBookInput) {
    setBooks((previous) => replaceBook(previous, id, input));
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
          onSubmitBook={addBook}
        />
      </main>
    );
  }

  if (editingId) {
    if (!editing) {
      return (
        <main>
          <h1 id="page-title" tabIndex={-1}>
            Livre introuvable
          </h1>
          <p>
            Ce livre n'est pas dans la liste de cette visite. Un rechargement
            retire les livres ajoutés ici.
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
          onSubmitBook={(input) => {
            saveBook(editing.id, input);
          }}
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
        Les quatre livres du départ sont inventés. Un livre que tu ajoutes ou
        modifies reste dans la mémoire de cette visite et disparaît au
        rechargement. Rien n'est envoyé. Les libellés et l'aspect sont
        provisoires.
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
      {noticed && notice && (
        <p id="add-status" role="status">
          {notice.kind === "added"
            ? `« ${noticed.title} » est ajouté pour cette visite. Il n'a pas encore de lecture.`
            : `Modification enregistrée : « ${noticed.title} ».`}
          {notice.searchCleared
            ? " La recherche a été effacée pour l'afficher."
            : ""}
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
              <BookCard book={book} completed={hasCompletedReading(book.id)}>
                <PageLink
                  href={`/livres/${encodeURIComponent(book.id)}/modifier`}
                  className="edit-link"
                  navigate={navigate}
                >
                  Modifier
                </PageLink>
              </BookCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
