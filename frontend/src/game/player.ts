import Phaser from "phaser";
import { cartToIso } from "./isometricUtils";
import { toWorld } from "./mapCoords";
import { TILE_HEIGHT } from "./constants";
/**
 * Player
 *
 * Holds a local room position (lx, ly) and a Phaser visual.
 * All position changes go through setLocalTile() — the single
 * place that translates local → world → iso screen coords.
 *
 * Coordinate flow for every move:
 *
 *   local (lx, ly)
 *       ↓  toWorld()         adds the room origin offset
 *   world (wx, wy)
 *       ↓  cartToIso()       converts grid col/row to screen pixels
 *   screen (sx, sy)
 *       ↓  + offsetX/Y       shifts by the scene's canvas centre
 *   final pixel position on canvas
 *
 * Depth sorting:
 *   In isometric views, tiles further "into" the screen (higher wx + wy)
 *   must render on top of nearer tiles. depth = wx + wy gives a natural
 *   painter's-algorithm order. We multiply by a small fraction so player
 *   depth slots neatly between the walls layer (depth 1) and props (depth 2).
 */
export class Player {
	private scene:   Phaser.Scene;
	private visual:  Phaser.GameObjects.Sprite; // swap for Sprite once you have art
	private offsetX: number;
	private offsetY: number;

	// Current position in LOCAL room coordinates
	public lx: number;
	public ly: number;

	constructor(
		scene:   Phaser.Scene,
		offsetX: number,
		offsetY: number,
		startLX: number,  // local room X
		startLY: number,  // local room Y
	) {
		this.scene   = scene;
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this.lx      = startLX;
		this.ly      = startLY;

		// Placeholder rectangle — replace with:
		//   this.visual = scene.add.sprite(0, 0, 'player').setOrigin(0.5, 1);
		// once you have a spritesheet loaded.
		this.visual = this.visual = scene.add.sprite(0, 0, "player").setOrigin(0.5, 1);                // anchor at feet, not centre

		// Place immediately at the start tile
		this.setLocalTile(startLX, startLY);
	}

	/**
	 * Move the player to a new local room position.
	 * Call this from game logic / server messages — never set x/y directly.
	 */
	setLocalTile(lx: number, ly: number): void {
		this.lx = lx;
		this.ly = ly;

		// Step 1 — local → world
		const { wx, wy } = toWorld(lx, ly);

		// Step 2 — world → iso screen pixels (relative to scene origin)
		const iso = cartToIso(wx, wy);

		// Step 3 — apply the scene's canvas offset
		// The +TILE_HEIGHT/2 shifts the anchor to the bottom-centre of the
		// tile diamond so the player appears to stand ON the tile, not above it.
		// Adjust the Y nudge here if the player floats or sinks into the floor.
		this.visual.setPosition(
			iso.x + this.offsetX + TILE_HEIGHT / 2,      // +TILE_HEIGHT/2 = half tile width, centres on diamond
			iso.y + this.offsetY + TILE_HEIGHT, // +TILE_HEIGHT, sits on tile surface
		);

		// Step 4 — depth sort: higher wx+wy = further into map = drawn on top
		// Range is walls (1) to props (2); *0.01 keeps us in that band.
		this.visual.setDepth(3 + (wx + wy) * 0.01);
	}
}