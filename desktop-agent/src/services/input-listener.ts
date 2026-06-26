import { uIOhook } from 'uiohook-napi';

type InputHandler = (
  type: 'key' | 'click' | 'scroll' | 'move',
  data?: { x?: number; y?: number },
) => void;

let started = false;
let lastMoveAt = 0;

export function startInputListener(onInput: InputHandler) {
  if (started) return;
  started = true;

  uIOhook.on('keydown', () => {
    onInput('key');
  });

  uIOhook.on('click', () => {
    onInput('click');
  });

  uIOhook.on('wheel', () => {
    onInput('scroll');
  });

  uIOhook.on('mousemove', (event) => {
    const now = Date.now();
    if (now - lastMoveAt < 200) return;
    lastMoveAt = now;
    onInput('move', { x: event.x, y: event.y });
  });

  try {
    uIOhook.start();
  } catch (err) {
    started = false;
    console.error('[flex-agent] Global input listener failed to start:', err);
  }
}

export function stopInputListener() {
  if (!started) return;
  try {
    uIOhook.stop();
  } catch {
    /* ignore */
  }
  started = false;
}
