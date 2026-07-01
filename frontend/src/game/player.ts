import Phaser from "phaser";
import { cartToIso } from "./isometricUtils";
import { toWorld } from "./mapCoords";
import { TILE_HEIGHT } from "./constants";

/**
 * Player
 *
 * Holds a local room position (lx, ly) and a Phaser Container of layer sprites.
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
 * Direction frame mapping (per-layer spritesheet columns):
 *   0 = NW  |  1 = NE  |  2 = SW  |  3 = SE
 *
 * Depth sorting:
 *   depth = 3 + (wx + wy) * 0.01, keeping us between walls (1) and props (2).
 */

const LAYER_KEYS = ['skin', 'eyes', 'hair', 'clothes', 'accessory'] as const;

export type Direction = 'NW' | 'NE' | 'SW' | 'SE';

const DIRECTION_FRAME: Record<Direction, number> = { NW: 0, NE: 1, SW: 2, SE: 3 };

export class Player {
	private scene: Phaser.Scene;
	private container: Phaser.GameObjects.Container;
	private sprites: Phaser.GameObjects.Sprite[] = [];
	private nameplate?: Phaser.GameObjects.Text;
	private offsetX: number;
	private offsetY: number;
	private direction: Direction = 'SE';

	public lx: number;
	public ly: number;

	constructor(
		scene: Phaser.Scene,
		offsetX: number,
		offsetY: number,
		startLX: number,
		startLY: number,
		displayName?: string,
	) {
		this.scene = scene;
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this.lx      = startLX;
		this.ly      = startLY;

		this.container = scene.add.container(0, 0);

		for (const layer of LAYER_KEYS) {
			const key = `char_${layer}`;
			// Fallback to frame 3 (SE) on creation; setLocalTile will set the right frame
			const sprite = scene.add.sprite(0, 0, key, DIRECTION_FRAME['SE']);
			sprite.setOrigin(0.5, 1); // anchor at feet
			this.sprites.push(sprite);
			this.container.add(sprite);
		}

		if (displayName) {
			this.nameplate = scene.add.text(0, -TILE_HEIGHT * 2, displayName, {
				fontSize: '12px',
				color: '#ffffff',
				align: 'center',
			}).setOrigin(0.5, 1);
			this.container.add(this.nameplate);
		}

		this.setLocalTile(startLX, startLY);
	}

	/**
	 * Move the player to a new local room position.
	 * Optionally change facing direction; if omitted, direction is inferred from movement.
	 */
	setLocalTile(lx: number, ly: number, direction?: Direction): void {
		if (direction) this.direction = direction;

		this.lx = lx;
		this.ly = ly;

		const { wx, wy } = toWorld(lx, ly);
		const iso = cartToIso(wx, wy);

		const x = iso.x + this.offsetX + TILE_HEIGHT / 2;
		const y = iso.y + this.offsetY + TILE_HEIGHT;

		this.container.setPosition(x, y);
		this.container.setDepth(3 + (wx + wy) * 0.01);

		const frame = DIRECTION_FRAME[this.direction];
		for (const sprite of this.sprites) {
			sprite.setFrame(frame);
		}
	}

	setDirection(direction: Direction): void {
		this.direction = direction;
		const frame = DIRECTION_FRAME[direction];
		for (const sprite of this.sprites) {
			sprite.setFrame(frame);
		}
	}

	/**
	 * Move a remote player to a new tile smoothly instead of teleporting.
	 * Used for players driven by `player:move` broadcasts, not the local player.
	 */
	moveToTile(lx: number, ly: number, direction: Direction): void {
		this.direction = direction;
		this.lx = lx;
		this.ly = ly;

		const { wx, wy } = toWorld(lx, ly);
		const iso = cartToIso(wx, wy);

		const x = iso.x + this.offsetX + TILE_HEIGHT / 2;
		const y = iso.y + this.offsetY + TILE_HEIGHT;

		this.scene.tweens.add({
			targets: this.container,
			x,
			y,
			duration: 200,
			ease: 'Linear',
		});
		this.container.setDepth(3 + (wx + wy) * 0.01);

		const frame = DIRECTION_FRAME[this.direction];
		for (const sprite of this.sprites) {
			sprite.setFrame(frame);
		}
	}

	/** Removes this player's container and all its sprites from the scene. */
	destroy(): void {
		this.container.destroy();
	}
}
