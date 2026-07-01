import { Injectable } from '@nestjs/common';
import type { PresenceEntry } from './interfaces/presence-entry.interface';

/**
 * Roster em memória dos jogadores atualmente ligados ao gateway.
 * Não persiste em base de dados — a posição é efémera por desenho (fase 1).
 */
@Injectable()
export class PresenceService {
  private readonly players = new Map<string, PresenceEntry>();

  add(entry: PresenceEntry): void {
    this.players.set(entry.userId, entry);
  }

  remove(userId: string): void {
    this.players.delete(userId);
  }

  updatePosition(
    userId: string,
    lx: number,
    ly: number,
    direction: PresenceEntry['direction'],
  ): void {
    const entry = this.players.get(userId);
    if (!entry) return;

    entry.lx = lx;
    entry.ly = ly;
    entry.direction = direction;
  }

  get(userId: string): PresenceEntry | undefined {
    return this.players.get(userId);
  }

  list(excludingUserId?: string): PresenceEntry[] {
    const all = Array.from(this.players.values());
    if (!excludingUserId) return all;
    return all.filter((entry) => entry.userId !== excludingUserId);
  }
}
