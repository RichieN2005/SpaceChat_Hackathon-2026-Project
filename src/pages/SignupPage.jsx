import { useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import AuthField from "../components/auth/AuthField";
import AuthLayout from "../components/auth/AuthLayout";
import { useAuth } from "../components/auth/AuthProvider";
import { Icon } from "../components/landing/visuals";

export default function SignupPage() {
  const location = useLocation();
  const { signup } = useAuth();
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
    const callsign = String(fields.get("callsign") || "").trim();
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    const confirmation = String(fields.get("confirmPassword") || "");
    const nextErrors = {};

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(callsign)) nextErrors.callsign = "Choose 3–20 letters, numbers, or underscores.";
    if (!email) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (password.length < 8) nextErrors.password = "Use a password with at least 8 characters.";
    if (!confirmation) nextErrors.confirmPassword = "Enter your password again.";
    else if (password !== confirmation) nextErrors.confirmPassword = "Your passwords don’t match yet.";
    setErrors(nextErrors);
    setServerError("");

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    pending.current = true;
    setIsSubmitting(true);

    try {
      await signup({ username: callsign, email, password });
    } catch (error) {
      form.elements.namedItem("password").value = "";
      form.elements.namedItem("confirmPassword").value = "";
      setServerError(error instanceof Error ? error.message : "We couldn’t create your account. Please try again.");
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout mode="signup" title="Your next orbit" accent="starts here." description="Earthlings, aliens, and everyone in between. There’s a world for your kind of weird. Find your callsign and make yourself at home.">
      <form className="mt-7 space-y-4" onSubmit={submit} aria-busy={isSubmitting} noValidate>
        <AuthField label="Callsign" name="callsign" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="cosmic_overthinker" minLength={3} maxLength={20} hint="3–20 letters, numbers, or underscores. This is how the universe will know you." error={errors.callsign} onChange={() => clearError("callsign")} disabled={isSubmitting} />
        <AuthField label="Email address" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@yourplanet.com" error={errors.email} onChange={() => clearError("email")} disabled={isSubmitting} />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} error={errors.password} onChange={() => clearError("password")} disabled={isSubmitting} />
        <AuthField label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="One more time, traveler" minLength={8} error={errors.confirmPassword} onChange={() => clearError("confirmPassword")} disabled={isSubmitting} />
        <button className="flex min-h-[50px] w-full items-center justify-between gap-4 rounded bg-signal px-4 py-3.5 text-[15px] font-semibold text-[#160e0a] transition-colors hover:bg-[#ff8b72] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"} <Icon name="diagonal" size={18} />
        </button>
        {serverError && <p ref={errorSummary} tabIndex={-1} role="alert" className="rounded border border-[#bb6c54]/70 bg-[#332016]/65 p-3 text-sm leading-[1.8] text-[#ffd3c6] focus:outline-none focus:ring-2 focus:ring-signal/60">{serverError}</p>}
      </form>
      <p className="mt-6 border-t border-[#604739]/50 pt-5 text-center text-sm leading-[1.8] text-[#baaaa1]">Already found your orbit? <Link className="whitespace-nowrap text-[#ff9b80] underline-offset-4 hover:underline" to="/login" replace state={location.state?.fromOrbit ? { fromOrbit: true } : null}>Log in <span aria-hidden="true">↗</span></Link></p>
    </AuthLayout>
  );
}
