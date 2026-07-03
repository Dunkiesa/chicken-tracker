import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "ChickenTrack",
  description: "Egg-production tracking for your backyard flock",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
