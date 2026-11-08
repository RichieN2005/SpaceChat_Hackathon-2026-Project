import { useEffect, useState } from "react";
import { Link } from "react-router";
import { forumApi } from "../../lib/forum";
import { Icon, MiniPlanet } from "./visuals";

export default function PopularCommunities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    forumApi.popularCommunities(controller.signal)
      .then((items) => { if (!controller.signal.aborted) setCommunities(items); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6 sm:mb-10">
      <div>
        <p className="mb-5 font-mono text-xs tracking-[1.2px] text-[#b4a6a2]"><span className="mr-3 text-signal">01 /</span>FIND YOUR NEXT ORBIT</p>
        <h2 id="universe-title" className="text-[38px] leading-[1.12] font-medium tracking-[-1.5px] sm:text-[43px] lg:text-[50px]">Popular communities<span className="text-signal">.</span></h2>
        <p className="mt-5 max-w-lg text-sm leading-[1.85] text-[#aaa0a6]">Find your people in the busiest corners of the cosmos. Ranked by the number of public posts.</p>
      </div>
      <div className="flex flex-wrap gap-4"><Link to="/communities?view=joined" className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-signal/40 bg-signal/8 px-4 text-sm font-medium text-[#ffc1ab] hover:border-signal hover:bg-signal/12"><Icon name="orbit" size={18} />Your communities</Link><Link to="/" className="inline-flex min-h-11 items-center gap-3 text-sm text-[#e2c5ba] hover:text-white">Explore all transmissions <Icon name="diagonal" size={18} /></Link></div>
    </div>

    {loading ? <div role="status" aria-label="Loading popular communities" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Locating popular communities…</span>
      {Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="rounded-lg border border-[#343034] bg-[#131114] p-6 motion-safe:animate-pulse"><div className="mb-6 size-12 rounded-full bg-white/8" /><div className="h-5 w-2/3 rounded bg-white/8" /><div className="mt-4 h-3 w-full rounded bg-white/5" /><div className="mt-3 h-3 w-1/2 rounded bg-white/5" /></div>)}
    </div> : error ? <div role="alert" className="rounded-lg border border-signal/25 bg-[#1c1215] p-6 sm:p-8">
      <h3 className="text-xl font-medium">A little interference.</h3>
      <p className="mt-3 text-sm leading-relaxed text-[#c3adb4]">{error}</p>
      <button type="button" onClick={() => setRetry((current) => current + 1)} className="mt-5 inline-flex min-h-11 items-center gap-3 rounded border border-[#71594f] px-4 text-sm hover:border-signal">Try again <Icon name="arrow" size={17} /></button>
    </div> : communities.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {communities.map((community, index) => <Link key={community.id} to={`/?community=${community.id}`} className="group flex min-w-0 flex-col rounded-lg border border-[#343034] bg-[radial-gradient(ellipse_at_100%_0%,#c8876214,transparent_75%)] p-6 transition-colors hover:border-[#a66b55] hover:bg-[#191316] motion-reduce:transition-none">
        <div className="mb-6 flex items-center justify-between gap-4"><MiniPlanet planet={["earth", "mars", "saturn"][index % 3]} className="size-12!" /><span className="font-mono text-xs text-[#ad8e83]">{String(index + 1).padStart(2, "0")} /</span></div>
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-medium tracking-[-.4px] text-[#f1ded5] [overflow-wrap:anywhere]">s/{community.name}</h3>{community.is_member === true && <span className="rounded-full border border-[#83ba9c]/30 bg-[#316149]/20 px-2.5 py-1 text-xs font-medium text-[#b4dfc7]">Joined</span>}</div>
        <p className="mt-3 mb-6 line-clamp-3 text-sm leading-[1.85] text-[#afa0a8]">{community.description || "A little space for shared curiosity."}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#35282c] pt-4 text-xs text-[#c5afa4]">
          <span>{Number.isInteger(community.post_count) ? `${community.post_count.toLocaleString()} public ${community.post_count === 1 ? "post" : "posts"}` : "View community"}</span>
          <Icon name="diagonal" size={18} className="text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" />
        </div>
      </Link>)}
    </div> : <div className="rounded-lg border border-dashed border-[#514044] bg-[#131114] px-6 py-10 text-center"><Icon name="orbit" size={34} className="mx-auto text-[#c69782]" /><h3 className="mt-5 text-xl font-medium">New worlds are on the horizon.</h3><p className="mt-3 text-sm text-[#b4a2ab]">No public communities have been created yet.</p><Link to="/" className="mt-5 inline-flex min-h-11 items-center gap-3 text-sm text-[#efb49e] hover:text-white">Explore the feed <Icon name="arrow" size={17} /></Link></div>}
  </>;
}
