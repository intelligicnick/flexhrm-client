const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return Boolean(el.closest(EDITABLE_SELECTOR));
}

export function isHorizontallyScrollable(el: HTMLElement): boolean {
  const { overflowX } = getComputedStyle(el);
  if (overflowX !== "auto" && overflowX !== "scroll" && overflowX !== "overlay") {
    return false;
  }
  return el.scrollWidth > el.clientWidth + 1;
}

export function findHorizontalScrollContainer(start: EventTarget | null): HTMLElement | null {
  if (!(start instanceof HTMLElement)) return null;

  let node: HTMLElement | null = start;
  while (node && node !== document.body) {
    if (isHorizontallyScrollable(node)) return node;
    node = node.parentElement;
  }
  return null;
}

export function getHorizontalScrollStep(container: HTMLElement, large = false): number {
  if (large) return Math.max(240, Math.round(container.clientWidth * 0.85));
  return Math.max(80, Math.round(container.clientWidth * 0.25));
}

export function scrollHorizontalContainer(
  container: HTMLElement,
  direction: "left" | "right",
  options?: { large?: boolean },
): boolean {
  if (!isHorizontallyScrollable(container)) return false;

  const delta =
    direction === "left"
      ? -getHorizontalScrollStep(container, options?.large)
      : getHorizontalScrollStep(container, options?.large);

  container.scrollBy({ left: delta, behavior: "smooth" });
  return true;
}

export function scrollHorizontalContainerToEdge(
  container: HTMLElement,
  edge: "start" | "end",
): boolean {
  if (!isHorizontallyScrollable(container)) return false;
  container.scrollTo({
    left: edge === "start" ? 0 : container.scrollWidth,
    behavior: "smooth",
  });
  return true;
}

export function canScrollHorizontal(container: HTMLElement, direction: "left" | "right"): boolean {
  if (!isHorizontallyScrollable(container)) return false;
  const maxScrollLeft = container.scrollWidth - container.clientWidth;
  if (direction === "left") return container.scrollLeft > 1;
  return container.scrollLeft < maxScrollLeft - 1;
}
