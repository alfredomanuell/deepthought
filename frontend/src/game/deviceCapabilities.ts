/** True when the primary input device can hover (mouse/trackpad). */
export function hasHover(): boolean {
	return typeof window !== "undefined"
		&& window.matchMedia("(hover: hover)").matches;
}
