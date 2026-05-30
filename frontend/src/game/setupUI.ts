import Phaser from "phaser";
import { clampZoom } from "./setupCamera";

export function setupUI(
	scene: Phaser.Scene,
	mainCamera: Phaser.Cameras.Scene2D.Camera,
): void {
	const padding = 12;
	const spacing = 8;
	const { width } = scene.cameras.main;

	const plusButton = scene.add
		.image(width - padding, padding, "plusButton")
		.setOrigin(1, 0)
		.setInteractive()
		.setScrollFactor(0)
		.setTint(0xaaaaaa);

	plusButton.on("pointerdown", () => clampZoom(scene, +0.1));
	plusButton.on("pointerover", () => plusButton.clearTint());
	plusButton.on("pointerout", () => plusButton.setTint(0xaaaaaa));

	const minusButton = scene.add
		.image(width - padding, padding + plusButton.displayHeight + spacing, "minusButton")
		.setOrigin(1, 0)
		.setInteractive()
		.setScrollFactor(0)
		.setTint(0xaaaaaa);

	minusButton.on("pointerdown", () => clampZoom(scene, -0.1));
	minusButton.on("pointerover", () => minusButton.clearTint());
	minusButton.on("pointerout", () => minusButton.setTint(0xaaaaaa));

	// Keep buttons out of the main world camera
	mainCamera.ignore([plusButton, minusButton]);
}