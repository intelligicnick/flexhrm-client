import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  canScrollHorizontal,
  findHorizontalScrollContainer,
  isEditableElement,
  isHorizontallyScrollable,
  scrollHorizontalContainer,
  scrollHorizontalContainerToEdge,
} from "../lib/horizontal-scroll";

function resolveScrollContainer(target: EventTarget | null): HTMLElement | null {
  const fromTarget = findHorizontalScrollContainer(target);
  if (fromTarget) return fromTarget;

  if (typeof document === "undefined") return null;
  const hovered = document.querySelector<HTMLElement>("[data-horizontal-scroll-hover='true']");
  return hovered && isHorizontallyScrollable(hovered) ? hovered : null;
}

export default function GlobalHorizontalScroll() {
  const [activeContainer, setActiveContainer] = useState<HTMLElement | null>(null);
  const [controlsRect, setControlsRect] = useState<DOMRect | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncContainerState = useCallback((container: HTMLElement | null) => {
    setActiveContainer(container);
    if (!container) {
      setControlsRect(null);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setControlsRect(container.getBoundingClientRect());
    setCanScrollLeft(canScrollHorizontal(container, "left"));
    setCanScrollRight(canScrollHorizontal(container, "right"));
  }, []);

  const markHoveredContainer = useCallback(
    (target: EventTarget | null) => {
      document
        .querySelectorAll<HTMLElement>("[data-horizontal-scroll-hover='true']")
        .forEach((el) => el.removeAttribute("data-horizontal-scroll-hover"));

      const container = findHorizontalScrollContainer(target);
      if (container) {
        container.setAttribute("data-horizontal-scroll-hover", "true");
      }
      syncContainerState(container);
    },
    [syncContainerState],
  );

  useEffect(() => {
    const updateFromActive = () => {
      if (!activeContainer || !document.contains(activeContainer)) {
        syncContainerState(null);
        return;
      }
      syncContainerState(activeContainer);
    };

    const onScroll = () => updateFromActive();
    const onResize = () => updateFromActive();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [activeContainer, syncContainerState]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      markHoveredContainer(event.target);
    };

    const onFocusIn = (event: FocusEvent) => {
      markHoveredContainer(event.target);
    };

    const onMouseLeave = (event: MouseEvent) => {
      if (event.target !== document.documentElement) return;
      document
        .querySelectorAll<HTMLElement>("[data-horizontal-scroll-hover='true']")
        .forEach((el) => el.removeAttribute("data-horizontal-scroll-hover"));
      syncContainerState(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const container = resolveScrollContainer(event.target);
      if (!container) return;

      const { key, shiftKey } = event;
      const inEditable = isEditableElement(event.target);

      if (shiftKey && !inEditable) {
        if (key === "ArrowLeft") {
          event.preventDefault();
          scrollHorizontalContainer(container, "left", { large: event.altKey });
          syncContainerState(container);
          return;
        }
        if (key === "ArrowRight") {
          event.preventDefault();
          scrollHorizontalContainer(container, "right", { large: event.altKey });
          syncContainerState(container);
          return;
        }
        if (key === "Home") {
          event.preventDefault();
          scrollHorizontalContainerToEdge(container, "start");
          syncContainerState(container);
          return;
        }
        if (key === "End") {
          event.preventDefault();
          scrollHorizontalContainerToEdge(container, "end");
          syncContainerState(container);
          return;
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey) return;

      const container = resolveScrollContainer(event.target);
      if (!container) return;

      event.preventDefault();
      container.scrollBy({ left: event.deltaY + event.deltaX, behavior: "auto" });
      syncContainerState(container);
    };

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("wheel", onWheel);
      document
        .querySelectorAll<HTMLElement>("[data-horizontal-scroll-hover='true']")
        .forEach((el) => el.removeAttribute("data-horizontal-scroll-hover"));
    };
  }, [markHoveredContainer, syncContainerState]);

  if (!activeContainer || !controlsRect || (!canScrollLeft && !canScrollRight)) return null;

  const top = Math.max(8, controlsRect.top + controlsRect.height / 2 - 16);
  const leftButtonLeft = Math.max(8, controlsRect.left + 8);
  const rightButtonLeft = Math.min(window.innerWidth - 40, controlsRect.right - 40);

  const buttonClass =
    "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-35";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[120]"
      aria-hidden={false}
      data-horizontal-scroll-controls
    >
      <button
        type="button"
        className={buttonClass}
        style={{ position: "fixed", top, left: leftButtonLeft }}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        title="Scroll left (Shift+←)"
        onClick={() => {
          scrollHorizontalContainer(activeContainer, "left");
          syncContainerState(activeContainer);
        }}
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <button
        type="button"
        className={buttonClass}
        style={{ position: "fixed", top, left: rightButtonLeft }}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        title="Scroll right (Shift+→)"
        onClick={() => {
          scrollHorizontalContainer(activeContainer, "right");
          syncContainerState(activeContainer);
        }}
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
