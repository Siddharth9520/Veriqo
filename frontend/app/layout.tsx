import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppSidebar from "@/components/layout/AppSidebar";
import AppHeader from "@/components/layout/AppHeader";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Veriqo — Autonomous AI QA Engineer | Intelligence That Tests Itself",
  description: "Autonomous AI QA Engineer executing deep heuristic testing, race-condition detection, and idempotency fuzzing across web fleets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF9F6] text-[#1A1C1A] font-body selection:bg-[#B7EFD0] selection:text-[#002114]">
        <AppSidebar />
        <div className="md:pl-72 flex flex-col min-h-screen">
          <AppHeader />
          <main className="relative pt-16 w-full flex-1 bg-[#FAF9F6]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
