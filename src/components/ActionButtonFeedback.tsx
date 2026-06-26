import { useEffect } from "react";
import { inferLoadingLabel, normalizeButtonLabel } from "../lib/button-loading";

function getButtonLabel(button: HTMLButtonElement): string {
  if (button.dataset.busyLabel) {
    return normalizeButtonLabel(button.dataset.busyLabel);
  }

  const ariaLabel = button.getAttribute("aria-label");
  if (ariaLabel?.trim()) {
    return normalizeButtonLabel(ariaLabel);
  }

  const textSpans = Array.from(button.querySelectorAll("span"))
    .map((el) => normalizeButtonLabel(el.textContent || ""))
    .filter(Boolean);
  if (textSpans.length > 0) {
    return textSpans.reduce((longest, current) =>
      current.length > longest.length ? current : longest,
    );
  }

  return normalizeButtonLabel(button.textContent || "");
}

function isNavigationButton(button: HTMLButtonElement): boolean {
  return !!(
    button.closest("#sidebar-navigation") ||
    button.closest("#mobile-bottom-nav") ||
    button.closest("#main-top-banner") ||
    button.closest("#profile-dropdown-wrapper") ||
    button.closest("#mobile-profile-dropdown-wrapper") ||
    button.closest("#pim-sub-menu-band") ||
    button.closest("#monitor-panel aside") ||
    button.closest("[id$='-tab-headers']") ||
    button.closest("[data-tab-nav]") ||
    button.closest("[role='menu']") ||
    button.closest("[role='tablist']") ||
    button.id === "top-profile-selector" ||
    button.id === "mobile-top-profile-selector" ||
    button.id === "hamburger-btn" ||
    button.id === "sidebar-toggle-overlay-btn" ||
    button.id.startsWith("sidebar-tab-") ||
    button.id.startsWith("sidebar-subtab-") ||
    button.id.startsWith("pim-subtab-btn-") ||
    button.id.startsWith("tab-btn-")
  );
}

function isActionButton(button: HTMLButtonElement): boolean {
  if (button.dataset.noBusy !== undefined) return false;
  if (isNavigationButton(button)) return false;
  if (button.dataset.busy !== undefined) return true;

  const inForm = !!button.closest("form");
  if (button.type === "submit" && inForm) return true;

  const className = button.className;
  return /bg-\[#ff791a\]|bg-primary|bg-rose-600|bg-\[#f57416\]|bg-gradient-to-r from-\[#ff791a\]/.test(
    className,
  );
}

const BUSY_FEEDBACK_DELAY_MS = 120;

function modalZIndex(className: string): number | null {
  const arbitrary = className.match(/\bz-\[(\d+)\]/);
  if (arbitrary) return Number(arbitrary[1]);

  const standard = className.match(/\bz-(\d+)\b/);
  if (standard) return Number(standard[1]);

  return null;
}

function isModalOverlayElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (!el.classList.contains("fixed") || !el.classList.contains("inset-0")) return false;

  const className = el.className;
  if (el.classList.contains("pointer-events-none")) return false;
  if (el.classList.contains("bg-transparent") && /\bz-40\b/.test(className)) return false;

  const z = modalZIndex(className);
  return z !== null && z >= 50;
}

function getOpenModalOverlays(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".fixed.inset-0")).filter(isModalOverlayElement);
}

function isModalOverlayOpen(button: HTMLButtonElement): boolean {
  return getOpenModalOverlays().some((overlay) => !overlay.contains(button));
}

function nodeContainsModalOverlay(node: Element): boolean {
  if (isModalOverlayElement(node)) return true;
  return Array.from(node.querySelectorAll(".fixed.inset-0")).some(isModalOverlayElement);
}

const busyButtonSnapshots = new WeakMap<
  HTMLButtonElement,
  { className: string; innerHTML: string; disabled: boolean }
>();

function applyBusyState(button: HTMLButtonElement) {
  if (button.dataset.flexhrmBusyManaged === "1") return;

  const label = getButtonLabel(button);
  const busyLabel = button.dataset.busyLabel || inferLoadingLabel(label);

  const snapshot = {
    className: button.className,
    innerHTML: button.innerHTML,
    disabled: button.disabled,
  };
  busyButtonSnapshots.set(button, snapshot);

  button.dataset.flexhrmBusyManaged = "1";
  button.dataset.flexhrmBusyOriginalClass = snapshot.className;
  button.dataset.flexhrmBusyOriginalHtml = snapshot.innerHTML;
  button.dataset.flexhrmBusySuppressMutation = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.className = [
    button.className,
    "bg-slate-400 hover:bg-slate-400 text-white shadow-none cursor-wait pointer-events-none",
  ]
    .filter(Boolean)
    .join(" ");
  button.innerHTML = `<span class="inline-flex items-center justify-center gap-2"><svg class="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>${busyLabel}</span></span>`;
  requestAnimationFrame(() => {
    delete button.dataset.flexhrmBusySuppressMutation;
  });
}

