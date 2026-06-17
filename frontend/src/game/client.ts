import Phaser from "phaser";
import { setupCamera } from "./setupCamera";
import { setupUI } from "./setupUI";
import { setupInput } from "./setupInput";
import { setupMap } from "./setupMap";
import { cartToIso, isoToCart } from "./isometricUtils";
import { toLocal, isValidTile } from "./mapCoords";
import { Player } from "./player";

class GameScene extends Phaser.Scene {
	private offsetX = 0;
	private offsetY = 0;
	private map?: Phaser.Tilemaps.Tilemap;
	private highlight?: Phaser.GameObjects.Image;
	private player?: Player;

	preload() {
		this.load.image("floor",			"assets/tilesets/floors.png");
		this.load.image("props",			"assets/tilesets/Props.png");
		this.load.image("walls",			"assets/tilesets/walls.png");
		this.load.image("plusButton",		"assets/buttons/plusButton.png");
		this.load.image("minusButton",		"assets/buttons/minusButton.png");
		this.load.image("highlight",		"assets/highlight.png");
		this.load.image("player",			"assets/character/SE.png");
		this.load.tilemapTiledJSON("map",	"assets/cluster/map1.tmj");
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

		const { map } = setupMap(this, this.offsetX, this.offsetY);
		this.map = map;
		setupCamera(this, map, this.offsetX, this.offsetY);
		setupInput(this);
		setupUI(this, this.cameras.main);

		this.highlight = this.add.image(0, 0, "highlight").setOrigin(0, 0);
		this.highlight.setVisible(false);

		// ── Spawn player at local (0, 0) — the entrance tile ─────────────────
		// To spawn elsewhere, just change these two numbers to any valid
		// local room coordinates. isValidTile() will tell you if a coord is walkable.
		this.player = new Player(this, this.offsetX, this.offsetY, 0, 0);

		// ── Click to move ─────────────────────────────────────────────────────
		// Convert the click's world tile coord → local, validate, then move.
		this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			const worldX = pointer.worldX - this.offsetX;
			const worldY = pointer.worldY - this.offsetY;

			const { x: wx, y: wy } = isoToCart(worldX, worldY);
			const { lx, ly }       = toLocal(wx, wy);

			if (isValidTile(lx, ly)) {
				this.player?.setLocalTile(lx, ly);
			}
		});
	}

	update(_time: number, _delta: number): void {
		const worldX = this.input.activePointer.worldX - this.offsetX;
		const worldY = this.input.activePointer.worldY - this.offsetY;

		const { x: hoverX, y: hoverY } = isoToCart(worldX, worldY);
		const { lx, ly }               = toLocal(hoverX, hoverY);
		const valid                    = isValidTile(lx, ly);

		if (
			this.map &&
			hoverX >= 0 && hoverX < this.map.width &&
			hoverY >= 0 && hoverY < this.map.height
		) {
			const isoPos = cartToIso(hoverX, hoverY);
			this.highlight?.setPosition(isoPos.x + this.offsetX, isoPos.y + this.offsetY);
			this.highlight?.setTint(valid ? 0xffffff : 0xff4444);
			this.highlight?.setVisible(true);
			this.highlight?.setDepth(0.5);
		} else {
			this.highlight?.setVisible(false);
		}
	}
}

export function startGame(parent: string | HTMLElement): Phaser.Game {
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