export default function SelectControl({ children, className = "", ...props }) {
  return <span className="relative block w-full min-w-0 sm:w-auto">
    <select {...props} className={`min-h-11 w-full min-w-0 appearance-none rounded-lg border border-white/15 bg-[#13151f] py-2 pr-11 pl-3 text-sm leading-5 text-starlight ${className}`}>
      {children}
    </select>
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#a5aabc]"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>;
}
