import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/context/I18nContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gmail Backup Next",
  description:
    "Secure backup of your Gmail messages via POP3. Download and store emails locally in EML format. — Copia de seguridad de Gmail por POP3.",
  keywords: ["gmail", "backup", "pop3", "email", "eml", "correo", "copia de seguridad"],
  authors: [{ name: "Gmail Backup Next" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Gmail Backup Next",
    description: "Secure Gmail backup via POP3",
    type: "website",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1A73E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="h-full">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
