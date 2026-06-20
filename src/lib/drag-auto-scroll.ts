const EDGE_SIZE_PX = 80;
const MAX_SCROLL_SPEED = 18;

let scrollContainer: HTMLElement | null = null;
let rafId = 0;
let lastClientY = 0;
let dragOverHandler: ((event: DragEvent) => void) | null = null;
let containerDragOverHandler: ((event: DragEvent) => void) | null = null;

function findScrollContainer(): HTMLElement | null {
  const shell = document.getElementById("viewport-scroll-shell");
  if (shell) return shell;

  const dashboard = document.getElementById("admin-dashboard-view");
  let node: HTMLElement | null = dashboard;
  while (node) {
    const style = window.getComputedStyle(node);
    const scrollableY = /(auto|scroll)/.test(style.overflowY);
    if (scrollableY && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }

  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
}

function trackPointer(event: DragEvent) {
  lastClientY = event.clientY;
  event.preventDefault();
}

function tick() {
  if (!scrollContainer) return;

  const rect = scrollContainer.getBoundingClientRect();
  const y = lastClientY;

  if (y < rect.top + EDGE_SIZE_PX) {
    const intensity = Math.min(1, (rect.top + EDGE_SIZE_PX - y) / EDGE_SIZE_PX);
    scrollContainer.scrollTop -= MAX_SCROLL_SPEED * intensity;
  } else if (y > rect.bottom - EDGE_SIZE_PX) {
    const intensity = Math.min(1, (y - (rect.bottom - EDGE_SIZE_PX)) / EDGE_SIZE_PX);
    scrollContainer.scrollTop += MAX_SCROLL_SPEED * intensity;
  }

  rafId = window.requestAnimationFrame(tick);
}

export function startDragAutoScroll() {
  stopDragAutoScroll();

  scrollContainer = findScrollContainer();
  if (!scrollContainer) return;

  dragOverHandler = trackPointer;
  containerDragOverHandler = trackPointer;

  document.addEventListener("dragover", dragOverHandler);
  scrollContainer.addEventListener("dragover", containerDragOverHandler);
  rafId = window.requestAnimationFrame(tick);
}

export function stopDragAutoScroll() {
  if (dragOverHandler) {
    document.removeEventListener("dragover", dragOverHandler);
    dragOverHandler = null;
  }

  if (scrollContainer && containerDragOverHandler) {
    scrollContainer.removeEventListener("dragover", containerDragOverHandler);
  }
  containerDragOverHandler = null;

  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  scrollContainer = null;
  lastClientY = 0;
}
