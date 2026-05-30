import Phaser from "phaser";

const TILE_HEIGHT = 32;
const TILE_WIDTH = 64;

class GameScene extends Phaser.Scene {
	private offsetX = 0;
	private offsetY = 0;

	preload() {

		this.load.image('floor', 'assets/tilesets/floors.png');
		this.load.image('props', 'assets/tilesets/Props.png');
		this.load.image('walls', 'assets/tilesets/walls.png');
		this.load.image('plusButton', 'assets/buttons/plusButton.png');
		this.load.image('minusButton', 'assets/buttons/minusButton.png');
		this.load.image('dragCursor', 'assets/buttons/dragCursor.png')
		this.load.tilemapTiledJSON('map', 'assets/cluster/map1.tmj');
	}

	create() {
		const keyboard = this.input.keyboard;
		this.offsetX = this.cameras.main.width / 2;
		this.offsetY = this.cameras.main.height / 2;
		if (keyboard) {
			keyboard.enabled = true;
		}
		
		const uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
		uiCamera.setScroll(0, 0);

		keyboard?.on('keydown-SPACE', () => {
			this.input.setDefaultCursor('url(assets/buttons/dragCursor.png), pointer');
			console.log('SPACE down');
		});

		keyboard?.on('keyup-SPACE', () => {
			this.input.setDefaultCursor('default');
			console.log('SPACE up');
		});

		this.input.on('pointerup', () => {
			this.input.setDefaultCursor('default');
		});

		const padding = 12;

		// Top-right aligned buttons using origin (1,0) so we don't need to subtract image size
		const plusButton = this.add.image(this.cameras.main.width - padding, padding, 'plusButton')
			.setOrigin(1, 0)
			.setInteractive()
			.setScrollFactor(0)
			.setTint(0xaaaaaa);

		plusButton.on('pointerdown', () => { 
			this.cameras.main.zoom = Phaser.Math.Clamp(this.cameras.main.zoom + 0.1, 0.5, 2);
		 });
		plusButton.on('pointerover', () => plusButton.clearTint());
		plusButton.on('pointerout', () => plusButton.setTint(0xaaaaaa));

		const spacing = 8;
		const minusButton = this.add.image(this.cameras.main.width - padding, padding + plusButton.displayHeight + spacing, 'minusButton')
			.setOrigin(1, 0)
			.setInteractive()
			.setScrollFactor(0)
			.setTint(0xaaaaaa);

		minusButton.on('pointerdown', () => { 
			  this.cameras.main.zoom = Phaser.Math.Clamp(this.cameras.main.zoom - 0.1, 0.5, 2);
		});
		minusButton.on('pointerover', () => minusButton.clearTint());
		minusButton.on('pointerout', () => minusButton.setTint(0xaaaaaa));

		this.cameras.main.ignore([plusButton, minusButton]);
		uiCamera.ignore([/* Maybe will need later */]);


		const map = this.make.tilemap({ key: 'map', tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT });
		const tileset = map.addTilesetImage('Floors', 'floor');
		const layer = map.createLayer('Floors', tileset!, this.offsetX + TILE_WIDTH, this.offsetY + TILE_HEIGHT);
		layer?.setDepth(0);
		
		const propsTileset = map.addTilesetImage('Props', 'props');
		const propsLayer = map.createLayer('Props', propsTileset!, this.offsetX + TILE_WIDTH, this.offsetY);
		propsLayer?.setDepth(1);
		
		const wallsTileset = map.addTilesetImage('Walls', 'walls');
		const wallsLayer = map.createLayer('Walls', wallsTileset!, this.offsetX + TILE_WIDTH, this.offsetY);
		wallsLayer?.setDepth(2);

		this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
		// Center camera on map so it's visible by default
		// Center on the middle tile of the map
		const midCol = map.width / 2;
		const midRow = map.height / 2;
		const worldX = (midCol - midRow) * (TILE_WIDTH / 2);
		const worldY = (midCol + midRow) * (TILE_HEIGHT / 2);
		this.cameras.main.centerOn(worldX, worldY);

		this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
			const zoom = this.cameras.main.zoom - deltaY * 0.001;
			this.cameras.main.zoom = Phaser.Math.Clamp(zoom, 0.5, 2);
		});
	}

	update(_time: number, _delta: number): void {
	
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
			default: 'arcade',
			arcade: {
				debug: false,
				gravity: { x: 0, y: 0 },
			},
		},
		// scene: [MenuScene, GameScene],
	});
}
