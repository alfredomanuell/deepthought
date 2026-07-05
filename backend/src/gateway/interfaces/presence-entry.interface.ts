import type { CharacterLayers } from '../types/character-layers.type';
import type { Direction } from '../types/direction.type';

/** Estado efémero de um jogador ligado, guardado apenas em memória. */
export interface PresenceEntry {
  userId: string;
  displayName: string;
  characterLayers: CharacterLayers | null;
  lx: number;
  ly: number;
  direction: Direction;
}
