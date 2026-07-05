import { useCallback, useEffect, useRef } from "react";

/** Trap hardware/browser back so overlay closes instead of leaving the page. */
export function useSupervisorOverlayBack(active: boolean, onClose: () => void) {
  const closedByBackRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    closedByBackRef.current = false;
    let cancelled = false;
    let popStateHandler: (() => void) | null = null;

    const armTimer = window.setTimeout(() => {
      if (cancelled) return;
      window.history.pushState({ supervisorOverlay: 1 }, "");
      popStateHandler = () => {
        closedByBackRef.current = true;
        onCloseRef.current();
      };
      window.addEventListener("popstate", popStateHandler);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(armTimer);
      if (popStateHandler) {
        window.removeEventListener("popstate", popStateHandler);
      }
      if (!closedByBackRef.current && window.history.state?.supervisorOverlay === 1) {
        window.history.back();
      }
    };
  }, [active]);

  const closeOverlay = useCallback(() => {
    if (window.history.state?.supervisorOverlay === 1) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, []);

  return closeOverlay;
}

/** Warn when leaving a form with unsaved data; re-traps back after toast. */
export function useSupervisorUnsavedBackGuard(
  active: boolean,
  onWarn: () => void,
) {
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;

  useEffect(() => {
    if (!active) return;
    window.history.pushState({ supervisorFormGuard: 1 }, "");

    const onPopState = () => {
      onWarnRef.current();
      window.history.pushState({ supervisorFormGuard: 1 }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (window.history.state?.supervisorFormGuard === 1) {
        window.history.back();
      }
    };
  }, [active]);
}
