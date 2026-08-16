"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// v1 offered sign-in, account creation and a password reset (toggleAuthMode,
// showForgotPassword, submitForgotPassword, sendPasswordReset). The first port
// shipped sign-in only, leaving a locked-out user with no way back in.
type Mode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      setNotice("Check your email for a reset link.");
      return;
    }

    if (mode === "signup") {
      const f = first.trim();
      const l = last.trim();
      if (!f || !l) {
        setBusy(false);
        setError("Enter your first and last name.");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // full_name stays the display value everything else reads —
          // grant stamping, initials, the access list — with the parts kept
          // alongside so they can be edited separately later.
          data: { first_name: f, last_name: l, full_name: `${f} ${l}` },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
      // When "Confirm email" is off, signUp hands back a live session and no
      // mail is ever sent. Telling those users to check their inbox stranded
      // them at the login form waiting on an email that never arrives, so go
      // by whether a session actually came back rather than assuming.
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setNotice("Account created. Check your email to confirm, then sign in.");
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push("/");
    router.refresh();
  }

  const title =
    mode === "signup" ? "Create your account"
      : mode === "forgot" ? "Reset your password"
        : "Aviation management — sign in to sync across devices";

  const cta =
    mode === "signup" ? (busy ? "Creating…" : "Create Account")
      : mode === "forgot" ? (busy ? "Sending…" : "Send reset link")
        : (busy ? "Signing in…" : "Sign In");

  return (
    <div className="auth-screen">
      <form onSubmit={onSubmit} className="auth-card">
        <div className="auth-brand">
          <span className="nav-dot" />
          AeroTrack
        </div>
        <div className="auth-sub">{title}</div>
        <div
          className="mono"
          style={{ fontSize: 10, letterSpacing: ".1em", marginBottom: 8 }}
        >
          {mode === "signup" ? "CREATE ACCOUNT" : mode === "forgot" ? "PASSWORD RESET" : "SIGN IN"}
        </div>

        {mode === "signup" && (
          // Split and required. A single optional box left accounts with no
          // name at all, and those read as a bare email address to everyone
          // they share an aircraft with.
          <div className="auth-split">
            <input
              required
              placeholder="First name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="auth-input"
              autoComplete="given-name"
            />
            <input
              required
              placeholder="Last name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="auth-input"
              autoComplete="family-name"
            />
          </div>
        )}

        <input
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
          autoComplete="email"
        />

        {mode !== "forgot" && (
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        )}

        <button type="submit" disabled={busy} className="auth-btn">
          {cta}
        </button>

        <div className="auth-err">{error ?? ""}</div>
        {notice && (
          <div style={{ fontSize: 12, color: "var(--ok)", fontFamily: "var(--mono)" }}>
            {notice}
          </div>
        )}

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 12, color: "var(--muted2)" }}>
          {mode === "login" ? (
            <>
              <div>
                Don&apos;t have an account?{" "}
                <button type="button" className="auth-link" onClick={() => switchTo("signup")}>
                  Create one
                </button>
              </div>
              <div style={{ marginTop: 6 }}>
                <button type="button" className="auth-link" onClick={() => switchTo("forgot")}>
                  Forgot password?
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="auth-link" onClick={() => switchTo("login")}>
              ← Back to sign in
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
