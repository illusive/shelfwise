import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { createServices, type Services } from '@/services';
import { GooFilter } from '@/ui/primitives/GooFilter';
import { ToastProvider } from '@/ui/primitives/Toast';
import { useLanguage } from '@/i18n/language';
import { readConfig } from './config';
import { router } from './router';
import { ServicesProvider } from './services-context';

const queryClient = new QueryClient({
  defaultOptions: {
    // Local IndexedDB reads are cheap; always reflect the latest state.
    queries: { staleTime: 0, refetchOnWindowFocus: false, retry: false },
  },
});

export function App() {
  const [services, setServices] = useState<Services | null>(null);
  const [error, setError] = useState<string | null>(null);
  const language = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    createServices(readConfig())
      .then(async (s) => {
        if (cancelled) return;
        setServices(s);
        await s.analysis.resumeInterrupted();
        // Reduce the risk of the browser evicting captured photos under storage pressure.
        void navigator.storage?.persist?.();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" style={{ padding: 24 }}>
        Shelfwise could not open its local storage: {error}
      </p>
    );
  }
  if (!services) return null;

  return (
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <GooFilter />
            {/* Remount on language change so every screen re-reads its strings. */}
            <RouterProvider key={language} router={router} />
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ServicesProvider>
  );
}
