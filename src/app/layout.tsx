import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daybreak",
  description:
    "Start your day with the one thing that matters. A minimalist, local-first daily focus app.",
  applicationName: "Daybreak",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Daybreak",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Temporary diagnostics (see public/debug-hook.js): needs the CSP
  // nonce because strict-dynamic ignores the 'self' allowlist.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run before app chunks to catch their load errors */}
        <script src="/debug-hook.js" nonce={nonce} />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
