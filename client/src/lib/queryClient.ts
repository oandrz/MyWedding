import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 Unauthorized for admin routes
    if (res.status === 401 && res.url.includes('/api/admin')) {
      // Clear invalid admin key and redirect to login
      localStorage.removeItem('adminKey');
      window.location.href = '/admin-login';
      throw new Error(`${res.status}: Unauthorized - redirecting to login`);
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Add admin key to requests if it's an admin route and admin key exists
  const isAdminRoute = url.startsWith('/api/admin');
  const adminKey = localStorage.getItem('adminKey');
  
  let headers: Record<string, string> = {};
  
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  // For admin routes, add the admin key as a query parameter
  let requestUrl = url;
  if (isAdminRoute && adminKey) {
    const separator = url.includes('?') ? '&' : '?';
    requestUrl = `${url}${separator}adminKey=${adminKey}`;
  }
  
  const res = await fetch(requestUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Add admin key to requests if it's an admin route and admin key exists
    const isAdminRoute = url.startsWith('/api/admin');
    const adminKey = localStorage.getItem('adminKey');
    
    // For admin routes, add the admin key as a query parameter
    let requestUrl = url;
    if (isAdminRoute && adminKey) {
      const separator = url.includes('?') ? '&' : '?';
      requestUrl = `${url}${separator}adminKey=${adminKey}`;
    }
    
    const res = await fetch(requestUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Handle 401 Unauthorized for admin routes in queries
    if (res.status === 401 && requestUrl.includes('/api/admin')) {
      // Clear invalid admin key and redirect to login
      localStorage.removeItem('adminKey');
      window.location.href = '/admin-login';
      throw new Error(`${res.status}: Unauthorized - redirecting to login`);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
