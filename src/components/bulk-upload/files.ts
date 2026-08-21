/**
 * Turning a file input's FileList into the images a bulk upload cares about.
 *
 * A folder picker hands back everything the folder holds — `.DS_Store`,
 * `Thumbs.db`, stray PDFs — so the selection is filtered here rather than
 * counted, previewed and uploaded as if it were all photographs.
 */

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

/** Only the images, ignoring whatever else a folder happened to contain. */
export function imagesOnly(files: FileList | null): File[] {
  return Array.from(files ?? []).filter((file) => {
    if (file.name.startsWith(".")) return false; // hidden files, .DS_Store included
    // Type first; some browsers leave it empty, so the extension is the fallback.
    return file.type ? file.type.startsWith("image/") : IMAGE_EXTENSIONS.test(file.name);
  });
}

/**
 * What the sheet can refer to this file by. A folder upload carries a relative
 * path; two products may each hold their own `front.jpg`, so the path is the
 * identity and the bare name is only a convenience.
 */
export const relativePath = (file: File): string => file.webkitRelativePath || file.name;

/**
 * Sanitise per segment so a folder path stays a folder path in Blob. `.` and
 * `..` are dropped rather than escaped: dots are legal inside a segment (they
 * carry the extension), so a traversal segment survives naive character
 * filtering and has to be removed as a segment.
 */
export const sanitizePath = (path: string): string =>
  path
    .split("/")
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
