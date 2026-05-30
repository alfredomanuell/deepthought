import Phaser from "phaser";
import { TILE_WIDTH, TILE_HEIGHT } from "./constants";

export interface MapLayers {
	map: Phaser.Tilemaps.Tilemap;
	floorsLayer: Phaser.Tilemaps.TilemapLayer | null;
	propsLayer: Phaser.Tilemaps.TilemapLayer | null;
	wallsLayer: Phaser.Tilemaps.TilemapLayer | null;
}

export function setupMap(scene: Phaser.Scene, offsetX: number, offsetY: number): MapLayers {
	const map = scene.make.tilemap({ key: "map", tileWidth: TILE_WIDTH, tileHeight: TILE_HEIGHT });

	const floorsTileset = map.addTilesetImage("Floors", "floor");
	const floorsLayer = map.createLayer("Floors", floorsTileset!, offsetX + TILE_WIDTH, offsetY + TILE_HEIGHT);
	floorsLayer?.setDepth(0);

	const propsTileset = map.addTilesetImage("Props", "props");
	const propsLayer = map.createLayer("Props", propsTileset!, offsetX + TILE_WIDTH, offsetY);
	propsLayer?.setDepth(1);

	const wallsTileset = map.addTilesetImage("Walls", "walls");
	const wallsLayer = map.createLayer("Walls", wallsTileset!, offsetX + TILE_WIDTH, offsetY);
	wallsLayer?.setDepth(2);

	return { map, floorsLayer, propsLayer, wallsLayer };
}