function resetBusyState(button: HTMLButtonElement) {
  const snapshot = busyButtonSnapshots.get(button);
  const className = button.dataset.flexhrmBusyOriginalClass ?? snapshot?.className;
  const innerHTML = button.dataset.flexhrmBusyOriginalHtml ?? snapshot?.innerHTML;

  if (!className && !innerHTML && button.dataset.flexhrmBusyManaged !== "1") return;

  if (className) {
    button.className = className;
  }
  if (innerHTML) {
    button.innerHTML = innerHTML;
  }
  button.disabled = snapshot?.disabled ?? false;
  button.removeAttribute("aria-busy");

  delete button.dataset.flexhrmBusyManaged;
  delete button.dataset.flexhrmBusyOriginalClass;
  delete button.dataset.flexhrmBusyOriginalHtml;
  busyButtonSnapshots.delete(button);
}

function shouldSkipBusyFeedback(button: HTMLButtonElement): boolean {
  if (!button.isConnected) return true;
  if (button.disabled) return true;
  if (button.getAttribute("aria-busy") === "true" && button.dataset.flexhrmBusyManaged !== "1") {
    return true;
  }
  if (isModalOverlayOpen(button)) return true;
  return false;
}

export function ActionButtonFeedback() {
  useEffect(() => {
    const pendingTimers = new Set<number>();
    const buttonTimers = new WeakMap<HTMLButtonElement, number>();

    const trackTimer = (timer: number) => {
      pendingTimers.add(timer);
      return timer;
    };

    const clearTrackedTimer = (timer: number) => {
      window.clearTimeout(timer);
      pendingTimers.delete(timer);
    };

    const clearButtonTimer = (button: HTMLButtonElement) => {
      const timer = buttonTimers.get(button);
      if (timer === undefined) return;
      clearTrackedTimer(timer);
      buttonTimers.delete(button);
    };

    const scheduleBusyFeedback = (button: HTMLButtonElement) => {
      if (buttonTimers.has(button)) return;

      const timer = trackTimer(
        window.setTimeout(() => {
          clearTrackedTimer(timer);
          buttonTimers.delete(button);
          if (shouldSkipBusyFeedback(button)) return;
          applyBusyState(button);

          const safetyTimer = trackTimer(window.setTimeout(() => resetBusyState(button), 60000));
          buttonTimers.set(button, safetyTimer);
        }, BUSY_FEEDBACK_DELAY_MS),
      );

      buttonTimers.set(button, timer);
    };

    const watchForModalOpen = (button: HTMLButtonElement) => {
      const clearBusyFromModalOpen = () => {
        if (!button.isConnected) return true;
        if (!isModalOverlayOpen(button)) return false;
        clearButtonTimer(button);
        resetBusyState(button);
        return true;
      };

      if (clearBusyFromModalOpen()) return;

      const modalObserver = new MutationObserver(() => {
        if (clearBusyFromModalOpen()) modalObserver.disconnect();
      });
      modalObserver.observe(document.body, { childList: true, subtree: true });

      trackTimer(
        window.setTimeout(() => {
          modalObserver.disconnect();
        }, 2000),
      );
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.disabled || button.dataset.noBusy !== undefined) return;
      if (!isActionButton(button)) return;

      scheduleBusyFeedback(button);
      watchForModalOpen(button);
    };

    const onBusyDone = (event: Event) => {
      const button = event.target;
      if (button instanceof HTMLButtonElement) {
        clearButtonTimer(button);
        resetBusyState(button);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target;
        if (!(target instanceof HTMLButtonElement)) continue;
        if (target.dataset.flexhrmBusySuppressMutation === "1") continue;
        if (target.dataset.flexhrmBusyManaged !== "1") continue;

        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "aria-busy" || mutation.attributeName === "disabled")
        ) {
          if (
            target.getAttribute("aria-busy") === "true" &&
            mutation.attributeName === "aria-busy" &&
            mutation.oldValue !== "true"
          ) {
            resetBusyState(target);
          }
          if (!target.disabled && mutation.attributeName === "disabled") {
            resetBusyState(target);
          }
        }

        if (mutation.type === "childList" || mutation.type === "characterData") {
          resetBusyState(target);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-busy", "disabled"],
      attributeOldValue: true,
      childList: true,
      subtree: true,
      characterData: true,
    });

    const modalCloseObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList" || mutation.removedNodes.length === 0) continue;

        for (const node of mutation.removedNodes) {
          if (!(node instanceof Element)) continue;
          if (!nodeContainsModalOverlay(node)) continue;

          document.querySelectorAll("button[aria-busy='true']").forEach((node) => {
            if (!(node instanceof HTMLButtonElement)) return;
            clearButtonTimer(node);
            resetBusyState(node);
          });
        }
      }
    });
    modalCloseObserver.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", onClick, true);
    document.addEventListener("flexhrm:busy-done", onBusyDone);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("flexhrm:busy-done", onBusyDone);
      observer.disconnect();
      modalCloseObserver.disconnect();
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
      pendingTimers.clear();
    };
  }, []);

  return null;
}

export function signalButtonBusyDone(button: HTMLButtonElement | null | undefined) {
  button?.dispatchEvent(new Event("flexhrm:busy-done", { bubbles: true }));
}

export function resetAllBusyButtons() {
  document.querySelectorAll("button[data-flexhrm-busy-managed='1']").forEach((node) => {
    if (node instanceof HTMLButtonElement) {
      resetBusyState(node);
    }
  });
}
