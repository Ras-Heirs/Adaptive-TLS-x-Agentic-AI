import { useEffect, useRef } from 'react';

// Pintasan keyboard (tampilan saja). Diabaikan saat sedang mengetik di input/select.
export interface ShortcutHandlers {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  toggleBBox: () => void;
  toggleHeatmap: () => void;
  toggleFullscreen: () => void;
  openGuide: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) return;
      const h = ref.current;
      const map: Record<string, () => void> = {
        '+': h.zoomIn, '=': h.zoomIn, '-': h.zoomOut, '_': h.zoomOut,
        r: h.resetView, b: h.toggleBBox, h: h.toggleHeatmap, f: h.toggleFullscreen, '?': h.openGuide,
      };
      const fn = map[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function toggleStageFullscreen() {
  const el = document.getElementById('camera-stage');
  if (!el) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void el.requestFullscreen?.();
}
