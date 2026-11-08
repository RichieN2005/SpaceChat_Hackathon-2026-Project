import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ForumLayout, { BluePlanet, LoadError, LoadingCards, secondaryButton } from "../components/forum/ForumLayout";
import { Icon, MiniPlanet } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";

export default function CommunitiesPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") || "").trim().slice(0, 200);
  const [draft, setDraft] = useState(query);
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const heading = useRef(null);

  useEffect(() => {
    document.title = query ? `Communities: ${query} — SpaceChat` : "Explore communities — SpaceChat";
    setDraft(query);
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const request = query ? forumApi.searchCommunities(query, controller.signal) : forumApi.communities(controller.signal);
    request.then((items) => { if (!controller.signal.aborted) setCommunities(items); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, retry]);

  function search(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.trim()) next.set("q", draft.trim());
    setParams(next);
  }

  return <ForumLayout>
    <section className="relative isolate mb-8 overflow-hidden rounded-xl border border-[#7289b5]/20 bg-[#111a2b] px-6 py-9 sm:px-9 sm:py-12">
      <BluePlanet className="absolute -right-20 -bottom-30 -z-1 w-80 opacity-40 sm:right-2 sm:-bottom-40 sm:w-[420px] sm:opacity-65" />
      <p className="font-mono text-xs tracking-[1.4px] text-[#a0badb]">FIND YOUR CORNER OF THE COSMOS</p>
      <h1 ref={heading} tabIndex={-1} className="mt-4 text-[clamp(32px,4vw,48px)] leading-tight font-medium tracking-[-1.2px] outline-none">Different worlds.<br /><span className="text-[#ff9b83]">Same wavelength.</span></h1>
      <p className="mt-5 max-w-lg text-sm leading-[1.85] text-[#bec8d8]">Explore the communities that make up SpaceChat. There’s room for every curiosity, from the familiar to the far out.</p>
    </section>

    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div><h2 className="text-2xl font-medium tracking-[-.6px]">{query ? "Community search" : "Explore communities"}</h2>{query && <p role="status" className="mt-2 text-sm text-[#a7adbf] [overflow-wrap:anywhere]">Results for “{query}”</p>}</div>
      <form role="search" onSubmit={search} className="flex w-full gap-2 sm:w-auto sm:max-w-md sm:flex-1">
        <label htmlFor="community-search" className="sr-only">Search communities</label>
        <input id="community-search" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={200} placeholder="Search communities" className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#151722] px-4 text-sm placeholder:text-[#8e94a6]" />
        <button type="submit" className={secondaryButton}>Search</button>
      </form>
    </div>

    {loading ? <LoadingCards count={3} /> : error ? <LoadError message={error} onRetry={() => setRetry((value) => value + 1)} /> : !communities.length ? <div className="rounded-xl border border-dashed border-white/15 bg-[#11131b]/90 px-6 py-14 text-center"><Icon name="orbit" size={38} className="mx-auto text-[#9cb7d8]" /><h2 className="mt-5 text-xl font-medium">{query ? "No communities on that frequency." : "A new universe is taking shape."}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#a7adbf]">{query ? "Try another name or explore all communities." : "Public communities will appear here as they are created."}</p>{query && <Link to="/communities" className={`${secondaryButton} mt-6`}>Explore all communities</Link>}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {communities.map((community, index) => <Link key={community.id} to={`/communities/${community.id}`} className="group flex min-w-0 flex-col rounded-xl border border-white/10 bg-[#11131b]/95 p-6 transition-colors hover:border-[#a7bddb]/40 hover:bg-[#151925]">
        <div className="flex items-center gap-3"><MiniPlanet planet={["earth", "mars", "saturn"][index % 3]} /><h3 className="min-w-0 text-lg leading-snug font-medium text-[#d9e4f4] [overflow-wrap:anywhere]">s/{community.name}</h3></div>
        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-[1.85] whitespace-pre-line text-[#aeb5c7] [overflow-wrap:anywhere]">{community.description || "A little corner of the cosmos. Bring your curiosity."}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-4 text-xs text-[#a4b6d0]">{Number.isSafeInteger(community.member_count) ? <span>{community.member_count.toLocaleString()} {community.member_count === 1 ? "member" : "members"}</span> : <span>Public community</span>}<span className="inline-flex items-center gap-2 group-hover:text-white">Explore <Icon name="diagonal" size={15} /></span></div>
      </Link>)}
    </div>}
  </ForumLayout>;
}
