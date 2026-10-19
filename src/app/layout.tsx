import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "NTECH Hub", template: "%s · NTECH Hub" },
  description: "Hub interno da NTECH. Uso exclusivo da equipe.",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "NTECH Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0B0F0E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
