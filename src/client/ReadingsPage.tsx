import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import {
  ApiError,
  fetchReading,
  saveReading,
  type LibraryBook,
  type ReadingRecord,
} from "./api.ts";
import {
  validateReadingInput,
  type ReadingInput,
  type ReadingStatus,
} from "../worker/validate-reading.ts";

type Navigate = (to: string) => void;

const statusLabel: Record<ReadingStatus, string> = {
  to_read: "À lire",
  reading: "En cours",
  read: "Terminé",
};

const emptyReading: ReadingInput = {
  status: "to_read",
  startedOn: null,
  finishedOn: null,
  location: null,
  rating: null,
};

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

function fromRecord(reading: ReadingRecord): ReadingInput {
  return {
    status: reading.status,
    startedOn: reading.startedOn,
    finishedOn: reading.finishedOn,
    location: reading.location,
    rating: reading.rating,
  };
}

export default function ReadingsPage({
  bookId,
  navigate,
  onSaved,
}: {
  bookId: string;
  navigate: Navigate;
  onSaved: (book: LibraryBook) => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missingBook, setMissingBook] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [reading, setReading] = useState<ReadingRecord | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    setMissingBook(false);
    try {
      const payload = await fetchReading(bookId);
      setBook(payload.book);
      setReading(payload.reading);
      setAmbiguous(payload.ambiguous);
      setLoading(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setMissingBook(true);
        setLoading(false);
        return;
      }
      setLoadError(
        error instanceof Error ? error.message : "La fiche n'a pas pu être lue.",
      );
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [bookId]);

  if (loading) {
    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Lecture
        </h1>
        <p>Chargement de la fiche…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Lecture
        </h1>
        <p>{loadError}</p>
        <button type="button" className="show-all" onClick={() => void load()}>
          Réessayer
        </button>
      </main>
    );
  }

  if (missingBook || !book) {
    return (
      <main>
        <h1 id="page-title" tabIndex={-1}>
          Livre introuvable
        </h1>
        <p>Ce livre n'est pas dans la bibliothèque.</p>
        <PageLink href="/" className="back-link" navigate={navigate}>
          Retour à la bibliothèque
        </PageLink>
      </main>
    );
  }

  return (
    <main>
      <h1 id="page-title" tabIndex={-1}>
        Lecture
      </h1>
      <p>
        {book.title}, {book.author}. Cette fiche ne change pas le lien avec le
        livre.
      </p>
      <PageLink href="/" className="back-link" navigate={navigate}>
        Annuler et revenir à la bibliothèque
      </PageLink>
      {ambiguous ? (
        <p>
          Plusieurs fiches existent déjà pour ce livre. Aucune n'est affichée,
          et rien n'est modifié.
        </p>
      ) : (
        <ReadingForm
          key={reading?.id ?? "new"}
          initial={reading ? fromRecord(reading) : emptyReading}
          onSubmit={async (input) => {
            const saved = await saveReading(bookId, input);
            if (saved.book) {
              await onSaved(saved.book);
            }
          }}
        />
      )}
    </main>
  );
}

function ReadingForm({
  initial,
  onSubmit,
}: {
  initial: ReadingInput;
  onSubmit: (input: ReadingInput) => Promise<void>;
}) {
  const [status, setStatus] = useState<ReadingStatus>(initial.status);
  const [startedOn, setStartedOn] = useState(initial.startedOn ?? "");
  const [finishedOn, setFinishedOn] = useState(initial.finishedOn ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [rating, setRating] = useState<number | null>(initial.rating);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const parsed = validateReadingInput({
      status,
      startedOn: startedOn === "" ? null : startedOn,
      finishedOn: finishedOn === "" ? null : finishedOn,
      location,
      rating,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(parsed.reading);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "L'enregistrement a échoué.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="add-book" onSubmit={handleSubmit}>
      <fieldset>
        <legend>Statut</legend>
        {(["to_read", "reading", "read"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="reading-status"
              value={value}
              checked={status === value}
              onChange={() => {
                setStatus(value);
              }}
            />
            {statusLabel[value]}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="reading-started">Date de début</label>
        <input
          id="reading-started"
          type="date"
          value={startedOn}
          onChange={(event) => {
            setStartedOn(event.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="reading-finished">Date de fin</label>
        <input
          id="reading-finished"
          type="date"
          value={finishedOn}
          onChange={(event) => {
            setFinishedOn(event.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="reading-location">Lieu</label>
        <input
          id="reading-location"
          type="text"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
          }}
        />
      </div>
      <fieldset>
        <legend>Note</legend>
        <label>
          <input
            type="radio"
            name="reading-rating"
            value=""
            checked={rating === null}
            onChange={() => {
              setRating(null);
            }}
          />
          Sans note
        </label>
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="reading-rating"
              value={value}
              checked={rating === value}
              onChange={() => {
                setRating(value);
              }}
            />
            {value} {value > 1 ? "étoiles" : "étoile"}
          </label>
        ))}
      </fieldset>
      {error ? <p className="add-error">{error}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
