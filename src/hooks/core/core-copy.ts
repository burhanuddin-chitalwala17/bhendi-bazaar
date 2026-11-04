/** Words for hooks/core/ (ADR-0067): one object per file, kept byte-identical to what it showed. */

/** useMutation.ts / useServerForm.ts: what a failure says when it brought no words of its own. */
export const CORE_HOOKS_COPY = {
  errorOccurred: "An error occurred",
  couldNotSave: "Could not save. Please try again.",
} as const;
