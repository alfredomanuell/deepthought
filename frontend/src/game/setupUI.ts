import Phaser from "phaser";
import { clampZoom } from "./setupCamera";
import { hasHover } from "./deviceCapabilities";

export function setupUI(
	scene: Phaser.Scene,
	mainCamera: Phaser.Cameras.Scene2D.Camera,
): void {
	const padding = 12;
	const spacing = 8;
	const hoverable = hasHover();

	// Top-left: safe on every layout (the React sidebar docks right and
	// collapses to a 64px rail on small screens).
	const plusButton = scene.add
		.image(padding, padding, "plusButton")
		.setOrigin(0, 0)
		.setInteractive()
		.setScrollFactor(0)
		.setTint(0xaaaaaa);

	const minusButton = scene.add
		.image(padding, padding + plusButton.displayHeight + spacing, "minusButton")
		.setOrigin(0, 0)
		.setInteractive()
		.setScrollFactor(0)
		.setTint(0xaaaaaa);

	plusButton.on("pointerdown", () => clampZoom(scene, +0.1));
	minusButton.on("pointerdown", () => clampZoom(scene, -0.1));

	if (hoverable) {
		plusButton.on("pointerover", () => plusButton.clearTint());
		plusButton.on("pointerout", () => plusButton.setTint(0xaaaaaa));
		minusButton.on("pointerover", () => minusButton.clearTint());
		minusButton.on("pointerout", () => minusButton.setTint(0xaaaaaa));
	} else {
		// Touch: pointerover/out never fire, so give press feedback instead.
		plusButton.on("pointerdown", () => plusButton.clearTint());
		plusButton.on("pointerup", () => plusButton.setTint(0xaaaaaa));
		minusButton.on("pointerdown", () => minusButton.clearTint());
		minusButton.on("pointerup", () => minusButton.setTint(0xaaaaaa));
	}

	mainCamera.ignore([plusButton, minusButton]);
}
