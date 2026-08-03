import { useState, useEffect, useCallback, useRef } from 'react';

export interface Suggestion {
  type: string;
  value: string;
  label: string;
}

interface UseSearchAutocompleteOptions {
  searchType: 'professionals' | 'projects';
  minQueryLength?: number;
  debounceMs?: number;
}

export const useSearchAutocomplete = (
  query: string,
  options: UseSearchAutocompleteOptions
) => {
  const { searchType, minQueryLength = 2, debounceMs = 300 } = options;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const fetchSuggestions = useCallback(async (
    searchQuery: string,
    signal: AbortSignal,
    requestId: number,
  ) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: searchType,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/search/autocomplete?${params.toString()}`,
        { credentials: 'include', signal }
      );

      if (signal.aborted || requestIdRef.current !== requestId) return;
      if (response.ok) {
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      if (
        signal.aborted ||
        requestIdRef.current !== requestId ||
        (error instanceof Error && error.name === 'AbortError')
      ) return;
      console.error('Autocomplete error:', error);
      setSuggestions([]);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [searchType]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    if (query.length < minQueryLength) {
      setSuggestions([]);
      setIsLoading(false);
      return () => controller.abort();
    }

    const timer = setTimeout(() => {
      void fetchSuggestions(query, controller.signal, requestId);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, debounceMs, fetchSuggestions]);

  return { suggestions, isLoading };
};
