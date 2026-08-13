import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "AeroTrack",
  description: "Aircraft management — Hired Wings",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {user && (
          <nav className="at-nav">
            <Link href="/" className="at-brand">
              <span className="at-dot" />
              AeroTrack
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <span className="at-mono hidden sm:inline">{user.email}</span>
              <SignOutButton />
            </div>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
