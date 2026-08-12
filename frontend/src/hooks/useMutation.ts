import { useState, useCallback, useRef } from 'react';

interface MutationState<TData, TError> {
  data: TData | null;
  error: TError | null;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export function useMutation<TData, TArgs extends unknown[], TError = Error>(
  mutationFn: (...args: TArgs) => Promise<TData>
) {
  const [state, setState] = useState<MutationState<TData, TError>>({
    data: null,
    error: null,
    isPending: false,
    isSuccess: false,
    isError: false
  });

  const mutationRef = useRef<Promise<TData> | null>(null);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TData | null> => {
      // Prevent concurrent mutations
      if (state.isPending && mutationRef.current) {
        console.log('[useMutation] Mutation already in progress, skipping duplicate');
        try {
          return await mutationRef.current;
        } catch {
          return null;
        }
      }

      setState({
        data: null,
        error: null,
        isPending: true,
        isSuccess: false,
        isError: false
      });

      const promise = mutationFn(...args);
      mutationRef.current = promise;

      try {
        const data = await promise;
        setState({
          data,
          error: null,
          isPending: false,
          isSuccess: true,
          isError: false
        });
        return data;
      } catch (error) {
        setState({
          data: null,
          error: error as TError,
          isPending: false,
          isSuccess: false,
          isError: true
        });
        throw error;
      } finally {
        mutationRef.current = null;
      }
    },
    [mutationFn, state.isPending]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isPending: false,
      isSuccess: false,
      isError: false
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync: mutate,
    reset
  };
}

// Hook for handling optimistic updates with rollback
export function useOptimisticMutation<TData, TArgs extends unknown[], TError = Error>(
  mutationFn: (...args: TArgs) => Promise<TData>,
  options?: {
    onMutate?: (...args: TArgs) => Promise<() => void> | (() => void);
    onError?: (error: TError, ...args: TArgs) => void;
    onSuccess?: (data: TData, ...args: TArgs) => void;
    onSettled?: (...args: TArgs) => void;
  }
) {
  const [state, setState] = useState<MutationState<TData, TError>>({
    data: null,
    error: null,
    isPending: false,
    isSuccess: false,
    isError: false
  });

  const rollbackRef = useRef<(() => void) | null>(null);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TData | null> => {
      if (state.isPending) {
        console.log('[useOptimisticMutation] Mutation already in progress, skipping duplicate');
        return null;
      }

      // Run onMutate for optimistic update
      let rollback: (() => void) | undefined;
      if (options?.onMutate) {
        rollback = await options.onMutate(...args);
        rollbackRef.current = rollback;
      }

      setState(prev => ({
        ...prev,
        isPending: true,
        isSuccess: false,
        isError: false,
        error: null
      }));

      try {
        const data = await mutationFn(...args);
        setState({
          data,
          error: null,
          isPending: false,
          isSuccess: true,
          isError: false
        });
        options?.onSuccess?.(data, ...args);
        return data;
      } catch (error) {
        // Rollback optimistic update
        if (rollbackRef.current) {
          rollbackRef.current();
          rollbackRef.current = null;
        }
        options?.onError?.(error as TError, ...args);
        
        setState({
          data: null,
          error: error as TError,
          isPending: false,
          isSuccess: false,
          isError: true
        });
        throw error;
      } finally {
        options?.onSettled?.(...args);
      }
    },
    [mutationFn, options, state.isPending]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isPending: false,
      isSuccess: false,
      isError: false
    });
  }, []);

  return {
    ...state,
    mutate,
    mutateAsync: mutate,
    reset
  };
}