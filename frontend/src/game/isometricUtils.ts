import { TILE_WIDTH, TILE_HEIGHT } from "./constants";

export function cartToIso(cartX: number, cartY: number): { x: number, y: number } {
	const x = (cartX - cartY) * (TILE_WIDTH / 2);
	const y = (cartX + cartY) * (TILE_HEIGHT / 2);
	return { x, y };
}

export function isoToCart(isoX: number, isoY: number): { x: number, y: number } {
	const x = Math.floor((isoY / (TILE_HEIGHT / 2) + isoX / (TILE_WIDTH / 2)) / 2);
	const y = Math.floor((isoY / (TILE_HEIGHT / 2) - isoX / (TILE_WIDTH / 2)) / 2);
	return { x, y };
}