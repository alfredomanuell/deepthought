// PhaserGame.jsx - the bridge, nothing more
import { useEffect, useRef } from "react";
import { startGame } from "../game/client";

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const game = startGame(containerRef.current);

    const focusCanvas = () => {
      const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
      canvas?.focus();
    };

    containerRef.current.tabIndex = 0;
    containerRef.current.addEventListener('pointerdown', focusCanvas);

    return () => {
      containerRef.current?.removeEventListener('pointerdown', focusCanvas);
      game.destroy(true);
    };
  }, []);

  return <div className="bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black"> <div ref={containerRef} tabIndex={0} /> </div>;
}