import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "../components/AppShell";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
  themeColor: "#AE9965",
};

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
          <ServiceWorkerRegistration />
        </Providers>
      </body>
    </html>
  );
}
