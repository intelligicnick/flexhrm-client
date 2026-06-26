type BackHandler = () => boolean;

const stack: BackHandler[] = [];

export function registerObserverBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const idx = stack.indexOf(handler);
    if (idx >= 0) stack.splice(idx, 1);
  };
}

export function handleObserverBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i]()) return true;
  }
  return false;
}

export function installObserverBackBridge(): void {
  if (typeof window === "undefined") return;
  window.__flexHrmHandleBack = handleObserverBack;
}

declare global {
  interface Window {
    __flexHrmHandleBack?: () => boolean;
  }
}
