import Phaser from "phaser";
import { cartToIso } from "./isometricUtils";
import { TILE_WIDTH, TILE_HEIGHT } from "./constants";

/**
 * Draws a yellow debug label on every tile in the given layer.
 *
 * Each label shows:
 *   (cartX, cartY)   ← the Tiled grid coordinates
 *   id:N             ← the tile's GID (global tile ID from the tileset)
 *
 * The text is placed at the visual centre of the isometric tile diamond.
 *
 * Call this once inside create(), after setupMap().
 * Returns the Phaser Group so you can toggle visibility with debugGroup.setVisible(false).
 */
export function debugTiles(
	scene: Phaser.Scene,
	layer: Phaser.Tilemaps.TilemapLayer,
	offsetX: number,
	offsetY: number,
): Phaser.GameObjects.Group {
	const group = scene.add.group();

	// Iterate every cell in the layer
	layer.forEachTile((tile: Phaser.Tilemaps.Tile) => {
		// Skip empty cells
		if (!tile || tile.index === -1) return;

		const cartX = tile.x;
		const cartY = tile.y;

		// Convert to isometric screen position (top-left corner of the tile)
		const iso = cartToIso(cartX, cartY);

		// The visual centre of an isometric diamond:
		//   X: halfway across  (tile top-left x + TILE_WIDTH/2)
		//   Y: halfway down    (tile top-left y + TILE_HEIGHT/2)
		// The layer is offset, and props/walls layers have an extra -TILE_HEIGHT applied
		// in setupMap, but we receive the layer as-is so we use the raw iso position
		// plus the scene offsets.
		const screenX = iso.x + offsetX + TILE_WIDTH / 2;
		const screenY = iso.y + offsetY + TILE_HEIGHT / 2;

		const label = scene.add
			.text(
				screenX,
				screenY,
				`(${cartX},${cartY})\nid:${tile.index}`,
				{
					fontSize: "9px",
					color: "#ffff00",
					stroke: "#000000",
					strokeThickness: 2,
					align: "center",
				},
			)
			.setOrigin(0.5, 0.5)   // centre the text on the diamond centre
			.setDepth(999);         // always on top

		group.add(label);
	});

	return group;
}