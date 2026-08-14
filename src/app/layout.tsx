import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Husholdningsapp",
  description: "Familiens felles verktøy for hverdag, barn, kalender og handleliste.",
  manifest: "/manifest.webmanifest",
  applicationName: "Husholdningsapp",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Husholdningsapp"
  },
  robots: {
    index: false,
    follow: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f2"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
