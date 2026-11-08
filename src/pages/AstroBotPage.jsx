import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import ForumLayout, { BluePlanet, primaryButton, secondaryButton } from "../components/forum/ForumLayout";
import { useAuth } from "../components/auth/AuthProvider";
import { Icon } from "../components/landing/visuals";
import { forumApi } from "../lib/forum";

export default function AstroBotPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const end = useRef(null);
  useEffect(() => { document.title = "AstroBot — SpaceChat"; }, []);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ behavior: "instant", block: "end" }); }, [messages.length]);
  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pendingRef.current) return;
    pendingRef.current = true; setPending(true); setSending(message); setError("");
    try {
      const result = await forumApi.chat(message);
      if (typeof result.response !== "string" || !result.response.trim()) throw new Error("The communications array returned an empty signal. Please try again.");
      setMessages((previous) => [...previous, { role: "user", body: message }, { role: "bot", body: result.response }]);
      setDraft("");
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 401) { await refresh(); navigate("/login", { state: { returnTo: "/astrobot" } }); }
    } finally { pendingRef.current = false; setPending(false); setSending(""); }
  }
  return <ForumLayout><div className="mx-auto max-w-3xl">
    <section className="relative isolate overflow-hidden rounded-xl border border-[#7289b5]/25 bg-[#111a2b] p-6 sm:p-8"><BluePlanet className="absolute -top-20 -right-20 -z-1 w-80 opacity-30" /><p className="font-mono text-xs tracking-widest text-[#a6bfdf]">ASTROBOT / AI COMMUNICATIONS OFFICER</p><h1 className="mt-4 text-4xl font-medium tracking-tight">A curious mind onboard.</h1><p className="mt-4 max-w-lg text-sm leading-relaxed text-[#b6c5dc]">Ask a question, untangle an idea, or talk a little space. AstroBot is an AI character powered by Gemini, and its responses are generated.</p></section>
    <section aria-label="Chat with AstroBot" className="mt-5 rounded-xl border border-white/10 bg-[#11131b] p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5"><span className="inline-flex items-center gap-3 font-medium"><Icon name="orbit" className="text-[#9dbde4]" />AstroBot <span className="rounded border border-[#7d9cc0]/40 px-2 py-1 font-mono text-[11px] text-[#adc2e0]">AI</span></span><button type="button" className={secondaryButton} disabled={pending || !messages.length} onClick={() => { setMessages([]); setError(""); }}>Clear chat</button></div>
      <div role="log" aria-label="Conversation" aria-live="polite" className="space-y-5 py-6">
        {!messages.length && !pending && <p className="py-6 text-center text-sm leading-relaxed text-[#a4b1c7]">The channel is open, Earthling. What’s on your radar?</p>}
        {messages.map((message, index) => <article key={index} className={`rounded-lg p-4 ${message.role === "user" ? "ml-6 border border-white/8 bg-white/4" : "mr-6 border border-[#789ac3]/20 bg-[#19243a]"}`}><p className="mb-2 font-mono text-xs text-[#a5bddc]">{message.role === "user" ? "YOU" : "ASTROBOT · AI"}</p><p className="text-sm leading-[1.9] whitespace-pre-wrap text-[#d1d8e5] [overflow-wrap:anywhere]">{message.body}</p></article>)}
        {pending && <><article className="ml-6 rounded-lg border border-white/8 bg-white/4 p-4"><p className="mb-2 font-mono text-xs text-[#a5bddc]">YOU</p><p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{sending}</p></article><p role="status" className="text-sm text-[#afc4e1]">Receiving a signal from AstroBot…</p></>}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="mb-5 rounded-lg border border-signal/30 bg-signal/5 p-4 text-sm text-[#ffbead]">{error}</p>}
      <form onSubmit={send} className="border-t border-white/10 pt-5"><label htmlFor="astro-message" className="text-sm font-medium">Your transmission</label><textarea id="astro-message" required maxLength={2000} rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={pending} placeholder="Why does Neptune look blue?" className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-[#0d1019] p-4 text-base placeholder:text-[#8190a6] disabled:opacity-60" /><div className="mt-3 flex items-center justify-between gap-4"><span className="text-xs text-[#929fb5]">{draft.length}/2,000 · Each message is a new question.</span><button type="submit" disabled={pending || !draft.trim()} className={primaryButton}>{pending ? "Sending…" : "Send signal"}<Icon name="arrow" size={17} /></button></div></form>
    </section>
  </div></ForumLayout>;
}
