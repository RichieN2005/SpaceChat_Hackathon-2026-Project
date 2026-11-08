import { useEffect, useRef, useState } from 'react';

/**
 * AstroBot dock. Mount this once near the React root.
 * General chat calls the existing /api/ai/chat URL, now rate limited by Flask.
 * In a real community post dialog, users can opt in to a public reply.
 * No API credentials ever enter browser JavaScript.
 */
export default function AstroBotChat({ postId = null, onThreadReply, inDialog = false }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('chat');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([
    { from: 'bot', text: 'Greetings, Earthling. I am AstroBot, your AI guide to the cosmos. Ask me anything about space.' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  useEffect(() => { setMode("chat"); }, [postId]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [open, history]);

  async function submit(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setError('');
    setBusy(true);
    setHistory((old) => [...old, { from: 'user', text }]);

    try {
      if (mode === 'thread' && postId) {
        // Automatically opt in by including the explicit mention.
        const body = /(^|\W)@AstroBot\b/i.test(text) ? text : `@AstroBot ${text}`;
        const result = await fetch(`/api/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ body }),
        });
        const data = await result.json().catch(() => ({}));
        if (!result.ok) {
          throw new Error(result.status === 401 ? 'Log in to post a public mention.' : data.error || 'Unable to post comment.');
        }
        const status = result.headers.get('X-AstroBot-Status');
        setMessage('');
        setHistory((old) => [...old, { from: 'bot', text: status === 'completed' ? 'Your mention and AstroBot reply are now in the discussion.' : 'Your mention was saved. AstroBot could not reply right now.' }]);
        await onThreadReply?.();
        return;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || (response.status === 429
          ? "AstroBot has reached a request or usage limit. Please try again later."
          : response.status === 401 ? "Log in to chat with AstroBot." : "Unable to reach AstroBot. Please try again shortly."));
      }
      setMessage('');
      setHistory((old) => [...old, { from: 'bot', text: data.response || 'No response received.' }]);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed bottom-5 right-5 font-sans text-white ${inDialog ? "z-[1100]" : "z-50"}`}>
      {open && (
        <section
          aria-label="AstroBot AI chat"
          className="mb-3 flex h-[min(70vh,520px)] w-[min(90vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-600 bg-[#0a0f20] shadow-2xl shadow-black/60"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-base font-semibold">✦ AstroBot <span className="ml-1 rounded bg-indigo-500/25 px-2 py-0.5 text-xs text-indigo-200">AI</span></div>
              <p className="text-xs text-slate-400">Powered by Gemini · Answers may be inaccurate</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-2 text-slate-300 hover:bg-white/10" aria-label="Close AstroBot">✕</button>
          </header>
          {postId && (
            <div className="flex gap-2 border-b border-white/10 px-3 py-2 text-xs">
              <button type="button" disabled={busy} onClick={() => setMode('chat')} className={`rounded-lg px-3 py-2 ${mode === 'chat' ? 'bg-indigo-600' : 'bg-white/10'}`}>Direct chat</button>
              <button type="button" disabled={busy} onClick={() => setMode('thread')} className={`rounded-lg px-3 py-2 ${mode === 'thread' ? 'bg-indigo-600' : 'bg-white/10'}`}>Ask in this thread</button>
            </div>
          )}
          <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {mode === 'thread' && postId && (
              <p className="rounded-lg bg-indigo-400/10 p-3 text-xs text-indigo-100">Your message will be posted publicly as a comment mentioning @AstroBot. Sign in first.</p>
            )}
            {history.map((item, index) => (
              <div key={index} className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 ${item.from === 'user' ? 'ml-auto bg-indigo-600' : 'mr-auto bg-slate-800'}`}>
                {item.from === 'bot' && <span className="mb-1 block text-xs font-semibold text-indigo-200">AstroBot · AI</span>}
                {item.text}
              </div>
            ))}
            {busy && <p className="text-xs text-slate-400">AstroBot is thinking…</p>}
          </div>
          {error && <p role="alert" className="px-4 pb-2 text-xs text-rose-300">{error}</p>}
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
            <label className="sr-only" htmlFor={postId ? `astrobot-message-${postId}` : "astrobot-message"}>Message AstroBot</label>
            <input id={postId ? `astrobot-message-${postId}` : "astrobot-message"} type="text" maxLength={1600} value={message} disabled={busy} onChange={(e) => setMessage(e.target.value)}
              placeholder={mode === 'thread' ? 'Ask in this discussion…' : 'Ask about the universe…'}
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
            <button type="submit" disabled={busy || !message.trim()} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">Send</button>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)}
        className="ml-auto block rounded-full border border-indigo-500 bg-indigo-700 px-5 py-3 font-semibold shadow-xl hover:bg-indigo-600"
        aria-label={open ? 'Close AstroBot' : 'Open AstroBot AI chat'} aria-expanded={open}>
        ✦ {open ? 'Close' : 'Ask AstroBot'}
      </button>
    </div>
  );
}
