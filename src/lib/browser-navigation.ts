/** Full-page navigation behind one seam: jsdom's `location` cannot be spied on, so a test mocks this. */
export function navigateTo(href: string): void {
  window.location.assign(href);
}

export function openInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

// Revoked late: Safari starts the save after click() returns, and an early revoke saves nothing.
const SAVE_URL_LIFETIME_MS = 60_000;

/** Saves bytes the page made as a file, through an object URL on a `download` anchor. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), SAVE_URL_LIFETIME_MS);
}
