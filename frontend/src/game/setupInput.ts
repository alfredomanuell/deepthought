import Phaser from "phaser";
import { clampZoom } from "./setupCamera";

export function setupInput(scene: Phaser.Scene): void {
	const keyboard = scene.input.keyboard;

	let spaceHeld = false;
	let pointerHeld = false;

	const stopDrag = () => {
		scene.input.setDefaultCursor("default");
	};

	if (keyboard) {
		keyboard.enabled = true;

		keyboard.on("keydown-SPACE", () => {
			spaceHeld = true;
			scene.input.setDefaultCursor("url(assets/buttons/dragCursor.png), pointer");
		});

		keyboard.on("keyup-SPACE", () => {
			spaceHeld = false;
			stopDrag();
		});
	}

	scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
		if (!spaceHeld) return;
		pointerHeld = true;
		// Capture the starting position at the moment of click,
		// so the first pointermove delta is always accurate
		scene.input.activePointer.x = pointer.x;
		scene.input.activePointer.y = pointer.y;
	});

	scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
		if (!spaceHeld || !pointerHeld) return;

		// prevPosition is updated by Phaser each frame, so delta is always correct
		const dx = pointer.x - pointer.prevPosition.x;
		const dy = pointer.y - pointer.prevPosition.y;

		scene.cameras.main.scrollX -= dx / scene.cameras.main.zoom;
		scene.cameras.main.scrollY -= dy / scene.cameras.main.zoom;
	});

	scene.input.on("pointerup", () => {
		pointerHeld = false;
		stopDrag();
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