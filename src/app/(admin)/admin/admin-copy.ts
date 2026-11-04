/** Words every admin page shares: its frame, its loading and failure states (ADR-0067). */
export const ADMIN_SHELL_COPY = {
  portalLabel: "Platform Admin",
  loading: "Loading",
  errorTitle: "This page didn't load",
  errorDescription: "Something went wrong reading it. Nothing was changed; try again, and if it keeps failing, check the server log.",
  nothingChanged: "Nothing was changed.",
  pages: "Pages",
  previous: "Previous",
  next: "Next",
} as const;
