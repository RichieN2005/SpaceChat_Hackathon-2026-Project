import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { Icon, Logo } from "../landing/visuals";
import { safeReturnTo } from "../../lib/authNavigation";

export default function AuthLayout({ mode, title, accent, description, children }) {
  const headingRef = useRef(null);
  const returningRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fromFeed = !location.state?.fromOrbit && location.state && Object.hasOwn(location.state, "returnTo");

  function returnToPreviousPage() {
    if (returningRef.current) return;
    returningRef.current = true;
    if (location.state?.fromOrbit) {
      navigate(-1);
    } else if (fromFeed) {
      navigate(safeReturnTo(location.state.returnTo), { replace: true });
    } else {
      navigate("/landing", { state: { returnFromSurface: mode } });
    }
  }

  useEffect(() => {
    const previousTitle = document.title;
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.title = `${mode === "signup" ? "Sign up" : "Log in"} — SpaceChat`;
    document.documentElement.style.scrollBehavior = "auto";
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
    return () => { document.title = previousTitle; };
  }, [mode]);

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-space text-starlight">
      <div className="pointer-events-none fixed inset-0 -z-2 overflow-hidden" aria-hidden="true">
        <img
          className="absolute inset-0 size-full scale-[2.8] object-cover object-center saturate-[.88]"
          src="/images/red-moon.jpg"
          alt=""
          width="1200"
          height="1200"
          fetchPriority="high"
        />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-1 bg-[linear-gradient(110deg,rgba(9,9,11,.85)_0%,rgba(9,9,11,.59)_48%,rgba(9,9,11,.38)_100%)]" aria-hidden="true" />

      <header className="mx-auto flex h-[100px] w-[calc(100%-32px)] max-w-[1312px] shrink-0 items-center justify-between gap-3 border-b border-white/12 sm:w-[calc(100%-80px)] lg:h-[110px] lg:w-[calc(100%-128px)]">
        <Logo onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          returnToPreviousPage();
        }} />
        <button type="button" onClick={returnToPreviousPage} aria-label={fromFeed ? "Back to the conversation" : "Back to orbit"} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/25 bg-space/35 px-3 py-2 text-sm font-medium text-starlight transition-colors hover:border-signal hover:bg-space/60 sm:gap-2.5 sm:px-4 sm:text-base motion-reduce:transition-none">
          <Icon name="arrow" size={18} className="rotate-180" />
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">{fromFeed ? "Back to the conversation" : "Back to orbit"}</span>
        </button>
      </header>

      <main className="mx-auto grid w-[calc(100%-48px)] max-w-[1170px] flex-1 animate-auth-reveal items-center gap-9 py-10 sm:w-[calc(100%-80px)] sm:py-14 lg:w-[calc(100%-128px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16 lg:py-16 motion-reduce:animate-none">
        <div className="min-w-0 lg:pb-10">
          <p className="mb-5 flex items-center gap-2.5 font-mono text-[12px] tracking-[1.2px] text-[#d0b4a9] sm:mb-7 sm:text-xs">
            <span className="size-[5px] shrink-0 rounded-full bg-signal shadow-[0_0_10px_#fa715966]" />
            {mode === "signup" ? "FIRST CONTACT / NEW ARRIVAL" : "SIGNAL RECONNECTED / WELCOME HOME"}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="m-0 text-[clamp(40px,6.6vw,82px)] leading-[1.06] font-medium tracking-[-1.5px] outline-none sm:tracking-[-2.5px] lg:tracking-[-3.5px]">
            {title}<br /><span className="text-signal">{accent}</span>
          </h1>
          <p className="mt-6 max-w-[420px] text-[16px] leading-[1.85] text-[#d0bbb3] sm:mt-7 sm:text-base">{description}</p>
          <div className="mt-12 hidden items-center gap-5 border-t border-white/15 pt-6 lg:flex">
            <Icon name="orbit" size={30} className="text-[#e5a287]" />
            <div className="font-mono text-[12px] leading-[1.9] tracking-[1px] text-[#b79e95]">
              <span className="block text-[#e2c9bc]">DIFFERENT PLANETS. SAME CURIOSITY.</span>
              NO SPACESHIP REQUIRED.
            </div>
          </div>
        </div>
        <section className="w-full rounded-[10px] border border-[#7f5b4d]/45 bg-[#100d0d]/85 p-6 shadow-[0_25px_90px_#0005] backdrop-blur-xl sm:p-8" aria-labelledby="auth-form-title">
          <p className="mb-3 font-mono text-[12px] tracking-[1.2px] text-[#bda397]">{mode === "signup" ? "YOUR PLACE IN THE UNIVERSE" : "YOUR FREQUENCY IS WAITING"}</p>
          <h2 className="text-[30px] leading-tight font-medium tracking-[-.8px] sm:text-[32px]" id="auth-form-title">{mode === "signup" ? "Create your account" : "Log in to SpaceChat"}</h2>
          <p className="mt-3 text-sm leading-[1.8] text-[#b6a7a0]">{mode === "signup" ? "A callsign, a little curiosity, and you’re on your way." : "Pick up the conversation where you left off."}</p>
          {children}
        </section>
      </main>

      <footer className="mx-auto flex w-[calc(100%-48px)] max-w-[1312px] shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/12 py-5 font-mono text-[11px] leading-[1.7] tracking-[1px] text-[#bea497] sm:w-[calc(100%-80px)] lg:w-[calc(100%-128px)]">
        <span>SC—001 / LUNAR SURFACE</span>
        <span>MADE ON EARTH. OPEN TO EVERYONE.</span>
      </footer>
    </div>
  );
}
