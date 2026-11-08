import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateNewBook, type NewBookInput } from "./add-book.ts";
import type { Ownership } from "./demo-books.ts";
import { coverFileError } from "../worker/validate-cover.ts";

type BookFormProps = {
  initial: NewBookInput;
  submitLabel: string;
  showRead?: boolean;
  currentCoverUrl?: string | null;
  onSubmitBook: (book: NewBookInput, cover: File | null) => Promise<void>;
};

const fieldError = {
  title: "Indique un titre.",
  author: "Indique un auteur.",
} as const;

export default function BookForm({
  initial,
  submitLabel,
  showRead = false,
  currentCoverUrl = null,
  onSubmitBook,
}: BookFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [ownership, setOwnership] = useState<Ownership>(initial.ownership);
  const [read, setRead] = useState(initial.read === true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<"title" | "author">>([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [coverFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const result = validateNewBook({
      title,
      author,
      ownership,
      read: showRead ? read : false,
    });

    if (coverError) {
      setSubmitError(coverError);
      return;
    }

    if (!result.ok) {
      setSubmitError(null);
      setErrors(result.errors);
      if (result.errors.includes("title")) {
        titleRef.current?.focus();
      } else {
        authorRef.current?.focus();
      }
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmitBook(result.book, coverFile);
      setErrors([]);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "L'enregistrement a échoué.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="add-book" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="book-title">Titre</label>
        <input
          ref={titleRef}
          id="book-title"
          name="title"
          type="text"
          value={title}
          aria-invalid={errors.includes("title")}
          aria-describedby={errors.includes("title") ? "book-title-error" : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        {errors.includes("title") && (
          <p id="book-title-error" className="add-error">
            {fieldError.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="book-author">Auteur</label>
        <input
          ref={authorRef}
          id="book-author"
          name="author"
          type="text"
          value={author}
          aria-invalid={errors.includes("author")}
          aria-describedby={errors.includes("author") ? "book-author-error" : undefined}
          onChange={(event) => {
            setAuthor(event.target.value);
          }}
        />
        {errors.includes("author") && (
          <p id="book-author-error" className="add-error">
            {fieldError.author}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="book-cover">Couverture, facultative</label>
        <input
          id="book-cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) {
              setCoverFile(null);
              setCoverError(null);
              return;
            }
            const error = coverFileError(file);
            setCoverError(error);
            setCoverFile(error ? null : file);
            setSubmitError(null);
          }}
        />
        <p className="add-note">JPEG, PNG ou WebP. 2 Mo maximum.</p>
        {coverError ? <p className="add-error">{coverError}</p> : null}
        {previewUrl ? (
          <img className="cover" src={previewUrl} alt="Aperçu de la couverture" />
        ) : currentCoverUrl ? (
          <img className="cover" src={currentCoverUrl} alt="Couverture actuelle" />
        ) : (
          <p className="cover-placeholder">Pas de couverture</p>
        )}
      </div>
      <fieldset>
        <legend>Lien avec ce livre</legend>
        <label>
          <input
            id="ownership-owned"
            type="checkbox"
            checked={ownership === "owned"}
            onChange={(event) => {
              setOwnership(event.target.checked ? "owned" : "none");
            }}
          />
          j’ai
        </label>
        <label>
          <input
            id="ownership-wishlist"
            type="checkbox"
            checked={ownership === "wishlist"}
            onChange={(event) => {
              setOwnership(event.target.checked ? "wishlist" : "none");
            }}
          />
          je veux
        </label>
        <p className="add-note">Tu peux n’en cocher aucune.</p>
      </fieldset>
      {showRead ? (
        <fieldset>
          <legend>Lecture</legend>
          <label>
            <input
              id="book-read"
              type="checkbox"
              checked={read}
              onChange={(event) => {
                setRead(event.target.checked);
              }}
            />
            J’ai lu
          </label>
          <p className="add-note">
            Coche ceci pour créer une fiche Terminé, sans date, lieu ni note.
          </p>
        </fieldset>
      ) : null}
      {submitError && <p className="add-error">{submitError}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
