import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import ForumDialog from "../app/ForumDialog";
import AuthButtons from "../components/landing/AuthButtons";
import PlanetTransition from "../components/landing/PlanetTransition";
import { captureMoonGeometry } from "../components/landing/orbitGeometry";
import {
  GrainOverlay,
  Icon,
  Logo,
  MiniPlanet,
  MoonScene,
  Starfield,
} from "../components/landing/visuals";

// Shared utility strings keep repeated layout and typography consistent.
const pageWidth =
  "mx-auto w-[calc(100%-42px)] max-w-[1312px] min-[701px]:w-[calc(100%-64px)] min-[961px]:w-[calc(100%-88px)] min-[1200px]:w-[calc(100%-128px)] max-[371px]:w-[calc(100%-32px)]";
const eyebrow =
  "font-mono text-[10px] leading-normal tracking-[1px] text-[#b4a6a2] min-[701px]:text-[11px] min-[701px]:tracking-[1.4px]";
const sectionTitle =
  "text-[41px] font-medium leading-[1.12] tracking-[-1.6px] min-[701px]:text-[43px] min-[961px]:text-[50px] min-[961px]:tracking-[-2px]";
const coralButton =
  "inline-flex min-h-[52px] items-center justify-center gap-8 rounded-[3px] bg-signal px-[22px] py-[17px] text-[15px] font-semibold text-[#130d0a] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#ff8b72] motion-reduce:transform-none motion-reduce:transition-none";

const communities = [
  {
    id: "earthlings",
    title: "The Earth Lounge",
    handle: "s/earthlings",
    description: "Earth things. Alien perspectives. A little bit of everything.",
    color: "#88a5bd",
    planet: "earth",
    posts: [
      "Do humans really say ‘we should hang out’ and then never hang out?",
      "Show us the view from your corner of the universe.",
    ],
  },
  {
    id: "firstcontact",
    title: "First Contact",
    handle: "s/firstcontact",
    description: "New here? Meet your neighbors from the next galaxy over.",
    color: "#f57759",
    planet: "mars",
    posts: [
      "Just landed. Is this the right place to ask about pizza?",
      "Introduce yourself without mentioning your home planet.",
    ],
  },
  {
    id: "deepthoughts",
    title: "Deep Thoughts",
    handle: "s/deepthoughts",
    description: "For the questions that keep all three of your eyes open.",
    color: "#bda6da",
    planet: "saturn",
    posts: [
      "If the universe is expanding, is there more room for bad ideas?",
      "What does a shooting star wish on?",
    ],
  },
];

const steps = [
  {
    icon: "orbit",
    title: "Find your orbit.",
    description:
      "Discover a community that gets your weird. There’s a world for every kind of mind.",
  },
  {
    icon: "chat",
    title: "Send a signal.",
    description:
      "Ask the big questions. Share a small thought. Sometimes a simple “hey” is enough.",
  },
  {
    icon: "spark",
    title: "Meet your universe.",
    description:
      "Swap perspectives with beings beyond your bubble. Connection has no coordinates.",
  },
];

