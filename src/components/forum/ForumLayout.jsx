import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Icon, Logo, Starfield } from "../landing/visuals";

export const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-[#190e0b] transition-colors hover:bg-[#ff927b] disabled:cursor-wait disabled:opacity-60";
export const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/3 px-4 py-2 text-sm font-medium transition-colors hover:border-white/35 hover:bg-white/7 disabled:cursor-wait disabled:opacity-60";

function SearchIcon() {
  return <svg aria-hidden="true" className="size-5 shrink-0 text-[#9296a3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
}

export function BluePlanet({ className = "" }) {
  return <div aria-hidden="true" className={`pointer-events-none aspect-square ${className}`}>
    <div className="absolute inset-4 rounded-full bg-[#4771cf]/20 blur-3xl" />
    <div className="absolute inset-[8%] overflow-hidden rounded-full border border-[#a4c7ff]/20 bg-[#3b7aad] shadow-[inset_-35px_-20px_60px_#040916,0_0_55px_#457cdf20]" style={{ backgroundImage: "radial-gradient(circle at 24% 24%, #a6e9ec99, transparent 52%), repeating-linear-gradient(164deg, #2862a6 0%, #448db7 7%, #4988b0 10%, #22528e 17%, #254779 21%, #5691b0 24%, #306da5 28%)" }}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_26%_25%,transparent_20%,#05132a80_61%,#030710_91%)]" />
      <div className="absolute top-[59%] left-[24%] h-[5%] w-[16%] -rotate-15 rounded-[100%] bg-[#122c60]/70 blur-[3px]" />
    </div>
    <div className="absolute top-[42%] -left-[6%] h-[18%] w-[112%] -rotate-25 rounded-[50%] border border-[#9fbce2]/20" />
    <div className="absolute top-[40%] -left-[9%] h-[22%] w-[118%] -rotate-25 rounded-[50%] border border-[#9fbce2]/8" />
  </div>;
}

function HeaderSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  useEffect(() => { setQuery(params.get("q") || ""); }, [location.search]);
  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams(location.pathname === "/" ? location.search : "");
    const value = query.trim();
    if (value) next.set("q", value); else next.delete("q");
    navigate(next.size ? `/?${next}` : "/");
  }
  return <form role="search" onSubmit={search} className="order-3 flex h-11 w-full items-center gap-3 rounded-lg border border-white/12 bg-[#15161d] px-3 focus-within:border-[#91add1]/60 md:order-none md:max-w-[430px] md:flex-1">
    <SearchIcon />
    <label className="sr-only" htmlFor="cosmic-search">Search public posts</label>
    <input id="cosmic-search" name="q" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} placeholder="Search the universe" className="min-w-0 flex-1 bg-transparent text-sm text-starlight outline-none! placeholder:text-[#9495a2]" />
    <button type="submit" aria-label="Search posts" className="grid size-9 shrink-0 place-items-center rounded text-[#acaeb9] hover:bg-white/8 hover:text-starlight"><Icon name="arrow" size={18} /></button>
  </form>;
}

