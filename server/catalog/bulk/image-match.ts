/**
 * Matching a sheet's image reference to one of the dropped files
 * (bulk-catalog-upload R2).
 *
 * Folder uploads carry a relative path (`abayas/emerald/front.jpg`), plain file
 * selection carries a bare name. A reference matches a file when it is the whole
 * path or a trailing run of whole segments of it, so `front.jpg` and
 * `emerald/front.jpg` both find the same file without the sheet's author having
 * to know which folder the upload was rooted at.
 *
 * Two files can legitimately be called `front.jpg` — one per product — so an
 * ambiguous reference is an error, never a guess: picking one silently is how a
 * catalogue ends up with the wrong photograph on the wrong product.
 *
 * Comparison is case-insensitive: Windows and macOS both hand out
 * case-insensitive paths, and a shopkeeper retyping "Front.JPG" means the file.
 */

export interface ImageMatch {
  /** The one file this reference names. */
  path: string;
}

export type ImageMatchFailure =
  | { kind: "missing" }
  | { kind: "ambiguous"; candidates: string[] };

const normalise = (value: string) => value.trim().replace(/\\/g, "/").toLowerCase();

/** Every provided path this reference could mean. */
export function matchingPaths(reference: string, provided: readonly string[]): string[] {
  const needle = normalise(reference);
  if (!needle) return [];
  return provided.filter((candidate) => {
    const path = normalise(candidate);
    return path === needle || path.endsWith(`/${needle}`);
  });
}

/** The single file a reference names, or why it does not name exactly one. */
export function matchImage(
  reference: string,
  provided: readonly string[]
): ImageMatch | ImageMatchFailure {
  const matches = matchingPaths(reference, provided);
  if (matches.length === 1) return { path: matches[0] };
  if (matches.length === 0) return { kind: "missing" };
  return { kind: "ambiguous", candidates: matches };
}

/** The message a user can act on, for a reference that matched none or many. */
export function imageMatchMessage(reference: string, failure: ImageMatchFailure): string {
  if (failure.kind === "missing") {
    return `Image "${reference}" was not among the uploaded files.`;
  }
  return (
    `"${reference}" matches ${failure.candidates.length} uploaded files ` +
    `(${failure.candidates.slice(0, 3).join(", ")}${failure.candidates.length > 3 ? ", …" : ""}). ` +
    `Include the folder in the sheet — for example "${failure.candidates[0]}".`
  );
}
