import Phaser from "phaser";
import { getSocket } from "../api/socket";
import {
  Player,
  type Direction,
  CHARACTER_LAYER_ORDER,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_FRAME_HEIGHT,
  DEFAULT_CHARACTER_LAYERS,
  characterTextureKey,
  characterTexturePath,
} from "./player";
import type { CharacterLayers } from "../api/character";

interface PresenceEntry {
  userId: string;
  displayName: string;
  characterLayers: CharacterLayers | null;
  lx: number;
  ly: number;
  direction: Direction;
}

/**
 * Wires the world gateway's presence/movement events to a set of remote
 * `Player` instances. Kept separate from GameScene so client.ts stays focused
 * on rendering/input, matching how setupCamera/setupInput/setupMap already
 * factor concerns out of the scene.
 */
export class RemotePlayerSync {
  private remotePlayers = new Map<string, Player>();
  /** Jogadores cujas spritesheets ainda estão a carregar (spawn adiado). */
  private pendingSpawns = new Set<string>();
  private scene: Phaser.Scene;
  private offsetX: number;
  private offsetY: number;
  private localUserId: string;

  constructor(scene: Phaser.Scene, offsetX: number, offsetY: number, localUserId: string) {
    this.scene = scene;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.localUserId = localUserId;

    const socket = getSocket();
    if (!socket) return;

    socket.on('player:state', this.handleState);
    socket.on('player:join', this.handleJoin);
    socket.on('player:leave', this.handleLeave);
    socket.on('player:move', this.handleMove);

    // The snapshot the server pushes on connect can arrive while the scene is
    // still preloading (before these listeners exist) and be dropped, so ask
    // for the roster now that we can actually handle it. Re-request on every
    // (re)connect so a dropped connection also resyncs.
    socket.emit('player:state:request');
    socket.on('connect', this.handleReconnect);
  }

  /** Reports the local player's new tile/direction to the server. */
  emitMove(lx: number, ly: number, direction: Direction): void {
    getSocket()?.emit('player:move', { lx, ly, direction });
  }

  private handleReconnect = (): void => {
    getSocket()?.emit('player:state:request');
  };

  /** Authoritative roster snapshot: spawn missing, resync existing, drop gone. */
  private handleState = ({ players }: { players: PresenceEntry[] }): void => {
    const seen = new Set<string>();

    for (const entry of players) {
      if (entry.userId === this.localUserId) continue;
      seen.add(entry.userId);

      const existing = this.remotePlayers.get(entry.userId);
      if (existing) {
        existing.moveToTile(entry.lx, entry.ly, entry.direction);
      } else {
        this.spawn(entry);
      }
    }

    for (const [userId, player] of this.remotePlayers) {
      if (seen.has(userId)) continue;
      player.destroy();
      this.remotePlayers.delete(userId);
    }

    for (const userId of this.pendingSpawns) {
      if (!seen.has(userId)) this.pendingSpawns.delete(userId);
    }
  };

  private handleJoin = (entry: PresenceEntry): void => {
    if (entry.userId === this.localUserId) return;
    this.spawn(entry);
  };

  private handleLeave = ({ userId }: { userId: string }): void => {
    this.pendingSpawns.delete(userId);
    this.remotePlayers.get(userId)?.destroy();
    this.remotePlayers.delete(userId);
  };

  private handleMove = ({
    userId,
    lx,
    ly,
    direction,
  }: {
    userId: string;
    lx: number;
    ly: number;
    direction: Direction;
  }): void => {
    this.remotePlayers.get(userId)?.moveToTile(lx, ly, direction);
  };

  private spawn(entry: PresenceEntry): void {
    if (this.remotePlayers.has(entry.userId) || this.pendingSpawns.has(entry.userId)) return;

    const layers = entry.characterLayers ?? DEFAULT_CHARACTER_LAYERS;

    // As spritesheets deste jogador podem ainda não estar carregadas (cada
    // variante é uma textura própria); o spawn só acontece quando existirem.
    this.pendingSpawns.add(entry.userId);
    this.ensureTextures(layers, () => {
      // Saiu entretanto (player:leave/snapshot) ou o sync foi destruído.
      if (!this.pendingSpawns.delete(entry.userId)) return;
      if (this.remotePlayers.has(entry.userId)) return;

      const player = new Player(
        this.scene,
        this.offsetX,
        this.offsetY,
        entry.lx,
        entry.ly,
        entry.displayName,
        layers,
        entry.direction,
      );
      this.remotePlayers.set(entry.userId, player);
    });
  }

  /** Carrega em runtime as variantes de spritesheet ainda desconhecidas. */
  private ensureTextures(layers: CharacterLayers, onReady: () => void): void {
    let queued = false;

    for (const layer of CHARACTER_LAYER_ORDER) {
      const key = characterTextureKey(layer, layers[layer]);
      if (this.scene.textures.exists(key)) continue;
      this.scene.load.spritesheet(key, characterTexturePath(layer, layers[layer]), {
        frameWidth: CHARACTER_FRAME_WIDTH,
        frameHeight: CHARACTER_FRAME_HEIGHT,
      });
      queued = true;
    }

    if (!queued) {
      onReady();
      return;
    }

    // COMPLETE dispara quando a fila esvazia; ficheiros de spawns concorrentes
    // entram na mesma fila, por isso todos os handlers vêem as texturas prontas.
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, onReady);
    this.scene.load.start();
  }

  /** Detaches listeners and destroys all remote player sprites. */
  destroy(): void {
    const socket = getSocket();
    socket?.off('connect', this.handleReconnect);
    socket?.off('player:state', this.handleState);
    socket?.off('player:join', this.handleJoin);
    socket?.off('player:leave', this.handleLeave);
    socket?.off('player:move', this.handleMove);

    this.pendingSpawns.clear();
    for (const player of this.remotePlayers.values()) player.destroy();
    this.remotePlayers.clear();
  }
}
