import { useState } from "react";
import { Link, useLocation } from "react-router";
import AuthField from "../components/auth/AuthField";
import AuthLayout from "../components/auth/AuthLayout";
import { Icon } from "../components/landing/visuals";

export default function LoginPage() {
  const location = useLocation();
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");

  function clearError(name) {
    setErrors((current) => ({ ...current, [name]: undefined }));
    setNotice("");
  }

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") || "").trim();
    const password = String(fields.get("password") || "");
    const nextErrors = {};

    if (!email) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Enter a valid email address.";
    if (password.length < 8) nextErrors.password = "Use a password with at least 8 characters.";
    setErrors(nextErrors);
    setNotice("");

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    form.reset();
    setNotice("Authentication is coming soon. This preview doesn’t sign you in or create an account. Your details haven’t been sent.");
  }

  return (
    <AuthLayout mode="login" title="Welcome back," accent="space traveler." description="A familiar frequency in a very big universe. Come back to your people, your worlds, and the conversations you left in orbit.">
      <form className="mt-7 space-y-5" onSubmit={submit} noValidate>
        <AuthField label="Email address" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@yourplanet.com" error={errors.email} onChange={() => clearError("email")} />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" placeholder="Your secret transmission" minLength={8} error={errors.password} onChange={() => clearError("password")} />
        <button className="flex min-h-[50px] w-full items-center justify-between gap-4 rounded bg-signal px-4 py-3.5 text-[15px] font-semibold text-[#160e0a] transition-colors hover:bg-[#ff8b72] motion-reduce:transition-none" type="submit">
          Log in <Icon name="diagonal" size={18} />
        </button>
        <p role="status" className={notice ? "rounded border border-[#8b654b]/60 bg-[#332016]/65 p-3 text-sm leading-[1.8] text-[#efd2bd]" : "sr-only"}>{notice}</p>
      </form>
      <p className="mt-4 font-mono text-[12px] leading-[1.7] tracking-[.3px] text-[#ab9587]">AUTHENTICATION PREVIEW · NO DATA IS SENT</p>
      <p className="mt-7 border-t border-[#604739]/50 pt-5 text-center text-sm leading-[1.8] text-[#baaaa1]">New to this part of the universe? <Link className="whitespace-nowrap text-[#ff9b80] underline-offset-4 hover:underline" to="/signup" replace state={location.state?.fromOrbit ? { fromOrbit: true } : null}>Sign up <span aria-hidden="true">↗</span></Link></p>
    </AuthLayout>
  );
}
