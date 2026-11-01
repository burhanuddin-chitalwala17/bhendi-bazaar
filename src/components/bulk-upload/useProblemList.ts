"use client";

import { useMemo, useState } from "react";
import type { RowError } from "@server/catalog/bulk/bulk.types";
import { groupByRow, PROBLEMS_SHOWN, rowsWithProblems } from "./check-copy";

/** The problem list's view: which column it is filtered to, and whether past the first twenty (D8). */
export function useProblemList(errors: readonly RowError[]) {
  const [column, setColumn] = useState("");
  const [showAll, setShowAll] = useState(false);
  const columns = useMemo(
    () => [...new Set(errors.map((error) => error.column).filter((c): c is string => !!c))].sort(),
    [errors],
  );
  const filtered = useMemo(() => (column ? errors.filter((error) => error.column === column) : errors), [errors, column]);
  const shown = showAll ? filtered : filtered.slice(0, PROBLEMS_SHOWN);
  return {
    column,
    setColumn,
    columns,
    groups: groupByRow(shown),
    hidden: filtered.length - shown.length,
    total: filtered.length,
    showAll: () => setShowAll(true),
    rowCount: rowsWithProblems(errors),
    fileProblem: errors.some((error) => error.row === 0),
  };
}
