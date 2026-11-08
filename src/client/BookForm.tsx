import { useRef, useState, type FormEvent } from "react";
import { validateNewBook, type NewBookInput } from "./add-book.ts";
import type { Ownership } from "./demo-books.ts";

type BookFormProps = {
  initial: NewBookInput;
  submitLabel: string;
  note: string;
  onSubmitBook: (book: NewBookInput) => void;
};

const fieldError = {
  title: "Indique un titre.",
  author: "Indique un auteur.",
} as const;

export default function BookForm({
  initial,
  submitLabel,
  note,
  onSubmitBook,
}: BookFormProps) {
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [ownership, setOwnership] = useState<Ownership>(initial.ownership);
  const [errors, setErrors] = useState<Array<"title" | "author">>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateNewBook({ title, author, ownership });

    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.includes("title")) {
        titleRef.current?.focus();
      } else {
        authorRef.current?.focus();
      }
      return;
    }

    onSubmitBook(result.book);
    setErrors([]);
  }

  return (
    <form className="add-book" onSubmit={handleSubmit}>
      <p className="add-note">{note}</p>
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
      <fieldset>
        <legend>Lien avec ce livre</legend>
        <label>
          <input
            type="radio"
            name="ownership"
            value="owned"
            checked={ownership === "owned"}
            onChange={() => {
              setOwnership("owned");
            }}
          />
          j’ai
        </label>
        <label>
          <input
            type="radio"
            name="ownership"
            value="wishlist"
            checked={ownership === "wishlist"}
            onChange={() => {
              setOwnership("wishlist");
            }}
          />
          je veux
        </label>
        <label>
          <input
            type="radio"
            name="ownership"
            value="none"
            checked={ownership === "none"}
            onChange={() => {
              setOwnership("none");
            }}
          />
          Ni l’un ni l’autre (emprunt ou autre)
        </label>
      </fieldset>
      <button type="submit">{submitLabel}</button>
    </form>
  );
}
