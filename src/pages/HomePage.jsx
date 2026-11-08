import { useEffect, useRef, useState } from "react";
import { useAuth } from "../components/auth/AuthProvider";

export default function HomePage() {
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const headingRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Home — SpaceChat";
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => { document.title = previousTitle; };
  }, []);

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await logout();
    } catch (failure) {
      setError(failure.message);
      setPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-space p-6 text-starlight sm:p-10">
      <div className="flex items-center justify-between gap-6">
        <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-medium outline-none">Home</h1>
        <button type="button" onClick={signOut} disabled={pending} className="rounded border border-white/25 px-4 py-2 text-sm hover:border-signal disabled:cursor-wait disabled:opacity-60">{pending ? "Logging out…" : "Log out"}</button>
      </div>
      {error && <p role="alert" className="mt-5 text-sm text-[#ff9a83]">{error}</p>}
    </main>
  );
}
