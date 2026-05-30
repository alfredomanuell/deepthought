import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from './constants';

export function setupCamera(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap): void {
	const camera = scene.cameras.main;

	camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
	const midCol = map.width / 2;
	const midRow = map.height / 2;
	const worldX = (midCol - midRow) * (TILE_WIDTH / 2);
	const worldY = (midCol + midRow) * (TILE_HEIGHT / 2);
	camera.centerOn(worldX, worldY);

}

export function clampZoom(scene: Phaser.Scene, deltaY: number): void {
	const zoom = scene.cameras.main.zoom - deltaY * -0.5;
	scene.cameras.main.zoom = Phaser.Math.Clamp(zoom, 0.5, 10);
}
