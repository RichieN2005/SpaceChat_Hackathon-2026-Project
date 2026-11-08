import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import AuthField from "../components/auth/AuthField";
import AuthLayout from "../components/auth/AuthLayout";
import { useAuth } from "../components/auth/AuthProvider";
import { Icon } from "../components/landing/visuals";
import { authNavigationState } from "../lib/authNavigation";

export default function LoginPage() {
  const location = useLocation();
  const { login } = useAuth();
  const pending = useRef(false);
  const errorSummary = useRef(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearError(name) {
    setErrors((current) => ({ ...current, [name]: undefined }));
    setServerError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const identifier = String(fields.get("identifier") || "").trim();
    const password = String(fields.get("password") || "");
    const nextErrors = {};

    if (!identifier) nextErrors.identifier = "Enter your email address or username.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    setServerError("");

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    pending.current = true;
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
    } catch (error) {
      form.elements.namedItem("password").value = "";
      setServerError(error instanceof Error ? error.message : "We couldn’t log you in. Please try again.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout mode="login" title="Welcome back," accent="space traveler." description="A familiar frequency in a very big universe. Come back to your people, your worlds, and the conversations you left in orbit.">
      {location.state?.signupComplete && <p role="status" className="mt-6 rounded border border-signal/40 bg-signal/10 p-3 text-sm leading-[1.8] text-[#ffcfb9]">Account created. Log in with your new username or email and password.</p>}
      <form className="mt-7 space-y-5" onSubmit={submit} aria-busy={isSubmitting} noValidate>
        <AuthField label="Email or username" name="identifier" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@yourplanet.com or callsign" error={errors.identifier} onChange={() => clearError("identifier")} disabled={isSubmitting} />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" placeholder="Your secret transmission" error={errors.password} onChange={() => clearError("password")} disabled={isSubmitting} />
        <button className="flex min-h-[50px] w-full items-center justify-between gap-4 rounded bg-signal px-4 py-3.5 text-[15px] font-semibold text-[#160e0a] transition-colors hover:bg-[#ff8b72] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"} <Icon name="diagonal" size={18} />
        </button>
        {serverError && <p ref={errorSummary} tabIndex={-1} role="alert" className="rounded border border-[#bb6c54]/70 bg-[#332016]/65 p-3 text-sm leading-[1.8] text-[#ffd3c6] focus:outline-none focus:ring-2 focus:ring-signal/60">{serverError}</p>}
      </form>
      <p className="mt-7 border-t border-[#604739]/50 pt-5 text-center text-sm leading-[1.8] text-[#baaaa1]">New to this part of the universe? <Link className="whitespace-nowrap text-[#ff9b80] underline-offset-4 hover:underline" to="/signup" replace state={authNavigationState(location.state)}>Sign up <span aria-hidden="true">↗</span></Link></p>
    </AuthLayout>
  );
}
