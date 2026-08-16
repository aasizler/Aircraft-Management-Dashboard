import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { NavMenu } from "@/components/nav-menu";
import { AccessWatcher } from "@/components/access-watcher";
import { ToastProvider } from "@/components/ui/toast";

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
              "try{var A={blue:'#3b9eff',cyan:'#22d3ee',green:'#2dd4a0',mint:'#34d399',purple:'#a855f7',red:'#f04b4b',amber:'#f59e0b',slate:'#94a3b8'};" +
              "var t=localStorage.getItem('at_theme')||'dark';" +
              "var light=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);" +
              "if(light)document.documentElement.classList.add('light');" +
              "var a=localStorage.getItem('at_accent');if(a){var h=A[a]||(a.charAt(0)==='#'?a:null);" +
              "if(h){var r=document.documentElement.style;r.setProperty('--accent',h);r.setProperty('--accent-dim',h+'1a');}}}catch(e){}",
          }}
        />
        <ToastProvider>
        {user && (
          <>
          <AccessWatcher />
          <nav className="nav">
            <Link href="/" className="nav-brand">
              <span className="nav-dot" />
              AeroTrack
            </Link>
            <NavMenu email={user.email} />
          </nav>
          </>
        )}
        {children}
        </ToastProvider>
      </body>
    </html>
  );
}
