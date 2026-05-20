// game/main.js - pure Phaser from here on
import Phaser from "phaser";

export function startGame() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
  });
}