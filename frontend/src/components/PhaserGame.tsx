import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startGame } from "../game/client";
import { fetchMe } from "../api/character";
import type { CharacterLayers } from "../api/character";
import { connectSocket, disconnectSocket } from "../api/socket";
import Sidebar from "./sidebar/Sidebar";

const DEFAULT_LAYERS: CharacterLayers = {
  skin: 'light',
  eyes: 'blue',
  hair: 'black_short',
  clothes: 'tshirt_white',
  accessory: 'none',
}

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const layersRef = useRef<CharacterLayers>(DEFAULT_LAYERS);
  const userRef = useRef<{ id: string; displayName: string } | null>(null);

  useEffect(() => {
    fetchMe()
      .then((user) => {
        if (!user.characterCreated) {
          navigate('/CharacterCreation', { replace: true });
          return;
        }
        if (user.characterLayers) layersRef.current = user.characterLayers;
        userRef.current = { id: user.id, displayName: user.displayName };
        connectSocket();
        setReady(true);
      })
      .catch(() => {
        // Network error — still allow game to load with defaults
        setReady(true);
      });
  }, [navigate]);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    const game = startGame(
      containerRef.current,
      layersRef.current,
      userRef.current?.id,
      userRef.current?.displayName,
    );

    const focusCanvas = () => {
      const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
      canvas?.focus();
    };

    containerRef.current.tabIndex = 0;
    containerRef.current.addEventListener('pointerdown', focusCanvas);

    return () => {
      containerRef.current?.removeEventListener('pointerdown', focusCanvas);
      game.destroy(true);
      disconnectSocket();
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="relative inline-block bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black">
      <div ref={containerRef} tabIndex={0} />
      <Sidebar />
    </div>
  );
}
