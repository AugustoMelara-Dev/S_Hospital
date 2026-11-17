import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { routes as appRoutes } from '@/app/routes';
import { Toaster } from '@/ui/Toast';

export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false } },
  });
}

type Options = { path?: string; queryClient?: QueryClient };

/**
 * Renders `ui` at `path` inside QueryClient + memory router + AuthProvider
 * (+ Toaster). Mock `GET /auth/me` with `mockApi` first.
 */
export function renderWithProviders(ui: ReactElement, { path = '/', queryClient = testQueryClient() }: Options = {}) {
  const routes: RouteObject[] = [
    {
      path: '*',
      element: <AuthProvider>{ui}</AuthProvider>,
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}

/** Renders the full app route table at `path` (integration tests). */
export function renderApp(path = '/', queryClient = testQueryClient()): RenderResult & { router: ReturnType<typeof createMemoryRouter> } {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { ...result, router };
}

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={testQueryClient()}>{children}</QueryClientProvider>;
}
