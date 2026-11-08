import { useEffect, useRef } from "react";
import { getOrbitTransforms } from "./orbitGeometry";

const flightDuration = 1100;

export default function PlanetTransition({ departure, onComplete }) {
  const returning = departure.direction === "out";
  const transforms = getOrbitTransforms(departure);
  const moonRef = useRef(null);
  const backdropRef = useRef(null);
  const surfaceShadeRef = useRef(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let active = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function arrive() {
      if (active && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }

    const moon = moonRef.current;
    if (!moon?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      arrive();
      return () => {
        active = false;
        document.body.style.overflow = previousOverflow;
      };
    }

    const { orbit, surface } = getOrbitTransforms(departure);
    const orbitFrame = { transform: orbit, opacity: departure.moonOpacity };
    const surfaceFrame = { transform: surface, opacity: 1 };
    const flight = moon.animate(
      returning ? [surfaceFrame, orbitFrame] : [orbitFrame, surfaceFrame],
      { duration: flightDuration, easing: "cubic-bezier(.65, 0, .22, 1)", fill: "forwards" },
    );
    const backdrop = backdropRef.current.animate(
      returning ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: flightDuration * .8, delay: returning ? flightDuration * .2 : 0, fill: "forwards" },
    );
    const surfaceShade = surfaceShadeRef.current.animate(
      returning ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: flightDuration * .45, delay: returning ? 0 : flightDuration * .55, fill: "forwards" },
    );

    flight.finished.then(arrive).catch(() => {});
    window.addEventListener("resize", arrive, { once: true });

    return () => {
      active = false;
      flight.cancel();
      backdrop.cancel();
      surfaceShade.cancel();
      window.removeEventListener("resize", arrive);
      document.body.style.overflow = previousOverflow;
    };
  }, [departure, returning]);

  return (
    <div className="fixed inset-0 z-[2000] overflow-hidden" aria-busy="true" data-orbit-transition={returning ? "out" : "in"}>
      <div ref={backdropRef} className="absolute inset-0 bg-space" style={{ opacity: returning ? 1 : 0 }} />
      <img
        ref={moonRef}
        src="/images/red-moon.jpg"
        alt=""
        aria-hidden="true"
        className="landing-moon-mask absolute top-0 left-0 max-w-none origin-top-left saturate-[.88] will-change-transform"
        style={{
          width: departure.size,
          height: departure.size,
          transform: returning ? transforms.surface : transforms.orbit,
          opacity: returning ? 1 : departure.moonOpacity,
        }}
      />
      <div
        ref={surfaceShadeRef}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(9,9,11,.85)_0%,rgba(9,9,11,.59)_48%,rgba(9,9,11,.38)_100%)]"
        style={{ opacity: returning ? 1 : 0 }}
        aria-hidden="true"
      />
      <p role="status" className="absolute right-6 bottom-10 left-6 text-center font-mono text-xs tracking-[.2em] text-starlight drop-shadow-lg">
        {returning ? "RETURNING TO ORBIT" : `APPROACHING THE SURFACE / ${departure.action === "login" ? "LOG IN" : "SIGN UP"}`}
      </p>
    </div>
  );
}
