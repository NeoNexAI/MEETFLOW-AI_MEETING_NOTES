"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useState, type ReactNode, useEffect } from "react";
import { Toaster } from "sonner";
import { defaultLocale, type Locale } from "@/i18n/config";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProvidersProps {
  children: ReactNode;
}

// ─── QueryClient factory (one per mount) ──────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// ─── Locale provider (client-side, stored in localStorage) ───────────────────

function useLocaleMessages(locale: Locale) {
  const [messages, setMessages] = useState<AbstractIntlMessages>({});

  useEffect(() => {
    import(`../messages/${locale}.json`)
      .then((mod: { default: AbstractIntlMessages }) => setMessages(mod.default))
      .catch(() => {
        import("../messages/en.json").then((mod: { default: AbstractIntlMessages }) =>
          setMessages(mod.default)
        );
      });
  }, [locale]);

  return messages;
}

// ─── Root Providers ───────────────────────────────────────────────────────────

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState<QueryClient>(makeQueryClient);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const messages = useLocaleMessages(locale);

  // Read locale from localStorage on mount, and react to live changes from the
  // Settings language switcher (dispatched as a `meetflow:locale` event) so the
  // UI re-localizes without a full reload.
  useEffect(() => {
    const apply = (value: string | null) => {
      if (value === "en" || value === "es") setLocale(value);
    };
    apply(localStorage.getItem("meetflow-locale"));

    const onLocale = (e: Event) => apply((e as CustomEvent<string>).detail);
    window.addEventListener("meetflow:locale", onLocale);
    return () => window.removeEventListener("meetflow:locale", onLocale);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            },
          }}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
