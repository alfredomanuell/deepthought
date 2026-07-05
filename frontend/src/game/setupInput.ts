import Phaser from "phaser";
import { clampZoom, setZoomClamped } from "./setupCamera";

export interface InputCallbacks {
	/** Fired on release when the gesture never exceeded the drag threshold. */
	onTap: (worldX: number, worldY: number) => void;
}

type GestureMode = "idle" | "down" | "pan" | "pinch";

export function setupInput(scene: Phaser.Scene, callbacks: InputCallbacks): void {
	const keyboard = scene.input.keyboard;

	let mode: GestureMode = "idle";
	let spaceHeld = false;
	let pinchDist = 0;
	let pinchMidX = 0;
	let pinchMidY = 0;
	let suppressTap = false;

	// Threshold measured in physical screen pixels, converted to game-space
	// because Scale.FIT reports pointer coords in the 1600x800 logical size.
	const tapThreshold = () =>
		10 * (scene.scale.gameSize.width / scene.scale.displaySize.width);

	if (keyboard) {
		keyboard.enabled = true;

		keyboard.on("keydown-SPACE", () => {
			spaceHeld = true;
		});

		keyboard.on("keyup-SPACE", () => {
			spaceHeld = false;
		});
	}

	const endGesture = () => {
		const anyDown = scene.input.pointer1.isDown || scene.input.pointer2.isDown;
		if (anyDown) {
			// One finger of a multi-touch gesture remains; it must never tap.
			mode = "pinch";
			pinchDist = 0;
		} else {
			mode = "idle";
			suppressTap = false;
		}
	};

	scene.input.on(
		"pointerdown",
		(_pointer: Phaser.Input.Pointer, objectsOver: Phaser.GameObjects.GameObject[]) => {
			const p1 = scene.input.pointer1;
			const p2 = scene.input.pointer2;

			if (p1.isDown && p2.isDown) {
				mode = "pinch";
				suppressTap = true;
				pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
				pinchMidX = (p1.x + p2.x) / 2;
				pinchMidY = (p1.y + p2.y) / 2;
				return;
			}

			if (objectsOver.length > 0) {
				// Tap landed on UI (zoom buttons): neither pan nor move.
				mode = "idle";
				suppressTap = true;
				return;
			}

			suppressTap = false;
			mode = spaceHeld ? "pan" : "down";
		},
	);

	scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
		const cam = scene.cameras.main;

		if (mode === "pinch") {
			const p1 = scene.input.pointer1;
			const p2 = scene.input.pointer2;
			if (!p1.isDown || !p2.isDown) return;

			const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
			const midX = (p1.x + p2.x) / 2;
			const midY = (p1.y + p2.y) / 2;
			if (pinchDist > 0) {
				setZoomClamped(scene, cam.zoom * (dist / pinchDist));
				cam.scrollX -= (midX - pinchMidX) / cam.zoom;
				cam.scrollY -= (midY - pinchMidY) / cam.zoom;
			}
			pinchDist = dist;
			pinchMidX = midX;
			pinchMidY = midY;
			return;
		}

		if (mode === "down") {
			const moved = Phaser.Math.Distance.Between(
				pointer.downX, pointer.downY, pointer.x, pointer.y,
			);
			if (moved > tapThreshold()) mode = "pan";
		}

		if (mode === "pan" && pointer.isDown) {
			// prevPosition is updated by Phaser each frame, so delta is always correct
			cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
			cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
		}
	});

	scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
		if (mode === "down" && !suppressTap) {
			callbacks.onTap(pointer.worldX, pointer.worldY);
		}
		endGesture();
	});

	scene.input.on("pointerupoutside", endGesture);
	scene.input.on("gameout", endGesture);

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
