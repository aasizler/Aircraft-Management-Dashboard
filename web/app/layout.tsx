import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { NavMenu } from "@/components/nav-menu";
import { AccessWatcher } from "@/components/access-watcher";
import { PendingInvites } from "@/components/pending-invites";
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

// Headings only — body copy is Inter and every number is Inter with tabular
// figures. Replaced Syne, whose letter widths and weights vary within a word by
// design: "My Hangar" set its M and H at visibly different weights, and its
// figures were uneven enough that "23.0" looked broken.
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
      className={`${inter.variable} ${mono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Apply saved theme/accent before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var A={blue:'#3b9eff',cyan:'#22d3ee',violet:'#8b5cf6',magenta:'#ec4899',silver:'#e2e8f0',green:'#22d3ee',mint:'#22d3ee',purple:'#8b5cf6',red:'#ec4899',amber:'#ec4899',slate:'#e2e8f0'};" +
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
          <AccessWatcher userId={user.id} email={user.email} />
          <nav className="nav">
            <Link href="/" className="nav-brand">
              <span className="nav-dot" />
              AeroTrack
            </Link>
            <NavMenu
              email={user.email}
              name={(() => {
                const m = user.user_metadata as
                  | { first_name?: string; last_name?: string; full_name?: string }
                  | undefined;
                const joined = [m?.first_name, m?.last_name].filter(Boolean).join(" ");
                return joined || m?.full_name || null;
              })()}
            />
          </nav>
          {/* Mounted here rather than on the hangar so the ribbon, and the
              modal the nav ⋮ opens, exist on every page. Hangar-only meant
              "Pending invitations" dispatched at nothing from anywhere else. */}
          {user.email && <PendingInvites email={user.email} />}
          </>
        )}
        {children}
        </ToastProvider>
      </body>
    </html>
  );
}
