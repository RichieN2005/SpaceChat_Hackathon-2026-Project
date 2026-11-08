import { useId, useState } from "react";

function VisibilityIcon({ visible }) {
  return (
    <svg className="size-[17px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

export default function AuthField({ label, name, type = "text", error, hint, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");

  return (
    <div>
      <label className="mb-2.5 block text-sm font-medium text-[#e0d3cb]" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          className={`min-h-12 w-full rounded border bg-[#0c0a0a]/65 px-3.5 py-3 text-base text-starlight transition-colors placeholder:text-[#796b65] focus:border-signal focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-signal motion-reduce:transition-none ${error ? "border-[#ff8b75]" : "border-[#544038] hover:border-[#88634f]"} ${isPassword ? "pr-[84px]" : ""}`}
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          required
          {...props}
        />
        {isPassword && (
          <button className="absolute inset-y-0 right-0 flex items-center gap-1.5 rounded-r px-3 text-xs text-[#c9b7ac] transition-colors hover:text-white disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none" type="button" onClick={() => setVisible(!visible)} disabled={props.disabled} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}>
            <VisibilityIcon visible={visible} />
            <span>{visible ? "Hide" : "Show"}</span>
          </button>
        )}
      </div>
      {hint && <p className="mt-2 text-xs leading-[1.7] text-[#a39085]" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="mt-2 text-[14px] leading-[1.7] text-[#ff9a83]" id={`${id}-error`}>{error}</p>}
    </div>
  );
}
