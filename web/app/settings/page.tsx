import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeControls } from "@/components/settings/theme-controls";
import { ChangePassword } from "@/components/settings/change-password";
import { DisplayName } from "@/components/settings/display-name";
import { SignOutButton } from "@/components/sign-out-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("org_members")
    .select("role, orgs(name)")
    .maybeSingle();

  const orgName = (membership?.orgs as { name?: string } | null)?.name ?? "—";
  const meta = user?.user_metadata as
    | { first_name?: string; last_name?: string; full_name?: string }
    | undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-7 py-8">
      <Link href="/" className="mono" style={{ color: "var(--muted2)" }}>
        ← Hangar
      </Link>
      <h1 className="at-title page-title" style={{ margin: "12px 0 2px" }}>
        Settings
      </h1>
      <div className="mono" style={{ marginBottom: 2 }}>AeroTrack</div>
      <div className="page-sub" style={{ marginBottom: 20 }}>App preferences</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ThemeControls />

        <DisplayName
          firstInitial={meta?.first_name}
          lastInitial={meta?.last_name}
          fullInitial={meta?.full_name}
        />

        <div className="panel">
          <div className="panel-title">Account</div>
          <div className="ins-field">
            <span className="ins-field-label">Email</span>
            <span className="ins-field-value">{user?.email}</span>
          </div>
          <div className="ins-field">
            {/* "Hangar" everywhere the owner can see. The org only earns its own
                name once there is more than one person in it. */}
            <span className="ins-field-label">Hangar</span>
            <span className="ins-field-value">{orgName}</span>
          </div>
          <div className="ins-field">
            <span className="ins-field-label">Role</span>
            <span className="ins-field-value" style={{ textTransform: "capitalize" }}>
              {membership?.role ?? "—"}
            </span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <SignOutButton />
            <ChangePassword />
          </div>
        </div>
      </div>
    </main>
  );
}
