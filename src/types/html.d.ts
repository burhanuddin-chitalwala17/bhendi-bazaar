import "react";

declare module "react" {
  /* eslint-disable @typescript-eslint/no-unused-vars -- the type parameter must
     match React's own declaration for this augmentation to merge with it. */
  interface InputHTMLAttributes<T> {
    /**
     * Turns a file input into a folder picker. Non-standard but supported by
     * every desktop browser; absent on iOS Safari, which is why the plain
     * multi-file input stays as the baseline (ADR-0015).
     *
     * Declared here so it can be written in JSX — set from an effect it would
     * only exist after hydration, and be invisible where the input is read.
     */
    webkitdirectory?: string;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
