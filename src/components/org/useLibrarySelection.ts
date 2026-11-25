import { useCallback, useState } from "react";

/**
 * The Library's selection mode and the ids ticked in it (bulk-actions trd D7). It clears on a
 * filter change because the grid is keyed on its query and remounts (D8, Q12).
 */
export function useLibrarySelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());

  const start = useCallback(() => setSelecting(true), []);
  const stop = useCallback(() => {
    setSelecting(false);
    setIds(new Set());
  }, []);
  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback((all: string[]) => setIds(new Set(all)), []);
  const clear = useCallback(() => setIds(new Set()), []);

  return { selecting, ids, start, stop, toggle, selectAll, clear };
}
