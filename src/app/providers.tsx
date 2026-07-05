"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeModeProvider } from "@/theme";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { getDateFnsLocale } from "@/lib/dateUtils";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <ThemeModeProvider>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={getDateFnsLocale()}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </LocalizationProvider>
      </ThemeModeProvider>
    </SessionProvider>
  );
}
