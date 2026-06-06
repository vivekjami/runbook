import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RunBook — Autonomous On-Call Agent",
  description:
    "RunBook investigates infrastructure incidents in 45 seconds, not 45 minutes. Shadow Mode, Incident DNA, Time-to-Innocent.",
  keywords: [
    "SRE",
    "on-call",
    "incident response",
    "autonomous agent",
    "Elastic",
    "Gemini",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
