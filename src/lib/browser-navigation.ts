/** Full-page navigation behind one seam: jsdom's `location` cannot be spied on, so a test mocks this. */
export function navigateTo(href: string): void {
  window.location.assign(href);
}

export function openInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
