// hooks/core/useMutation.ts

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { CORE_HOOKS_COPY } from "./core-copy";

interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData) => void | Promise<void>;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
}

interface UseMutationReturn<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: string | null;
  data: TData | null;
  reset: () => void;
}

export function useMutation<TData = unknown, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationReturn<TData, TVariables> {
  const {
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    showToast = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TData | null>(null);
  // A second call with the same variables while the first is in flight joins it: a double tap is
  // one request (docs/GTM-READINESS.md B9). Different variables are a different request (another
  // row, another choice) and are sent. A ref, not state, so it holds within one tick.
  const inFlight = useRef(new Map<string, Promise<TData>>());

  const run = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        setIsLoading(false);

        if (showToast && successMessage) {
          toast.success(successMessage);
        }

        await onSuccess?.(result);

        return result;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : CORE_HOOKS_COPY.errorOccurred;

        // Set state synchronously before throwing
        setError(errorMsg);
        setIsLoading(false);

        if (showToast && (errorMessage || errorMsg)) {
          toast.error(errorMessage || errorMsg);
        }

        onError?.(err as Error);

        // Throw the error - state should be set by now
        throw err;
      }
    },
    [mutationFn, onSuccess, onError, successMessage, errorMessage, showToast]
  );

  const mutate = useCallback(
    (variables: TVariables): Promise<TData> => {
      const key = keyOf(variables);
      const joined = key === null ? undefined : inFlight.current.get(key);
      if (joined) return joined;
      const pending = run(variables).finally(() => {
        if (key !== null) inFlight.current.delete(key);
      });
      if (key !== null) inFlight.current.set(key, pending);
      return pending;
    },
    [run]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    mutate,
    isLoading,
    error,
    data,
    reset,
  };
}

/** Same variables, same key. Variables that cannot be serialised are never joined. */
function keyOf(variables: unknown): string | null {
  try {
    return JSON.stringify(variables) ?? "undefined";
  } catch {
    return null;
  }
}
