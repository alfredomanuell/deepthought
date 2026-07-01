import Phaser from "phaser";
import { setupCamera } from "./setupCamera";
import { setupUI } from "./setupUI";
import { setupInput } from "./setupInput";
import { setupMap } from "./setupMap";
import { cartToIso } from "./isometricUtils";
import { toLocal, isValidTile } from "./mapCoords";
import { Player, type Direction } from "./player";
import { RemotePlayerSync } from "./remotePlayerSync";
import type { CharacterLayers } from "../api/character";

export type { CharacterLayers };

/** Infers a facing direction from a movement delta in local room coords. */
function directionFromDelta(dx: number, dy: number): Direction {
	if (dx >= 0 && dy < 0) return 'NE';
	if (dx < 0 && dy < 0) return 'NW';
	if (dx < 0 && dy >= 0) return 'SW';
	return 'SE';
}

// Module-level so GameScene can read it without constructor gymnastics
let _localUserId = '';
let _localDisplayName: string | undefined;

const LAYER_ORDER: (keyof CharacterLayers)[] = ['skin', 'eyes', 'hair', 'clothes', 'accessory'];
const FRAME_WIDTH  = 64;
const FRAME_HEIGHT = 64;

// Module-level store so GameScene can read it without constructor gymnastics
let _characterLayers: CharacterLayers = {
  skin: 'light',
  eyes: 'blue',
  hair: 'black_short',
  clothes: 'tshirt_white',
  accessory: 'none',
};

export function getCharacterLayers(): CharacterLayers {
  return _characterLayers;
}

class GameScene extends Phaser.Scene {
	private offsetX = 0;
	private offsetY = 0;
	private floorsLayer?: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null;
	private highlight?: Phaser.GameObjects.Image;
	private player?: Player;
	private remoteSync?: RemotePlayerSync;

	preload() {
		this.load.image("floor",       "assets/tilesets/floors.png");
		this.load.image("props",       "assets/tilesets/Props.png");
		this.load.image("walls",       "assets/tilesets/walls.png");
		this.load.image("plusButton",  "assets/buttons/plusButton.png");
		this.load.image("minusButton", "assets/buttons/minusButton.png");
		this.load.image("highlight",   "assets/highlight.png");
		this.load.tilemapTiledJSON("map", "assets/cluster/map1.tmj");

		// Load one spritesheet per layer (4-frame strip: NW, NE, SW, SE)
		const layers = getCharacterLayers();
		for (const layer of LAYER_ORDER) {
			const key = `char_${layer}`;
			const path = `assets/character/layers/${layer}/${layers[layer]}.png`;
			this.load.spritesheet(key, path, { frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT });
		}
	}

	create() {
		this.offsetX = Math.floor(this.cameras.main.width  / 2);
		this.offsetY = Math.floor(this.cameras.main.height / 2);

		const uiCamera = this.cameras.add(
			0, 0,
			this.cameras.main.width,
			this.cameras.main.height,
		);
		uiCamera.setScroll(0, 0);

		const { map, floorsLayer } = setupMap(this, this.offsetX, this.offsetY);
		this.floorsLayer = floorsLayer;
		setupCamera(this, map, this.offsetX, this.offsetY);
		setupInput(this);
		setupUI(this, this.cameras.main);

		this.highlight = this.add.image(0, 0, "highlight").setOrigin(0, 0);
		this.highlight.setVisible(false);

		// ── Spawn player at local (0, 0) — the entrance tile ─────────────────
		this.player = new Player(this, this.offsetX, this.offsetY, 0, 0, _localDisplayName);

		// ── Multiplayer: spawn/despawn/move remote players via the world gateway ──
		if (_localUserId) {
			this.remoteSync = new RemotePlayerSync(this, this.offsetX, this.offsetY, _localUserId);
			this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.remoteSync?.destroy());
		}

		// ── Click to move ─────────────────────────────────────────────────────
		this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			const tile = this.floorsLayer?.getTileAtWorldXY(
				pointer.worldX,
				pointer.worldY,
				true,
				this.cameras.main,
			);

			if (tile) {
				const { lx, ly } = toLocal(tile.x, tile.y);
				if (isValidTile(lx, ly) && this.player) {
					const direction = directionFromDelta(lx - this.player.lx, ly - this.player.ly);
					this.player.setLocalTile(lx, ly, direction);
					this.remoteSync?.emitMove(lx, ly, direction);
				}
			}
		});
	}

	update(_time: number, _delta: number): void {
		const tile = this.floorsLayer?.getTileAtWorldXY(
			this.input.activePointer.worldX,
			this.input.activePointer.worldY,
			true,
			this.cameras.main,
		);

		if (!tile) {
			this.highlight?.setVisible(false);
			return;
		}

		const { lx, ly } = toLocal(tile.x, tile.y);
		const valid = isValidTile(lx, ly);
		const isoPos = cartToIso(tile.x, tile.y);
		this.highlight?.setPosition(isoPos.x + this.offsetX, isoPos.y + this.offsetY);
		this.highlight?.setTint(valid ? 0xffffff : 0xff4444);
		this.highlight?.setVisible(true);
		this.highlight?.setDepth(0.5);
	}
}

export function startGame(
	parent: string | HTMLElement,
	characterLayers?: CharacterLayers,
	localUserId?: string,
	localDisplayName?: string,
): Phaser.Game {
	if (characterLayers) _characterLayers = characterLayers;
	if (localUserId) _localUserId = localUserId;
	_localDisplayName = localDisplayName;

	return new Phaser.Game({
		type: Phaser.AUTO,
		parent,
		width: 1600,
		height: 800,
		backgroundColor: "#111125",
		scene: [GameScene],
		physics: {
			default: "arcade",
			arcade: { debug: false, gravity: { x: 0, y: 0 } },
		},
	});
}
