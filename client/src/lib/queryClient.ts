import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep cache for 10 minutes  
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch on window focus only if data is stale
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect unless data is stale
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export async function apiRequest(
  method: HttpMethod,
  url: string,
  data?: any
) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response;
}

export const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const response = await apiRequest("GET", queryKey[0] as string);
  return response.json();
};