export default function ForumLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const viewingJoined = location.pathname === "/communities" && new URLSearchParams(location.search).get("view") === "joined";
  const communityRoute = location.pathname === "/communities" || location.pathname.startsWith("/communities/");
  const navigation = [
    { path: "/", label: "Feed", active: location.pathname === "/" },
    { path: "/communities", label: "Communities", active: communityRoute && !viewingJoined },
    ...(status === "authenticated" ? [{ path: "/communities?view=joined", label: "Your communities", active: viewingJoined }] : []),
    { path: "/submit", label: "Create post", active: location.pathname === "/submit" },
    { path: "/astrobot", label: "AstroBot · AI", active: location.pathname === "/astrobot" },
    { path: "/landing", label: "Our universe", active: location.pathname === "/landing" },
  ];
  async function signOut() {
    if (pending) return;
    setPending(true); setError("");
    try { await logout(); } catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }
  return <div className="relative isolate min-h-dvh overflow-x-clip bg-[#090a0f] text-starlight">
    <Starfield />
    <div aria-hidden="true" className="pointer-events-none fixed -top-30 right-0 -z-1 size-[650px] max-w-full rounded-full bg-[#254074]/10 blur-[100px]" />
    <a href="#forum-main" className="sr-only fixed top-3 left-3 z-50 rounded bg-signal p-3 text-space focus:not-sr-only">Skip to content</a>
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0c12]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-3 px-4 py-4 sm:gap-x-5 sm:px-7 lg:px-10">
        <Logo small onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); navigate("/");
        }} />
        <NavLink to="/" end className={({ isActive }) => `hidden min-h-11 items-center px-2 text-sm font-medium sm:inline-flex ${isActive ? "text-starlight" : "text-[#a5a6b2] hover:text-starlight"}`}>Home</NavLink>
        <HeaderSearch />
        <nav aria-label="Account" className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          {status === "authenticated" ? <><Link to={`/users/${user.id}`} className="max-w-28 truncate px-2 py-3 text-sm text-[#bbc0ce] hover:text-white" title={user.username}>My profile</Link><button type="button" onClick={signOut} disabled={pending} className={secondaryButton}>{pending ? "Logging out…" : "Log out"}</button></> : <><Link to="/login" state={{ returnTo }} className={`${secondaryButton} text-starlight`}>Log in</Link><Link to="/signup" state={{ returnTo }} className={primaryButton}>Sign up</Link></>}
        </nav>
      </div>
      <nav aria-label="Explore SpaceChat" className="mx-auto flex max-w-[1440px] flex-wrap gap-x-5 border-t border-white/5 px-4 sm:px-7 lg:px-10">{navigation.map(({ path, label, active }) => <Link key={path} to={path} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 text-xs ${active ? "border-signal text-white" : "border-transparent text-[#a3adbf] hover:text-white"}`}>{label}</Link>)}</nav>
      {error && <p role="alert" className="mx-auto max-w-[1440px] px-4 pb-3 text-sm text-[#ffb39e] sm:px-7 lg:px-10">{error}</p>}
    </header>
    <main id="forum-main" className="mx-auto max-w-[1280px] px-4 pt-6 pb-14 sm:px-7 sm:pt-8 lg:px-10">{children}</main>
    <footer className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-6 text-xs text-[#9598a7] sm:px-7 lg:px-10"><span>Made on Earth. Open to everyone.</span><Link to="/landing" className="inline-flex items-center gap-2 hover:text-starlight">About SpaceChat <Icon name="diagonal" size={14} /></Link></footer>
  </div>;
}

export function LoadError({ message, onRetry, title = "A little interference." }) {
  return <div role="alert" className="rounded-xl border border-[#fa7159]/25 bg-[#1b1416] p-6 sm:p-8"><Icon name="orbit" size={28} className="mb-4 text-signal" /><h2 className="text-xl font-medium">{title}</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#c0b7bd]">{message}</p>{onRetry && <button type="button" onClick={onRetry} className={`${secondaryButton} mt-5`}>Try again <Icon name="arrow" size={16} /></button>}</div>;
}

export function LoadingCards({ count = 3 }) {
  return <div role="status" aria-label="Loading transmissions" className="space-y-4"><span className="sr-only">Loading transmissions…</span>{Array.from({ length: count }, (_, index) => <div key={index} aria-hidden="true" className="rounded-xl border border-white/10 bg-[#11131b]/95 p-6 motion-safe:animate-pulse"><div className="mb-5 h-3 w-40 rounded bg-white/10" /><div className="h-5 w-4/5 rounded bg-white/10" /><div className="mt-4 h-3 w-full rounded bg-white/5" /><div className="mt-3 h-3 w-2/3 rounded bg-white/5" /></div>)}</div>;
}
