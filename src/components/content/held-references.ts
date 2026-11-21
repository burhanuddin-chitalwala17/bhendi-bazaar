/**
 * After uploading the pictures held for a styled run (improve-with-ai Q43): those that reached the
 * library become references, and only the ones that did not stay held — so a second Generate never
 * uploads the same picture twice. `urls` is index-aligned with `held`, as `uploadBatch` returns it.
 */
export function settleHeldUpload<T>(held: readonly T[], urls: readonly (string | null | undefined)[]): { uploaded: string[]; stillHeld: T[] } {
  const uploaded: string[] = [];
  const stillHeld: T[] = [];
  held.forEach((item, index) => {
    const url = urls[index];
    if (url) uploaded.push(url);
    else stillHeld.push(item);
  });
  return { uploaded, stillHeld };
}
