"use strict";
// Home/Games/Settings background: the WebGL star field from galaxy-gl.js on a fixed canvas behind the page.
// The star colour follows the Design page choice (html[data-bg]). The dive into the Games page is a warp-speed
// rush through the stars, and the Games page opens with the stars flying back in.
(() => {
	const canvas = document.getElementById("galaxy");
	if (!canvas) return;
	const root = document.documentElement;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const GL = window.VodiousGL;
	const emerging = !reduceMotion && root.classList.contains("from-dive") && root.dataset.theme !== "light";

	const ctl = GL ? GL.create(canvas, { palette: GL.paletteFor(root.dataset.bg), dpr: 1, intro: emerging }) : null;
	if (!ctl) {
		canvas.remove();
		return;
	}
	const sync = () => {
		const id = root.dataset.bg;
		ctl.setPalette(GL.paletteFor(id));
		// Rainbow uses the shader's own colours
		ctl.paused = root.dataset.theme === "light" || /^(image|grid|plain)$/.test(id || "");
	};
	sync();
	new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-bg", "data-theme"] });

	let diveRaf = 0;
	// Rushes through the stars; resolves when the animation has finished
	function dive(duration) {
		cancelAnimationFrame(diveRaf);
		return new Promise((resolve) => {
			const t0 = performance.now();
			const step = (now) => {
				const p = Math.min(1, (now - t0) / duration);
				ctl.force = 0.15 + 1.6 * Math.pow(p, 1.8);
				ctl.speedUp = 1 + 8 * p * p;
				if (p < 1) diveRaf = requestAnimationFrame(step);
				else resolve();
			};
			diveRaf = requestAnimationFrame(step);
		});
	}

	// Back to normal, e.g. when the browser restores this page from its back/forward cache
	function reset() {
		cancelAnimationFrame(diveRaf);
		ctl.force = null;
		ctl.speedUp = 1;
		ctl.state.boost = 0;
	}

	// Stars fly back in (used when the single-file build switches to the Games view)
	function emerge() {
		cancelAnimationFrame(diveRaf);
		ctl.force = null;
		ctl.speedUp = 1;
		ctl.setIntro(true);
	}

	window.VodiousGalaxy = { dive, emerge, reset };
})();
