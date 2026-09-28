"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApiError } from "@/lib/api-error";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import type { Pagination } from "@server/shared/pagination";

interface Options {
  orgId: string;
  /** The filters, as the query string the library route parses; `page` is added here. */
  query: string;
  /** The first page, when the server already rendered it; otherwise fetched on mount. */
  initial?: { assets: MediaAssetDto[]; pagination: Pagination };
}

/**
 * Pages of one org's library, one query at a time (media-library spec R6). Data only: how the
 * pages are shown, and what asks for the next one, belong to the component. A change of
 * `query` starts over, so a filter switch never appends under the previous filter's tiles.
 */
export function useMediaLibraryPages({ orgId, query, initial }: Options) {
  const [assets, setAssets] = useState<MediaAssetDto[]>(initial?.assets ?? []);
  const [pagination, setPagination] = useState<Pagination | null>(initial?.pagination ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = pagination !== null && pagination.page >= pagination.totalPages;

  const latest = useRef(initial);
  latest.current = initial;

  const fetchPage = useCallback(
    async (page: number) => {
      const separator = query ? "&" : "";
      const response = await fetch(`/api/org/${orgId}/media?${query}${separator}page=${page}`);
      if (!response.ok) throw await readApiError(response);
      return (await response.json()) as { assets: MediaAssetDto[]; pagination: Pagination };
    },
    [orgId, query],
  );

  // The server rendered a fresh first page — after an upload or a retire refreshed the route —
  // so the list starts over from it. Client re-renders keep the same object, so this is quiet.
  useEffect(() => {
    if (!initial) return;
    setAssets(initial.assets);
    setPagination(initial.pagination);
    setError(null);
  }, [initial]);

  // No server page: fetch the first one. Callers remount on a query change (key on it), so a
  // change never reaches a mounted hook — that is what keeps this a fetch, not a diff.
  useEffect(() => {
    if (latest.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(1)
      .then((body) => {
        if (cancelled) return;
        setAssets(body.assets);
        setPagination(body.pagination);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the library");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loading || done || pagination === null) return;
    setLoading(true);
    setError(null);
    try {
      const body = await fetchPage(pagination.page + 1);
      // Deduplicated by id: an upload landing mid-scroll shifts every later row by one, and an
      // offset page would otherwise repeat whichever tile crossed the boundary.
      setAssets((current) => {
        const seen = new Set(current.map((asset) => asset.id));
        return [...current, ...body.assets.filter((asset) => !seen.has(asset.id))];
      });
      setPagination(body.pagination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more");
    } finally {
      setLoading(false);
    }
  }, [loading, done, pagination, fetchPage]);

  const remove = useCallback((id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    setPagination((current) => (current ? { ...current, total: Math.max(0, current.total - 1) } : current));
  }, []);

  return { assets, total: pagination?.total ?? assets.length, loading, done, error, loadMore, remove };
}
