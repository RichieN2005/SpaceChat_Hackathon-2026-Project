import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

// Native browser Back has no custom state, so remember the route it leaves.
export default function useOrbitReturn() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  const previousMode = /^\/(login|signup)\/?$/.exec(previousPath.current)?.[1];
  const requestedMode = location.state?.returnFromSurface;
  const explicitMode = ["login", "signup"].includes(requestedMode) ? requestedMode : null;

  useLayoutEffect(() => {
    previousPath.current = location.pathname;
  }, [location.pathname]);

  return explicitMode || (navigationType === "POP" ? previousMode : null);
}
