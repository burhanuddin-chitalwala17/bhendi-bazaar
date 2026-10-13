// hooks/core/useAsyncData.ts

import { useState, useEffect, useCallback, useRef, type DependencyList } from "react";

interface UseAsyncDataOptions<T> {
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  refetchDependencies?: DependencyList;
}

interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * A read that runs when its inputs change. The fetcher gets an `AbortSignal`, and a newer
 * run aborts the older one: without that, a slow reply for the previous input could land
 * after the fast reply for the current one and overwrite it.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataReturn<T> {
  const { enabled = true, onSuccess, onError, refetchDependencies = [] } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  const callbacksRef = useRef({ onSuccess, onError });
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    fetcherRef.current = fetcher;
    callbacksRef.current = { onSuccess, onError };
  });

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      callbacksRef.current.onSuccess?.(result);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "An error occurred");
      callbacksRef.current.onError?.(err as Error);
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();
    return () => inFlight.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...refetchDependencies]);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, refetch: fetchData, reset };
}