function SignalDot({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-[5px] shrink-0 rounded-full bg-signal shadow-[0_0_8px_#fa71594d] ${className}`}
    />
  );
}

function SectionLabel({ number, children, className = "" }) {
  return (
    <p className={`${eyebrow} ${className}`}>
      <span className="mr-2.5 text-signal min-[701px]:mr-[15px]">
        {number} /
      </span>
      {children}
    </p>
  );
}

export default function LandingPage({ returnFromSurface = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [returnMode] = useState(returnFromSurface);
  const [isReturning, setIsReturning] = useState(Boolean(returnMode));
  const returnStartedRef = useRef(false);
  const moonImageRef = useRef(null);
  const departingRef = useRef(false);
  const [activeCommunity, setActiveCommunity] = useState(0);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [departure, setDeparture] = useState(null);
  const [votes, setVotes] = useState({});
  const community = communities[activeCommunity];

  useLayoutEffect(() => {
    if (!returnMode || returnStartedRef.current) return;
    returnStartedRef.current = true;
    const geometry = captureMoonGeometry(moonImageRef.current, { center: true });
    setDeparture({ ...geometry, action: returnMode, direction: "out" });
  }, [returnMode]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // Replace this handler with navigation when the real forum is ready.
  function openUniverse(item = community) {
    setMenuOpen(false);
    setSelectedCommunity(item);
  }

  function handleAuthAction(action) {
    if (departingRef.current || isReturning) return;
    const route = action === "login" ? "/login" : "/signup";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(route, { state: { fromOrbit: true } });
      return;
    }
    departingRef.current = true;
    setMenuOpen(false);

    setDeparture({
      ...captureMoonGeometry(moonImageRef.current),
      action,
      direction: "in",
    });
  }

  function finishAuthTransition() {
    if (departure.direction === "out") {
      setDeparture(null);
      setIsReturning(false);
      departingRef.current = false;
      navigate(location.pathname, { replace: true, state: null });
      requestAnimationFrame(() => {
        document.querySelector(`[data-auth-target="${returnMode}"]`)?.focus({ preventScroll: true });
      });
      return;
    }
    navigate(departure.action === "login" ? "/login" : "/signup", { state: { fromOrbit: true } });
  }

  function selectTab(event, index) {
    let next;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = (index + 1) % communities.length;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = (index + communities.length - 1) % communities.length;
    }
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = communities.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      setActiveCommunity(next);
      document.getElementById(`tab-${communities[next].id}`)?.focus();
    }
  }

  return (
    <>
      <a
        className="fixed top-3 left-5 z-100 -translate-y-[150%] bg-signal px-[18px] py-3 text-space focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>

      <div className="overflow-hidden" inert={Boolean(departure) || isReturning}>
        <div className="relative isolate bg-[#08080a]">
          <Starfield />
          <GrainOverlay />

          <header className={`${pageWidth} relative z-10 flex h-[82px] items-center justify-between gap-[13px] border-b border-white/[.075] min-[701px]:h-[95px] min-[701px]:gap-[22px] min-[961px]:h-[110px] min-[961px]:gap-[30px] max-[371px]:gap-[9px]`}>
            <Logo />
            <nav
              id="main-navigation"
              className={`absolute top-[81px] -right-[21px] -left-[21px] flex-col border-b border-[#30272b] bg-[#111113] px-[25px] py-5 shadow-[0_20px_30px_#0006] min-[701px]:static min-[701px]:flex min-[701px]:flex-row min-[701px]:gap-5 min-[701px]:border-0 min-[701px]:bg-transparent min-[701px]:p-0 min-[701px]:shadow-none min-[961px]:gap-6 min-[1200px]:ml-[45px] min-[1200px]:gap-[34px] ${menuOpen ? "flex" : "hidden"}`}
              aria-label="Main navigation"
            >
              {[
                ["#universe", "The universe"],
                ["#how-it-works", "How it works"],
                ["#our-story", "Our story"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="px-[5px] py-[15px] text-sm text-[#b7b5b7] transition-colors hover:text-white min-[701px]:p-0 min-[701px]:text-[13px] min-[961px]:text-[15px] motion-reduce:transition-none"
                >
                  {label}
                </a>
              ))}
              <AuthButtons
                onAction={handleAuthAction}
                className="mt-3 flex border-t border-[#30272b] pt-4 min-[701px]:hidden"
              />
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-[13px] min-[701px]:ml-0 min-[961px]:gap-5 max-[371px]:gap-[9px]">
              <button
                type="button"
                className="flex items-center gap-[9px] rounded-[3px] border border-[#4a4140] bg-transparent p-[11px] text-[12px] whitespace-nowrap transition-colors hover:border-signal hover:bg-signal/4 min-[701px]:hidden min-[1200px]:flex min-[1200px]:gap-6 min-[1200px]:px-[18px] min-[1200px]:py-[14px] min-[1200px]:text-xs max-[481px]:hidden motion-reduce:transition-none"
                onClick={() => openUniverse()}
              >
                Enter the universe
                <Icon name="diagonal" size={16} className="text-signal max-[701px]:w-[13px]" />
              </button>
              <AuthButtons onAction={handleAuthAction} className="hidden min-[701px]:flex" />
              <button
                type="button"
                className="bg-transparent py-[9px] pl-[5px] min-[701px]:hidden"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={menuOpen}
                aria-controls="main-navigation"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Icon name={menuOpen ? "close" : "menu"} size={24} />
              </button>
            </div>
          </header>

          <section
            className={`${pageWidth} relative pt-[42px] min-[701px]:flex min-[701px]:min-h-[640px] min-[701px]:items-center min-[701px]:pt-[68px] min-[701px]:pb-20 min-[961px]:min-h-[650px] min-[1200px]:min-h-[710px] min-[1550px]:min-h-[790px]`}
            id="main"
            tabIndex={-1}
            aria-labelledby="hero-title"
          >
            <div className="relative z-2 min-w-0 min-[701px]:max-w-[670px]">
              <p className="mb-[27px] flex items-center gap-2.5 font-mono text-[10px] leading-normal tracking-[1.1px] text-[#c1bdbb] min-[701px]:mb-[31px] min-[701px]:text-[11px] min-[701px]:tracking-[1.5px] min-[1200px]:text-[12px] max-[371px]:text-[9px]">
                <SignalDot className="max-[701px]:size-1" />
                A SOCIAL SPACE FOR EVERY SPECIES
              </p>
              <h1
                id="hero-title"
                className="relative z-3 mb-[25px] text-[clamp(50px,12vw,82px)] font-semibold leading-[1.02] tracking-[-3.5px] min-[701px]:mb-7 min-[701px]:text-[73px] min-[701px]:leading-[1.015] min-[701px]:tracking-[-4px] min-[961px]:text-[80px] min-[961px]:tracking-[-4.8px] min-[1200px]:text-[clamp(65px,6.8vw,101px)] min-[1200px]:tracking-[-5.8px] min-[1550px]:text-[105px] max-[371px]:text-[46px]"
              >
                Your next<br />conversation<br />is <span className="text-signal">out there.</span>
              </h1>
              <p className="mb-[25px] max-w-[345px] text-[15px] leading-[1.8] text-[#b2afb0] min-[701px]:mb-[30px] min-[701px]:max-w-[330px] min-[701px]:leading-[1.85] min-[961px]:max-w-[410px] min-[1200px]:text-sm">
                A whole universe of interesting beings.
                <br className="hidden min-[701px]:block" />{" "}
                Find your people. Share your world. Get a little lost.
              </p>
              <div className="relative z-4 flex flex-wrap items-center gap-[21px] min-[701px]:flex-nowrap min-[701px]:gap-[17px] min-[961px]:gap-5 min-[1200px]:gap-[27px] max-[371px]:gap-[15px]">
                <button
                  className={`${coralButton} max-[961px]:min-h-[50px] max-[961px]:gap-6 max-[961px]:px-[19px] max-[961px]:py-4 max-[961px]:text-xs`}
                  onClick={() => openUniverse(communities[1])}
                >
                  Find your orbit <Icon name="diagonal" size={19} />
                </button>
                <a href="#universe" className="inline-flex items-center gap-2 py-[14px] text-[13px] text-[#d7d2cf] hover:text-signal min-[961px]:gap-[11px] min-[961px]:text-xs max-[371px]:text-[12px]">
                  Take a look around <Icon name="arrow" size={17} />
                </a>
              </div>
              <div className="mt-[18px] flex items-center gap-2 font-mono text-[10px] tracking-[1.2px] text-[#8d8588] min-[701px]:mt-[23px] min-[701px]:text-[11px] min-[701px]:tracking-[1.4px]">
                <span aria-hidden="true" className="h-[7px] w-[13px] -rotate-30 rounded-full border border-[#8d8588]" />
                NO SPACESHIP REQUIRED.
              </div>
            </div>
            <MoonScene
              onAuthNavigate={handleAuthAction}
              imageRef={moonImageRef}
              isDeparting={Boolean(departure)}
              skipEntrance={Boolean(returnMode)}
            />
          </section>

          <div className={`${pageWidth} relative z-2 mt-[26px] flex h-[63px] items-center justify-between border-t border-white/[.075] min-[701px]:mt-0 min-[701px]:h-[68px]`}>
            <span className="font-mono text-[9px] tracking-[.5px] text-[#91888b] min-[961px]:text-[11px] min-[961px]:tracking-[1.1px]">
              <span className="mr-[7px] text-[#ddd4ce] min-[701px]:mr-3">01</span>
              / THE BEGINNING
            </span>
            <a href="#universe" className="group flex items-center gap-[9px] font-mono text-[8px] tracking-[.9px] text-[#aba3a0] min-[701px]:gap-[15px] min-[701px]:text-[9px] min-[961px]:ml-[55px] min-[961px]:text-[10px] min-[961px]:tracking-[1.3px]">
              THERE’S MORE OUT HERE
              <span className="grid size-[26px] place-items-center rounded-full border border-[#58443b] text-[#d6b6a3] transition-transform group-hover:translate-y-[3px] min-[701px]:size-[29px] motion-reduce:transform-none motion-reduce:transition-none">
                <Icon name="down" size={17} />
              </span>
            </a>
            <span className="hidden items-center gap-2 font-mono text-[9px] tracking-[.7px] text-[#a2948f] min-[701px]:flex min-[961px]:text-[10px] min-[961px]:tracking-[1px]">
              <SignalDot className="size-1!" /> OPEN TO THE UNIVERSE
            </span>
          </div>
        </div>

        <div className="border-y border-[#222225] bg-[#111113]">
          <div className={`${pageWidth} flex h-[58px] items-center justify-center gap-5 min-[701px]:h-[65px] min-[701px]:justify-between min-[701px]:gap-[22px] min-[961px]:h-[75px] max-[701px]:w-[calc(100%-32px)] max-[371px]:gap-[14px]`}>
            {["SMALL PLANET.", "BIG CONVERSATIONS.", "NO ALIENATION.", "JUST CONNECTION."].map((label, index) => (
              <div key={label} className={`contents ${index === 3 ? "max-[701px]:hidden" : ""}`}>
                {index > 0 && <Icon name="spark" size={18} className="w-2.5 text-[#a37a6d] min-[701px]:w-[11px] min-[961px]:w-[14px]" />}
                <span className="text-[9px] font-medium tracking-[.8px] whitespace-nowrap text-[#afaaab] min-[701px]:text-[11px] min-[701px]:tracking-[1.6px] min-[961px]:text-[13px] min-[961px]:tracking-[2px] max-[371px]:text-[8px]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <main>
          <section id="universe" className={`${pageWidth} py-[65px] min-[701px]:py-20 min-[961px]:pt-[105px] min-[961px]:pb-[100px]`} aria-labelledby="universe-title">
            <div className="mb-[29px] min-[701px]:mb-[43px] min-[701px]:flex min-[701px]:items-end min-[701px]:justify-between min-[701px]:gap-[30px] min-[961px]:gap-10">
              <div>
                <SectionLabel number="01" className="mb-5 min-[701px]:mb-[22px]">FIND YOUR CORNER OF THE COSMOS</SectionLabel>
                <h2 id="universe-title" className={sectionTitle}>
                  Different worlds.<br /><span className="text-[#838086]">Same wavelength.</span>
                </h2>
              </div>
              <p className="mt-[23px] text-[15px] leading-[1.8] text-[#a19a9e] min-[701px]:mt-0 min-[701px]:mr-1 min-[701px]:mb-[3px] min-[701px]:text-xs min-[701px]:leading-[1.85] min-[961px]:text-[15px]">
                There’s a space for your every curiosity.<br />
                From your first hello to your latest<br className="hidden min-[701px]:block" />{" "}
                existential spiral. You’ll fit right in.
              </p>
            </div>

            <div className="flex flex-col border-t border-[#343034] min-[701px]:grid min-[701px]:grid-cols-[30%_1fr] min-[701px]:border-b min-[961px]:grid-cols-[32%_1fr]">
              <div role="tablist" aria-label="Explore communities" className="grid grid-cols-3 gap-1.5 py-[13px] min-[701px]:flex min-[701px]:flex-col min-[701px]:pt-4 min-[701px]:pr-3 min-[701px]:pb-0 min-[961px]:pr-5 min-[1200px]:pr-[29px]">
                {communities.map((item, index) => (
                  <button
                    key={item.id}
                    id={`tab-${item.id}`}
                    role="tab"
                    aria-selected={activeCommunity === index}
                    aria-controls="community-panel"
                    tabIndex={activeCommunity === index ? 0 : -1}
                    onClick={() => setActiveCommunity(index)}
                    onKeyDown={(event) => selectTab(event, index)}
                    className={`flex min-w-0 flex-col items-center gap-2.5 rounded-[3px] px-1.5 py-[15px] text-center transition-colors hover:bg-[#201b1d] hover:text-[#e0d5ce] min-[701px]:w-full min-[701px]:flex-row min-[701px]:px-[9px] min-[701px]:py-[23px] min-[701px]:text-left min-[961px]:gap-[13px] min-[961px]:px-2.5 min-[961px]:py-6 min-[1200px]:gap-[17px] min-[1200px]:px-[15px] max-[371px]:px-0.5 motion-reduce:transition-none ${activeCommunity === index ? "bg-[#1a181a] text-[#f6eeea]" : "bg-transparent text-[#999097]"}`}
                  >
                    <MiniPlanet planet={item.planet} />
                    <span className="flex flex-col gap-[7px] min-[701px]:gap-2">
                      <span className="text-[13px] font-medium tracking-[-.1px] min-[961px]:text-[15px] min-[961px]:tracking-[-.2px] min-[1200px]:text-[17px] max-[371px]:text-[12px]">{item.title}</span>
                      <small className="font-mono text-[9px] text-[#9a8f96] min-[701px]:text-[10px] min-[961px]:text-[11px]">{item.handle}</small>
                    </span>
                    <Icon name="diagonal" size={18} className={`ml-auto hidden w-[14px] min-[701px]:block min-[961px]:w-[18px] ${activeCommunity === index ? "text-signal" : "text-[#8e818a]"}`} />
                  </button>
                ))}
                <p className="mx-[9px] my-7 hidden items-center gap-1.5 font-mono text-[8px] leading-[1.6] tracking-[.5px] text-[#94868f] min-[701px]:flex min-[961px]:mx-[13px] min-[961px]:gap-2.5 min-[961px]:text-[10px] min-[961px]:tracking-[.8px]">
                  <Icon name="orbit" size={18} className="w-[13px] text-[#a57d6a] min-[961px]:w-[18px]" />
                  MANY WORLDS. ONE COMMUNITY.
                </p>
              </div>

              <div
                id="community-panel"
                role="tabpanel"
                aria-labelledby={`tab-${community.id}`}
                tabIndex={0}
                style={{ "--planet-color": community.color }}
                className="min-w-0 rounded-[3px] border border-[#343034] bg-[radial-gradient(ellipse_at_100%_0%,#c8876210,transparent_75%)] px-[17px] pt-[19px] min-[701px]:rounded-none min-[701px]:border-0 min-[701px]:border-l min-[701px]:bg-[radial-gradient(ellipse_at_98%_0%,#c8876210,transparent_55%)] min-[701px]:px-[21px] min-[701px]:pt-[27px] min-[961px]:px-[26px] min-[1200px]:px-8"
              >
                <div className="flex items-center justify-between gap-2.5 font-mono">
                  <span className="text-[8px] tracking-[.4px] text-[#aa9995] min-[701px]:tracking-[.65px] min-[961px]:text-[9px] min-[961px]:tracking-[1px] min-[1200px]:text-[10px] max-[371px]:text-[7px] max-[371px]:tracking-[.2px]">A SIGNAL FROM THE UNIVERSE</span>
                  <span className="rounded-xs border border-[#43363b] p-1 text-[7px] tracking-[.4px] whitespace-nowrap text-[#ac9a98] min-[701px]:px-[7px] min-[701px]:py-[5px] min-[701px]:tracking-[.5px] min-[961px]:text-[8px] min-[961px]:tracking-[.7px] min-[1200px]:text-[9px]">DEMO TRANSMISSIONS</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-6 min-[701px]:pt-[27px] min-[701px]:pb-[25px]">
                  <div>
                    <span className="font-mono text-[11px] text-(--planet-color) min-[701px]:text-[12px]">{community.handle}</span>
                    <h3 className="mt-2 mb-2.5 text-2xl font-medium leading-[1.2] tracking-[-.6px] min-[961px]:text-[28px]">{community.title}</h3>
                    <p className="max-w-[225px] text-[13px] leading-[1.6] text-[#a49a9f] min-[701px]:max-w-none min-[961px]:text-xs">{community.description}</p>
                  </div>
                  <MiniPlanet planet={community.planet} className="size-12! opacity-90 shadow-[inset_-17px_-5px_21px_#000b]! min-[961px]:size-16!" />
                </div>
                {community.posts.map((post, index) => {
                  const key = `${community.id}-${index}`;
                  return (
                    <div key={key} className="flex items-start gap-3 border-t border-[#292629] py-[18px] min-[701px]:gap-[17px] min-[701px]:py-[19px]">
                      <button
                        aria-label={`${votes[key] ? "Remove upvote from" : "Upvote"} ${post}`}
                        aria-pressed={!!votes[key]}
                        onClick={() => setVotes((previous) => ({ ...previous, [key]: !previous[key] }))}
                        className={`flex min-w-[29px] flex-col items-center gap-1 rounded-[3px] border px-[5px] py-2 font-mono text-[11px] transition-colors hover:border-signal/45 hover:bg-signal/4 hover:text-signal min-[701px]:min-w-8 min-[701px]:px-1.5 min-[701px]:text-[12px] motion-reduce:transition-none ${votes[key] ? "border-signal/45 bg-signal/4 text-signal" : "border-[#45383f] bg-transparent text-[#b0a3ab]"}`}
                      >
                        <Icon name="up" size={16} />
                        <span>{[42, 28][index] + (votes[key] ? 1 : 0)}</span>
                      </button>
                      <div className="min-w-0">
                        <p className="mb-[9px] flex flex-wrap items-center gap-[5px] font-mono text-[9px] text-[#a395a0] min-[701px]:gap-1.5 min-[961px]:text-[10px] max-[371px]:text-[8px]">
                          <span aria-hidden="true" className={`inline-grid size-[15px] place-items-center rounded-full font-sans text-[13px] min-[701px]:size-4 min-[701px]:text-xs ${index === 0 ? "bg-[#465a5080] text-[#c3d4b6]" : "bg-[#59496680] text-[#bcb0cf]"}`}>{index === 0 ? "◡" : "✧"}</span>
                          {index === 0 ? "u/definitely_not_an_alien" : "u/cosmic_overthinker"}
                          <span className="text-[#95868f]">· {index === 0 ? "2h" : "4h"}</span>
                        </p>
                        <button onClick={() => openUniverse(community)} className="block bg-transparent p-0 text-left text-xs font-medium leading-[1.65] text-[#ddd3d8] hover:text-white min-[701px]:leading-[1.6] min-[961px]:text-[15px]">{post}</button>
                        <button onClick={() => openUniverse(community)} className="flex min-h-[30px] items-center gap-1.5 bg-transparent pt-2.5 text-[11px] text-[#a0909b] hover:text-signal">
                          <Icon name="chat" size={13} /> Join the conversation <Icon name="arrow" size={13} className="ml-[5px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => openUniverse(community)} className="flex w-full items-center justify-between border-t border-[#292629] bg-transparent py-[19px] text-xs text-[#d6c8c3] hover:text-signal min-[701px]:py-5">
                  Explore this space <Icon name="arrow" size={18} className="text-signal" />
                </button>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="border-y border-[#272429] bg-[#101012] py-[58px] min-[701px]:pt-[73px] min-[701px]:pb-20" aria-labelledby="how-title">
            <div className={pageWidth}>
              <div className="mb-[31px] min-[701px]:mb-[38px] min-[701px]:flex min-[701px]:items-end min-[701px]:justify-between min-[701px]:gap-[30px] min-[961px]:gap-10">
                <div>
                  <SectionLabel number="02" className="mb-5 min-[701px]:mb-[22px]">YOUR FIRST SMALL STEP</SectionLabel>
                  <h2 id="how-title" className="max-w-80 text-[35px] font-medium leading-[1.15] tracking-[-1.2px] min-[701px]:max-w-none min-[701px]:text-[30px] min-[701px]:leading-[1.12] min-[701px]:tracking-[-1.25px] min-[961px]:text-[33px] min-[1200px]:text-[37px]">Getting here was the hard part.</h2>
                </div>
                <span className="hidden pb-1.5 font-mono text-[9px] tracking-[.8px] text-[#9b8a96] min-[701px]:block min-[961px]:text-[10px] min-[961px]:tracking-[1.2px]">MAKE YOURSELF AT HOME.</span>
              </div>
              <div className="grid gap-7 min-[701px]:grid-cols-3 min-[701px]:gap-[25px] min-[961px]:gap-[35px] min-[1200px]:gap-12">
                {steps.map((step, index) => (
                  <article key={step.title} className="relative border-t border-[#3c3333] pt-[26px] pl-[47px] min-[701px]:pt-[22px] min-[701px]:pl-0">
                    <div className="min-[701px]:mb-[26px] min-[701px]:flex min-[701px]:items-center min-[701px]:justify-between">
                      <span className="absolute top-[29px] left-0 font-mono text-[12px] text-[#a78e86] min-[701px]:static">0{index + 1}</span>
                      <Icon name={step.icon} size={29} className="absolute top-[26px] right-[3px] mr-2 size-[23px] text-[#c59a86] min-[701px]:static min-[701px]:size-[29px]" />
                    </div>
                    <h3 className="mr-10 mb-3 text-[23px] font-medium tracking-[-.5px] min-[701px]:mr-0 min-[701px]:mb-[13px] min-[701px]:text-[21px] min-[961px]:text-[23px]">{step.title}</h3>
                    <p className="max-w-80 pr-[27px] text-xs leading-[1.85] text-[#a499a1] min-[701px]:max-w-[300px] min-[701px]:pr-0 min-[961px]:text-[15px]">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section id="our-story" className={`${pageWidth} relative isolate pt-20 pb-[69px] text-center min-[701px]:pt-[105px] min-[701px]:pb-[93px]`} aria-labelledby="story-title">
            <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -z-1 size-[340px] -translate-1/2 rounded-full border border-[#5e453133] before:absolute before:-inset-[50px] before:rounded-full before:border before:border-[#5e453122] after:absolute after:-inset-[110px] after:rounded-full after:border after:border-[#5e453115] min-[701px]:size-[450px]">
              <span className="absolute top-[110px] left-1 size-1.5 rounded-full bg-[#71503d] shadow-[0_0_14px_#71503d66] min-[701px]:top-[109px] min-[701px]:left-5" />
              <Icon name="spark" size={30} className="absolute top-[82px] -right-[5px] w-5 rotate-15 text-[#9b7058] min-[701px]:top-[92px] min-[701px]:right-[7px] min-[701px]:w-[30px]" />
            </div>
            <SectionLabel number="03" className="mb-6 text-[#b6a6a1]">BUILT FOR THE CURIOUS</SectionLabel>
            <h2 id="story-title" className="text-[39px] font-medium leading-[1.18] tracking-[-1.5px] min-[701px]:text-[47px] min-[701px]:leading-[1.16] min-[701px]:tracking-[-2.2px] min-[961px]:text-[53px] max-[371px]:text-[35px]">Space is vast.<br />It doesn’t have to feel empty.</h2>
            <p className="mx-auto mt-6 mb-[27px] max-w-[325px] text-xs leading-[1.9] text-[#a395a0] min-[701px]:mt-[25px] min-[701px]:mb-[29px] min-[701px]:max-w-none min-[701px]:text-[15px]">
              We made SpaceChat for a simple reason: the universe is more<br className="hidden min-[701px]:block" />{" "}
              interesting when we talk to each other. Earthlings, aliens,<br className="hidden min-[701px]:block" />{" "}
              and everyone in between — this is your space.
            </p>
            <button onClick={() => openUniverse(communities[1])} className={`${coralButton} gap-7! px-[23px]! text-xs! min-[701px]:gap-9!`}>
              Let’s make contact <Icon name="diagonal" size={19} />
            </button>
            <a href="https://devpost.com/software/space-chat" target="_blank" rel="noreferrer" className="mt-[22px] flex items-center justify-center gap-[5px] py-2 text-[11px] text-[#a18c9a] hover:text-[#d8c1b4] min-[701px]:mt-5 min-[701px]:gap-[7px] min-[701px]:text-[12px]">
              A little idea. A hackathon. A whole universe. <Icon name="diagonal" size={13} />
            </a>
          </section>
        </main>

        <footer className={`${pageWidth} grid min-h-[125px] grid-cols-2 items-center gap-2.5 border-t border-[#2c272b] py-[25px] min-[701px]:flex min-[701px]:min-h-[100px] min-[701px]:justify-between min-[701px]:gap-[25px] min-[701px]:py-0`}>
          <Logo small />
          <span className="col-span-2 row-start-2 font-mono text-[9px] tracking-[.8px] text-[#9c8798] min-[701px]:text-[10px] min-[701px]:tracking-[1.2px]">MADE ON EARTH. OPEN TO EVERYONE.</span>
          <a href="#main" className="flex items-center justify-end gap-[9px] py-[14px] text-[12px] text-[#b4a1ae] hover:text-signal min-[701px]:gap-3 min-[701px]:text-[13px]">Back to the stars <Icon name="up" size={15} /></a>
        </footer>
      </div>

      {departure && <PlanetTransition departure={departure} onComplete={finishAuthTransition} />}

      {selectedCommunity && (
        <ForumDialog community={selectedCommunity} onClose={() => setSelectedCommunity(null)} />
      )}
    </>
  );
}
