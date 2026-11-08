export function captureMoonGeometry(image, { center = false } = {}) {
  const geometryElement = image?.closest("[data-moon-frame]") || image;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (image && center) {
    const rect = geometryElement.getBoundingClientRect();
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top + (rect.height - viewportHeight) / 2),
      behavior: "auto",
    });
    root.style.scrollBehavior = previousBehavior;
  }

  const rect = geometryElement?.getBoundingClientRect();
  const size = rect?.width && rect?.height
    ? Math.min(rect.width, rect.height)
    : Math.min(viewportWidth, viewportHeight) * .8;
  const visible = rect && rect.bottom > 0 && rect.top < viewportHeight;

  return {
    viewportWidth,
    viewportHeight,
    size,
    left: visible ? rect.left + (rect.width - size) / 2 : (viewportWidth - size) / 2,
    top: visible ? rect.top + (rect.height - size) / 2 : (viewportHeight - size) / 2,
    moonOpacity: image ? Number(getComputedStyle(image).opacity) : 1,
  };
}

export function getOrbitTransforms({ left, top, size, viewportWidth, viewportHeight }) {
  const surfaceSize = Math.max(viewportWidth, viewportHeight) * 2.8;
  return {
    orbit: `translate3d(${left}px, ${top}px, 0) scale(1)`,
    surface: `translate3d(${(viewportWidth - surfaceSize) / 2}px, ${(viewportHeight - surfaceSize) / 2}px, 0) scale(${surfaceSize / size})`,
  };
}
