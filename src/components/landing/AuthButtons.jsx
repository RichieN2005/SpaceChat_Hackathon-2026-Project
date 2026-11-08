// The landing page supplies the shared planet-to-auth transition handler.
export default function AuthButtons({ onAction, className = "" }) {
  return (
    <div className={`items-center gap-3 min-[961px]:gap-4 ${className}`}>
      <button
        type="button"
        onClick={() => onAction("login")}
        className="min-h-10 whitespace-nowrap bg-transparent px-2 text-xs text-[#d7d2cf] transition-colors hover:text-white motion-reduce:transition-none"
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => onAction("signup")}
        className="min-h-10 whitespace-nowrap rounded-[3px] bg-signal px-4 text-xs font-semibold text-[#130d0a] transition-colors hover:bg-[#ff8b72] motion-reduce:transition-none"
      >
        Sign up
      </button>
    </div>
  );
}
