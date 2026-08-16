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
  const [name, setName] = useState("");
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() || null },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (error) { setError(error.message); return; }
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
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            autoComplete="name"
          />
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
