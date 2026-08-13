import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeControls } from "@/components/settings/theme-controls";
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

  return (
    <main className="mx-auto w-full max-w-3xl px-7 py-8">
      <Link href="/" className="mono" style={{ color: "var(--muted2)" }}>
        ← Hangar
      </Link>
      <h1 className="at-title page-title" style={{ margin: "12px 0 20px" }}>
        Settings
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ThemeControls />

        <div className="panel">
          <div className="panel-title">Account</div>
          <div className="ins-field">
            <span className="ins-field-label">Email</span>
            <span className="ins-field-value">{user?.email}</span>
          </div>
          <div className="ins-field">
            <span className="ins-field-label">Organization</span>
            <span className="ins-field-value">{orgName}</span>
          </div>
          <div className="ins-field">
            <span className="ins-field-label">Role</span>
            <span className="ins-field-value" style={{ textTransform: "capitalize" }}>
              {membership?.role ?? "—"}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <SignOutButton />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Integrations</div>
          <p style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.6 }}>
            Live tracking (ADS-B) and meter-photo reading run on the server — no
            API keys to manage here. Flight-plan data (FlightAware) is a future
            add-on for the operator plan.
          </p>
        </div>
      </div>
    </main>
  );
}
