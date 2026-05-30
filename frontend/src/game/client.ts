import Phaser from "phaser";
import { setupCamera } from "./setupCamera";
import { setupUI } from "./setupUI";
import { setupInput } from "./setupInput";
import { setupMap } from "./setupMap";
import { cartToIso, isoToCart } from "./isometricUtils";

class GameScene extends Phaser.Scene {
	private offsetX = 0;
	private offsetY = 0;
	private map?: Phaser.Tilemaps.Tilemap;
	private highlight?: Phaser.GameObjects.Image;

	preload() {
		this.load.image("floor", "assets/tilesets/floors.png");
		this.load.image("props", "assets/tilesets/Props.png");
		this.load.image("walls", "assets/tilesets/walls.png");
		this.load.image("plusButton", "assets/buttons/plusButton.png");
		this.load.image("minusButton", "assets/buttons/minusButton.png");
		this.load.image("dragCursor", "assets/buttons/dragCursor.png");
		this.load.image("highlight", "assets/highlight.png");
		this.load.tilemapTiledJSON("map", "assets/cluster/map1.tmj");
	}

	create() {
		this.offsetX = Math.floor(this.cameras.main.width / 2);
		this.offsetY = Math.floor(this.cameras.main.height / 2);

		// Secondary camera for fixed UI elements (buttons, HUD)
		const uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
		uiCamera.setScroll(0, 0);

		const { map } = setupMap(this, this.offsetX, this.offsetY);
		this.map = map;
		setupCamera(this, map);
		setupInput(this);
		setupUI(this, this.cameras.main);
		this.highlight = this.add.image(0, 0, 'highlight');
		this.highlight.setVisible(false);
	}

	update(_time: number, _delta: number): void {
		const worldX = this.input.activePointer.worldX - this.offsetX;
		const worldY = this.input.activePointer.worldY - this.offsetY;

		const { x: hoverX, y: hoverY } = isoToCart(worldX, worldY);

		if (this.map && hoverX >= 0 && hoverX < this.map.width && hoverY >= 0 && hoverY < this.map.height) {
			const isoPos = cartToIso(hoverX, hoverY);
			this.highlight?.setPosition(isoPos.x + this.offsetX, isoPos.y + this.offsetY);
			this.highlight?.setVisible(true);
			this.highlight?.setDepth(hoverY + hoverX + 0.5); // Ensure correct layering based on Y coordinate
		} else {
			this.highlight?.setVisible(false);
		}
			// map is available as this.map
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