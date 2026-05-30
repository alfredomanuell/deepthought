import Phaser from "phaser";
import { clampZoom } from "./setupCamera";

export function setupInput(scene: Phaser.Scene): void {
	const keyboard = scene.input.keyboard;

	if (keyboard) {
		keyboard.enabled = true;

		keyboard.on("keydown-SPACE", () => {
			scene.input.setDefaultCursor("url(assets/buttons/dragCursor.png), pointer");
		});

		keyboard.on("keyup-SPACE", () => {
			scene.input.setDefaultCursor("default");
		});
	}

	scene.input.on("pointerup", () => {
		scene.input.setDefaultCursor("default");
	});

	scene.input.on(
		"wheel",
		(
			_pointer: Phaser.Input.Pointer,
			_gameObjects: unknown,
			_deltaX: number,
			deltaY: number,
		) => {
			clampZoom(scene, -deltaY * 0.001);
		},
	);
}