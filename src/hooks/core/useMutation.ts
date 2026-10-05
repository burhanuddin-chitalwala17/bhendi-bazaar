// hooks/core/useMutation.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";

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

  const mutate = useCallback(
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
          err instanceof Error ? err.message : "An error occurred";

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