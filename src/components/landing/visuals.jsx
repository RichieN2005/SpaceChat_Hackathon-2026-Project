import "./effects.css";

export function Icon({ name, size = 20, className = "", ...props }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    diagonal: <path d="M6 18 18 6M6 6h12v12" />,
    down: <path d="M12 4v15m-6-6 6 6 6-6" />,
    chat: (
      <>
        <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4A8.5 8.5 0 1 1 20 11.5Z" />
        <path d="M8 10h7M8 13h4" />
      </>
    ),
    spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />,
    orbit: (
      <>
        <circle cx="12" cy="12" r="5" />
        <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-30 12 12)" />
      </>
    ),
    menu: <path d="M4 8h16M4 16h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    up: <path d="m6 14 6-6 6 6M12 8v12" />,
  };

  return (
    <svg
      className={`shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}

export function Logo({ small = false }) {
  const wordmark = small
    ? "gap-2 text-[21px] tracking-[-.8px] max-[701px]:gap-[7px]"
    : "gap-[11px] text-[27px] tracking-[-1.2px] max-[961px]:text-[23px] max-[701px]:gap-[9px] max-[701px]:text-[24px] max-[371px]:gap-[7px] max-[371px]:text-[21px]";
  const mark = small
    ? "size-8 max-[701px]:size-[29px]"
    : "size-[41px] max-[961px]:size-[35px] max-[701px]:size-[34px] max-[371px]:size-[31px]";

  return (
    <a
      className={`inline-flex items-center whitespace-nowrap font-bold ${wordmark}`}
      href="/"
      aria-label="SpaceChat home"
    >
      <span className={`block shrink-0 -rotate-4 ${mark}`}>
        <svg className="size-full" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <path d="M33 21a12 12 0 0 1-12 12h-9l2-6A12 12 0 1 1 33 21Z" stroke="currentColor" strokeWidth="1.6" />
          <ellipse cx="22" cy="22" rx="21" ry="7" transform="rotate(-36 22 22)" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="18" cy="19" r="1.4" fill="currentColor" />
          <circle cx="25" cy="19" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span>spacechat<span className="text-signal">.</span></span>
    </a>
  );
}

export function Starfield() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-2 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 110 }, (_, index) => {
        const seed = (index * 7919 + 104729) % 99991;
        return (
          <i
            key={index}
            className="absolute rounded-full bg-[#f5e7dd] shadow-[0_0_3px_#c7b1ab66]"
            style={{
              left: `${seed % 100}%`,
              top: `${(seed * 13) % 100}%`,
              opacity: .15 + (seed % 55) / 100,
              width: seed % 7 === 0 ? 2 : 1,
              height: seed % 7 === 0 ? 2 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

export function GrainOverlay() {
  return <div className="landing-grain pointer-events-none absolute inset-0 z-3 opacity-[.035]" aria-hidden="true" />;
}

export function MiniPlanet({ planet, className = "" }) {
  const surfaces = {
    earth: "landing-planet-earth",
    mars: "landing-planet-mars",
    saturn: "landing-planet-saturn",
  };

  return (
    <span
      className={`relative block size-[37px] shrink-0 overflow-hidden rounded-full bg-[#a34b34] shadow-[inset_-10px_-3px_12px_#000b,0_0_15px_#ffffff04] max-[961px]:size-[29px] max-[701px]:size-[31px] ${surfaces[planet] || ""} ${className}`}
      aria-hidden="true"
    >
      <span className="landing-planet-texture absolute inset-0 rounded-full opacity-45 mix-blend-overlay" />
    </span>
  );
}

function MoonPin({ title, subtitle, className }) {
  return (
    <div className={`absolute z-2 flex items-center ${className}`}>
      <span className="relative mr-3 h-px w-[65px] bg-linear-to-r from-[#e3a28d80] to-[#e3a28d30] before:absolute before:-top-[2px] before:left-0 before:size-[5px] before:rounded-full before:bg-[#fcb49c] before:shadow-[0_0_0_4px_#fcb49c17] max-[1200px]:w-8 max-[961px]:w-5 max-[701px]:mr-2 max-[701px]:w-[30px]" />
      <span className="font-mono text-[11px] leading-[normal] tracking-[-.2px] text-[#e4d3ca] max-[1200px]:text-[9px] max-[961px]:text-[8px]">
        {title}
        <small className="mt-[9px] block text-[7px] leading-[normal] tracking-[.7px] text-[#aa9690] max-[1200px]:text-[6px] max-[961px]:max-w-[90px] max-[961px]:text-[5px] max-[961px]:leading-normal max-[701px]:max-w-none max-[701px]:tracking-[.3px]">
          {subtitle}
        </small>
      </span>
    </div>
  );
}

export function MoonScene() {
  return (
    <div
      className="pointer-events-none absolute -right-[45px] top-[21px] z-0 h-[670px] w-[720px] mix-blend-screen min-[1550px]:-right-[25px] min-[1550px]:top-[10px] min-[1550px]:h-[740px] min-[1550px]:w-[810px] max-[1200px]:-right-[95px] max-[1200px]:top-6 max-[1200px]:h-[610px] max-[1200px]:w-[650px] max-[961px]:-right-[147px] max-[961px]:top-[31px] max-[961px]:h-[575px] max-[961px]:w-[600px] max-[701px]:relative max-[701px]:left-1/2 max-[701px]:right-auto max-[701px]:top-0 max-[701px]:z-1 max-[701px]:-mt-[5px] max-[701px]:aspect-[1.13] max-[701px]:h-auto max-[701px]:w-[calc(100%+80px)] max-[701px]:max-w-[580px] max-[701px]:-translate-x-1/2"
      aria-hidden="true"
    >
      <div className="absolute inset-[14%] rounded-full bg-[#b22c131a] blur-[58px]" />
      <div className="absolute left-[4%] top-[36%] z-0 h-[35%] w-[93%] -rotate-34 rounded-full border border-[#a5837133] max-[701px]:left-[4.5%] max-[701px]:top-[37%] max-[701px]:h-[28%] max-[701px]:w-[91%]" />
      <div className="absolute left-[9%] top-[5%] z-0 h-[87%] w-[83%] -rotate-25 rounded-full border border-[#a5837116] max-[701px]:left-[4.5%] max-[701px]:top-[7%] max-[701px]:h-[84%] max-[701px]:w-[91%]" />
      <img
        className="landing-moon-mask absolute inset-0 z-1 block size-full animate-moon-appear object-contain saturate-[.88] max-[961px]:opacity-85 max-[701px]:opacity-100 motion-reduce:animate-none"
        src="/images/red-moon.jpg"
        alt=""
        width="1200"
        height="1200"
        fetchPriority="high"
      />
      <div className="absolute left-[43%] top-10 z-2 flex flex-col gap-[7px] font-mono text-[8px] leading-[normal] tracking-[1.1px] text-[#a39893] max-[1200px]:left-[51%] max-[961px]:left-[45%] max-[961px]:top-[25px] max-[961px]:text-[6px] max-[701px]:left-[53%] max-[701px]:top-6 max-[701px]:gap-1 max-[701px]:text-[5px]">
        <span className="text-[10px] text-[#c3b6ad] max-[961px]:text-[8px] max-[701px]:text-[7px]">SC—001</span>
        <span>TRANSMITTING FROM EVERYWHERE</span>
      </div>
      <MoonPin
        title="s/firstcontact"
        subtitle="HELLO, OTHER WORLDS."
        className="-right-5 top-[235px] min-[1550px]:top-[275px] max-[1200px]:right-10 max-[961px]:right-[68px] max-[961px]:top-[183px] max-[701px]:right-7 max-[701px]:top-[39%]"
      />
      <MoonPin
        title="s/deepthoughts"
        subtitle="THINK WAY OUTSIDE THE BOX."
        className="-right-[10px] top-[399px] min-[1550px]:top-[450px] max-[1200px]:right-[53px] max-[1200px]:top-[380px] max-[961px]:right-[70px] max-[961px]:top-[355px] max-[701px]:right-7 max-[701px]:top-[67%]"
      />
      <span className="absolute bottom-[17px] left-[30%] z-2 font-mono text-[7px] leading-[normal] tracking-[1px] text-[#a39893] max-[1200px]:left-[38%] max-[1200px]:text-[6px] max-[961px]:bottom-[30px] max-[961px]:left-[34%] max-[961px]:text-[5px] max-[701px]:bottom-0 max-[701px]:left-[28%] max-[701px]:tracking-[.7px]">
        25° 19′ N &nbsp; 0° 00′ E &nbsp; / &nbsp; ALL ARE WELCOME
      </span>
    </div>
  );
}
