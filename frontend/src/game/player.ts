import Phaser from "phaser";
import { cartToIso } from "./isometricUtils";

// player.ts
export class Player {
  private sprite: Phaser.GameObjects.Image;
  private tileX: number = 0;
  private tileY: number = 0;

  constructor(scene: Phaser.Scene, startTileX: number, startTileY: number) {
    this.sprite = scene.add.image(0, 0, 'player').setOrigin(0, 0); // feet at origin
    this.setTile(startTileX, startTileY, 0, 0);
  }

  setTile(tileX: number, tileY: number, offsetX: number, offsetY: number) {
    this.tileX = tileX;
    this.tileY = tileY;

    const isoPos = cartToIso(tileX, tileY);
    this.sprite.setPosition(isoPos.x + offsetX, isoPos.y + offsetY);
    // depth between walls (1) and props (2), but dynamic per tile
    this.sprite.setDepth(1 + (tileX + tileY) * 0.01);
  }
}