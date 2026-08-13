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
        {/* Apply saved theme/accent before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('at_theme');if(t==='light')document.documentElement.classList.add('light');var a=localStorage.getItem('at_accent');if(a){var r=document.documentElement.style;r.setProperty('--accent',a);r.setProperty('--accent-dim',a+'1a');}}catch(e){}",
          }}
        />
        {user && (
          <nav className="nav">
            <Link href="/" className="nav-brand">
              <span className="nav-dot" />
              AeroTrack
            </Link>
            <div className="nav-right">
              <Link href="/settings" className="nav-user" style={{ textDecoration: "none" }}>
                <span className="nav-avatar">
                  {(user.email ?? "?")[0].toUpperCase()}
                </span>
                <span className="nav-user-email">{user.email}</span>
              </Link>
              <SignOutButton />
            </div>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
