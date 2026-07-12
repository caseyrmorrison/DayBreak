import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  // The app renders light regardless of system theme, so pin the
  // status-bar / theme color to white — a dark theme-color is what
  // paints a black bar above the content on some devices.
  themeColor: "#ffffff",
  // Extend under the notch/home indicator; CSS safe-area padding then
  // keeps content clear of them.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
