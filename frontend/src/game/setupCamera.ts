import Phaser from 'phaser';
import { TILE_WIDTH, TILE_HEIGHT } from './constants';

export function setupCamera(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap, offsetX: number, offsetY: number): void {
	const camera = scene.cameras.main;

	const midCol = map.width / 2;
	const midRow = map.height / 2;
	const worldX = (midCol - midRow) * (TILE_WIDTH / 2) + offsetX;
	const worldY = (midCol + midRow) * (TILE_HEIGHT / 2) + offsetY;
	camera.centerOn(worldX, worldY);


	const isoW = (map.width + map.height) * (TILE_WIDTH / 2);
const isoH = (map.width + map.height) * (TILE_HEIGHT / 2);
const boundsX = offsetX - map.height * (TILE_WIDTH / 2);
const boundsY = offsetY;
camera.setBounds(boundsX, boundsY, isoW, isoH);
}

export function setZoomClamped(scene: Phaser.Scene, zoom: number): void {
	scene.cameras.main.zoom = Phaser.Math.Clamp(zoom, 0.5, 10);
}

export function clampZoom(scene: Phaser.Scene, deltaY: number): void {
	setZoomClamped(scene, scene.cameras.main.zoom + deltaY * 0.5);
}
