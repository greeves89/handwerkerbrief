import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import CookieConsent from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: "HandwerkerBrief - Rechnungen & Angebote",
  description: "Professionelle Rechnungen und Angebote für Handwerker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <ThemeProvider defaultTheme="dark">
          {children}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
