import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RunBook — Autonomous On-Call Agent",
  description:
    "RunBook investigates infrastructure incidents in 45 seconds, not 45 minutes. Powered by Gemini 2.5 Pro and Elastic.",
  keywords: ["incident management", "on-call", "SRE", "autonomous agent", "Elastic", "Gemini"],
  openGraph: {
    title: "RunBook — Autonomous On-Call Agent",
    description: "Stop getting paged at 3am for things a machine can fix.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
