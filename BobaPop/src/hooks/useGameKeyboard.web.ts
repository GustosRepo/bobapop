import { useEffect, useRef } from 'react';

export function useGameKeyboard(enabled: boolean, move: (delta: number) => void, launch: () => void, pause: () => void) {
  const actions = useRef({ enabled, move, launch, pause });
  actions.current = { enabled, move, launch, pause };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const current = actions.current;
      if (!current.enabled || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowLeft') current.move(-24);
      else if (event.key === 'ArrowRight') current.move(24);
      else if (event.code === 'Space') current.launch();
      else if (event.key === 'Escape') current.pause();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
