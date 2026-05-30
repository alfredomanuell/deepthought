import Phaser from "phaser";
import { setupCamera } from "./setupCamera";
import { setupUI } from "./setupUI";
import { setupInput } from "./setupInput";
import { setupMap } from "./setupMap";
import { cartToIso, isoToCart } from "./isometricUtils";
import { debugTiles } from "./debugTiles"; // 👈 add this
import { Player } from "./player"; // 👈 add this

class GameScene extends Phaser.Scene {
	private offsetX = 0;
	private offsetY = 0;
	private map?: Phaser.Tilemaps.Tilemap;
	private highlight?: Phaser.GameObjects.Image;
	private player?: Player;

	preload() {
		this.load.image("floor", "assets/tilesets/floors.png");
		this.load.image("props", "assets/tilesets/Props.png");
		this.load.image("walls", "assets/tilesets/walls.png");
		this.load.image("plusButton", "assets/buttons/plusButton.png");
		this.load.image("minusButton", "assets/buttons/minusButton.png");
		this.load.image("highlight", "assets/highlight.png");
		this.load.image("player", "assets/character/SE.png");
		this.load.tilemapTiledJSON("map", "assets/cluster/map1.tmj");
	}

	create() {
		this.offsetX = Math.floor(this.cameras.main.width / 2);
		this.offsetY = Math.floor(this.cameras.main.height / 2);

		const uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
		uiCamera.setScroll(0, 0);

		const { map, floorsLayer } = setupMap(this, this.offsetX, this.offsetY);
		console.log(`Map size: ${map.width} x ${map.height}`);
		this.map = map;
		setupCamera(this, map, this.offsetX, this.offsetY);
		setupInput(this);
		setupUI(this, this.cameras.main);

		this.highlight = this.add.image(0, 0, "highlight").setOrigin(0, 0);
		this.highlight.setVisible(false);

		// 👇 Drop this one line to draw debug labels on every floor tile.
		//    Pass floorsLayer — it has no Y offset quirk unlike walls/props.
		//    Wrap in an `if` or a debug flag to turn off for production.
		if (floorsLayer) {
			debugTiles(this, floorsLayer, this.offsetX, this.offsetY);
		}
		const startX = Math.floor(map.width / 2);
		const startY = Math.floor(map.height / 2);
		this.player = new Player(this, 38, 33);	}

	update(_time: number, _delta: number): void {
		const worldX = this.input.activePointer.worldX - this.offsetX;
		const worldY = this.input.activePointer.worldY - this.offsetY;

		const { x: hoverX, y: hoverY } = isoToCart(worldX, worldY);

		if (this.map && hoverX >= 0 && hoverX < this.map.width && hoverY >= 0 && hoverY < this.map.height) {
			const isoPos = cartToIso(hoverX, hoverY);
			this.highlight?.setPosition(isoPos.x + this.offsetX, isoPos.y + this.offsetY);
			this.highlight?.setVisible(true);
			this.highlight?.setDepth(0.5);
			console.log(`Hovering tile: (${hoverX}, ${hoverY})`);
			console.log(`isometric pos: (${isoPos.x}, ${isoPos.y})`);
			console.log(`isometric pos + offset: (${isoPos.x + this.offsetX}, ${isoPos.y + this.offsetY})`);

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
			arcade: {
				debug: false,
				gravity: { x: 0, y: 0 },
			},
		},
	});
}