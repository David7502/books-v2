export const READING_STATUSES = ["to_read", "reading", "read"] as const;

export type ReadingStatus = (typeof READING_STATUSES)[number];

export type ReadingInput = {
  status: ReadingStatus;
  startedOn: string | null;
  finishedOn: string | null;
  location: string | null;
  rating: number | null;
};

const MAX_LOCATION = 200;

function calendarDate(
  value: unknown,
  label: string,
): { ok: true; date: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, date: null };
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: `${label} doit être une date AAAA-MM-JJ.` };
  }
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return { ok: false, error: `${label} n'est pas une date réelle.` };
  }
  return { ok: true, date: value };
}

function optionalText(
  value: unknown,
): { ok: true; text: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, text: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "Le lieu doit être un texte." };
  }
  const text = value.trim();
  if (text === "") {
    return { ok: true, text: null };
  }
  if (text.length > MAX_LOCATION) {
    return { ok: false, error: "Le lieu est limité à 200 caractères." };
  }
  return { ok: true, text };
}

function optionalRating(
  value: unknown,
): { ok: true; rating: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, rating: null };
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return { ok: false, error: "La note est un entier de 1 à 5, ou vide." };
  }
  return { ok: true, rating: value };
}

export function validateReadingInput(
  value: unknown,
): { ok: true; reading: ReadingInput } | { ok: false; error: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Le corps doit être un objet JSON." };
  }
  const body = value as Record<string, unknown>;
  if (!READING_STATUSES.includes(body.status as ReadingStatus)) {
    return { ok: false, error: "Choisis à lire, en cours, ou terminé." };
  }
  const status = body.status as ReadingStatus;
  const started = calendarDate(body.startedOn, "La date de début");
  if (!started.ok) {
    return started;
  }
  const finished = calendarDate(body.finishedOn, "La date de fin");
  if (!finished.ok) {
    return finished;
  }
  const location = optionalText(body.location);
  if (!location.ok) {
    return location;
  }
  const rating = optionalRating(body.rating);
  if (!rating.ok) {
    return rating;
  }

  if (status === "to_read" && (started.date || finished.date)) {
    return {
      ok: false,
      error: "Une lecture à lire n'a ni date de début ni date de fin.",
    };
  }
  if (status === "reading" && finished.date) {
    return { ok: false, error: "Une lecture en cours n'a pas de date de fin." };
  }
  if (started.date && finished.date && finished.date < started.date) {
    return { ok: false, error: "La date de fin est avant la date de début." };
  }

  return {
    ok: true,
    reading: {
      status,
      startedOn: started.date,
      finishedOn: finished.date,
      location: location.text,
      rating: rating.rating,
    },
  };
}
