import { useRef, useState } from "react";
import BookCard from "./BookCard.tsx";
import { demoBooks, hasCompletedReading } from "./demo-books.ts";
import { bookMatchesQuery, formatResultCount } from "./search.ts";

type ViewMode = "grid" | "carousel";

export default function App() {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const scrollerRef = useRef<HTMLUListElement>(null);
  const visibleBooks = demoBooks.filter((book) => bookMatchesQuery(book, query));
  const empty = visibleBooks.length === 0;
  const carousel = viewMode === "carousel";

  function scrollByCard(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    const card = scroller?.querySelector(":scope > li");
    if (!scroller || !card) {
      return;
    }

    const gap = Number.parseFloat(getComputedStyle(scroller).columnGap) || 0;
    const distance = card.getBoundingClientRect().width + gap;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    scroller.scrollBy({
      left: direction * distance,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

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
      <div className="view-bar">
        <div role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            aria-pressed={viewMode === "grid"}
            onClick={() => {
              setViewMode("grid");
            }}
          >
            Grille
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "carousel"}
            onClick={() => {
              setViewMode("carousel");
            }}
          >
            Carrousel
          </button>
        </div>
        {carousel && visibleBooks.length > 1 && (
          <div role="group" aria-label="Défilement du carrousel">
            <button
              type="button"
              onClick={() => {
                scrollByCard(-1);
              }}
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => {
                scrollByCard(1);
              }}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
      <p id="search-count" role="status">
        {formatResultCount(visibleBooks.length)}
      </p>
      {empty ? (
        <p id="search-empty">
          Aucun livre de démonstration ne correspond à cette recherche.
        </p>
      ) : (
        <ul
          ref={scrollerRef}
          className={carousel ? "book-list book-list-carousel" : "book-list"}
          tabIndex={carousel ? 0 : undefined}
          aria-label={carousel ? "Carrousel des livres" : undefined}
        >
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
