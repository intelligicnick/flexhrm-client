import { useCallback, useEffect, useRef } from "react";

function stripOverlayState(): void {
  if (window.history.state?.supervisorOverlay !== 1) return;
  const nextState = { ...window.history.state };
  delete nextState.supervisorOverlay;
  window.history.replaceState(Object.keys(nextState).length ? nextState : null, "");
}

function stripFormGuardState(): void {
  if (window.history.state?.supervisorFormGuard !== 1) return;
  const nextState = { ...window.history.state };
  delete nextState.supervisorFormGuard;
  window.history.replaceState(Object.keys(nextState).length ? nextState : null, "");
}

/** Trap hardware/browser back so overlay closes instead of leaving the page. */
export function useSupervisorOverlayBack(active: boolean, onClose: () => void) {
  const closedByBackRef = useRef(false);
  const armedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    closedByBackRef.current = false;
    armedRef.current = false;
    let cancelled = false;
    let popStateHandler: (() => void) | null = null;

    const armTimer = window.setTimeout(() => {
      if (cancelled) return;
      window.history.pushState({ ...window.history.state, supervisorOverlay: 1 }, "");
      armedRef.current = true;
      popStateHandler = () => {
        closedByBackRef.current = true;
        armedRef.current = false;
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
      if (armedRef.current && !closedByBackRef.current) {
        stripOverlayState();
      }
      armedRef.current = false;
    };
  }, [active]);

  const closeOverlay = useCallback(() => {
    closedByBackRef.current = true;
    armedRef.current = false;
    stripOverlayState();
    onCloseRef.current();
  }, []);

  return closeOverlay;
}

/** Warn when leaving a form with unsaved data; re-traps back after warning. */
export function useSupervisorUnsavedBackGuard(
  active: boolean,
  onWarn: () => void,
) {
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;

  useEffect(() => {
    if (!active) return;
    window.history.pushState({ ...window.history.state, supervisorFormGuard: 1 }, "");

    const onPopState = () => {
      onWarnRef.current();
      window.history.pushState({ ...window.history.state, supervisorFormGuard: 1 }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      stripFormGuardState();
    };
  }, [active]);
}
