"use strict";
// Home page background: a slowly turning purple galaxy on a fixed canvas behind the page.
// Same look as the intro (spiral arms, violet palette, small black hole), but dimmer and much slower.
(() => {
	const canvas = document.getElementById("galaxy");
	if (!canvas) return;
	const ctx = canvas.getContext ? canvas.getContext("2d") : null;
	if (!ctx) {
		canvas.remove();
		return;
	}

	const root = document.documentElement;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const SPEED = 0.00004; // orbit speed; stars near the center turn faster than the rim
	const FRAME_MS = 33; // about 30 fps is plenty for something this slow
	const TILT = 0.5; // squashes the disk so it reads as a tilted spiral
	const ROLL = -0.45; // rotates the whole galaxy on screen
	const HOLE = 0.05; // black hole radius, in units of U

	// Light to deep violet, plus one pink for variety (same palette as the intro)
	const PALETTE = [
		"#fbf3ff",
		"#f0d9ff",
		"#dfb8ff",
		"#c993ff",
		"#b072ff",
		"#9a58f5",
		"#8446e0",
		"#6d3ad0",
		"#ff8fe0",
	];

	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const gauss = () => {
		let u = 0;
		let v = 0;
		while (u === 0) u = Math.random();
		while (v === 0) v = Math.random();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};

	const cosR = Math.cos(ROLL);
	const sinR = Math.sin(ROLL);

	let W = 0;
	let H = 0;
	let U = 0; // the unit star positions are measured in
	let cx = 0;
	let cy = 0;
	let buckets = [];
	let zoom = 1; // 1 normally; the dive animates it up so the black hole grows until it fills the screen
	let diving = false; // while true, the dive animation draws instead of the idle loop
	let diveRaf = 0;

	function build() {
		buckets = Array.from({ length: PALETTE.length * 2 }, () => []);

		// Spiral galaxy
		const count = clamp(Math.round((W * H) / 750), 900, 2400);
		const arms = 3;
		for (let i = 0; i < count; i++) {
			const r = HOLE * 1.4 + Math.pow(Math.random(), 1.7) * 2.1;
			const arm = Math.floor(Math.random() * arms);
			const spread = 0.18 + 0.22 * Math.min(r, 1.2);
			const a = arm * ((Math.PI * 2) / arms) + r * 3.1 + gauss() * spread;
			const heat = Math.min(1, r / 1.1);
			let ci = Math.floor((heat * 0.55 + Math.random() * 0.45) * 8);
			ci = clamp(ci, 0, 7);
			if (Math.random() < 0.08) ci = 8;
			const size = 0.5 + Math.random() * 1.3 + (1 - heat) * 0.4;
			buckets[ci * 2 + (size > 1.2 ? 1 : 0)].push({
				r,
				a,
				k: 1 / Math.pow(0.28 + r, 0.85),
				fixed: false,
			});
		}

		// Distant stars that stay put (positions are fractions of the screen)
		const far = Math.round((W * H) / 7000);
		for (let i = 0; i < far; i++) {
			buckets[Math.floor(Math.random() * 3) * 2].push({
				fx: Math.random(),
				fy: Math.random(),
				fixed: true,
			});
		}
	}

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		W = window.innerWidth;
		H = window.innerHeight;
		U = Math.max(W, H) * 0.42;
		// Tucked into the upper right so the black hole never sits behind the page content
		const wide = W > H;
		cx = W * (wide ? 0.86 : 0.84);
		cy = H * (wide ? 0.3 : 0.12);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		build();
		if (reduceMotion) draw(0);
	}

	function nebula(spin) {
		const blobs = [
			[-0.35, -0.1, 1.1, "124,58,237", 0.16],
			[0.4, 0.12, 0.9, "192,38,211", 0.1],
			[0.05, 0.35, 1.2, "76,29,149", 0.18],
			[-0.15, -0.3, 0.8, "168,85,247", 0.09],
		];
		const rot = ROLL + spin * 0.25;
		const cr = Math.cos(rot);
		const sr = Math.sin(rot);
		for (const [bx, by, br, rgb, alpha] of blobs) {
			const x = cx + (bx * cr - by * sr) * U * zoom;
			const y = cy + (bx * sr + by * cr) * U * zoom;
			const rad = br * U * zoom;
			const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
			g.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
			g.addColorStop(1, "rgba(" + rgb + ",0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);
		}
	}

	function stars(spin) {
		const sizeScale = 1 + 0.12 * Math.sqrt(zoom);
		for (let b = 0; b < buckets.length; b++) {
			const list = buckets[b];
			if (!list.length) continue;
			const size = (b & 1 ? 1.9 : 1.1) * sizeScale;
			ctx.fillStyle = PALETTE[b >> 1];
			ctx.beginPath();
			for (let i = 0; i < list.length; i++) {
				const p = list[i];
				let x;
				let y;
				if (p.fixed) {
					x = cx + (p.fx * W - cx) * zoom;
					y = cy + (p.fy * H - cy) * zoom;
				} else {
					const ang = p.a + spin * p.k;
					const xr = Math.cos(ang) * p.r;
					const yr = Math.sin(ang) * p.r * TILT;
					x = cx + (xr * cosR - yr * sinR) * U * zoom;
					y = cy + (xr * sinR + yr * cosR) * U * zoom;
				}
				if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
				ctx.rect(x, y, size, size);
			}
			ctx.fill();
		}
	}

	function blackHole() {
		const R = HOLE * U * zoom;
		// While diving, the glow and ring fade so the hole ends up surrounded by darkness, not a huge bright band
		const dim = 1 / (1 + 0.12 * (zoom - 1));

		const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 5);
		glow.addColorStop(0, "rgba(255,214,255,0.55)");
		glow.addColorStop(0.3, "rgba(200,120,255,0.3)");
		glow.addColorStop(0.65, "rgba(110,45,200,0.12)");
		glow.addColorStop(1, "rgba(60,20,120,0)");
		ctx.globalAlpha = dim;
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, W, H);

		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(-0.25);
		ctx.beginPath();
		ctx.ellipse(0, 0, R * 2.5, R * 0.62, 0, 0, Math.PI * 2);
		ctx.strokeStyle = "rgba(240,180,255,0.22)";
		ctx.lineWidth = R * 0.5;
		ctx.stroke();
		ctx.strokeStyle = "rgba(255,230,255,0.6)";
		ctx.lineWidth = Math.max(1, R * 0.04);
		ctx.stroke();
		ctx.restore();
		ctx.globalAlpha = 1;

		ctx.globalCompositeOperation = "source-over";
		ctx.beginPath();
		ctx.arc(cx, cy, R, 0, Math.PI * 2);
		ctx.fillStyle = "#000";
		ctx.fill();
		ctx.globalAlpha = 0.3 + 0.7 * dim;
		ctx.strokeStyle = "rgba(255,225,255,0.8)";
		ctx.lineWidth = Math.max(1.2, R * 0.035);
		ctx.stroke();
	}

	function draw(spin) {
		ctx.clearRect(0, 0, W, H);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "lighter";
		nebula(spin);
		stars(spin);
		blackHole();
		ctx.globalCompositeOperation = "source-over";
	}

	let spin = 0;
	let lastDraw = 0;

	function frame(now) {
		requestAnimationFrame(frame);
		if (diving) return; // the dive animation is drawing instead
		// The light theme has no galaxy (CSS hides the canvas), so skip the work
		if (root.dataset.theme === "light") {
			lastDraw = 0;
			return;
		}
		if (now - lastDraw < FRAME_MS) return;
		const dt = lastDraw ? Math.min(100, now - lastDraw) : 0;
		lastDraw = now;
		spin += dt * SPEED;
		draw(spin);
	}

	// The zoom at which the black hole covers the whole screen, wherever in the corner it sits
	function fullZoom() {
		const far = Math.max(
			Math.hypot(cx, cy),
			Math.hypot(W - cx, cy),
			Math.hypot(cx, H - cy),
			Math.hypot(W - cx, H - cy)
		);
		return Math.max(8, (far * 1.25) / (HOLE * U));
	}

	// Zooms into the black hole (forward) or back out of it. The zoom accelerates like a fall, and the
	// galaxy spins faster as it goes. Resolves when the animation has finished.
	function zoomRun(duration, forward) {
		cancelAnimationFrame(diveRaf);
		diving = true;
		const zEnd = fullZoom();
		return new Promise((resolve) => {
			const t0 = performance.now();
			let prev = t0;
			const step = (now) => {
				const p = clamp((now - t0) / duration, 0, 1);
				// 0..1 along the fall; the hole covers the screen by 85% of the way, then stays solid black
				const q = Math.min((forward ? p : 1 - p) / 0.85, 1);
				zoom = Math.pow(zEnd, Math.pow(q, 1.8));
				spin += Math.min(100, now - prev) * SPEED * (1 + 60 * q * q);
				prev = now;
				draw(spin);
				if (p < 1) {
					diveRaf = requestAnimationFrame(step);
					return;
				}
				if (!forward) {
					zoom = 1;
					diving = false;
					lastDraw = 0;
				}
				resolve();
			};
			diveRaf = requestAnimationFrame(step);
		});
	}

	// Back to normal, e.g. when the browser restores this page from its back/forward cache
	function reset() {
		cancelAnimationFrame(diveRaf);
		zoom = 1;
		diving = false;
		lastDraw = 0;
		if (reduceMotion) draw(0);
	}

	window.VodiousGalaxy = { dive: (duration) => zoomRun(duration, true), reset };

	resize();
	window.addEventListener("resize", resize);

	// Arriving from the home page's dive: come back out of the black hole
	const emerging = !reduceMotion && root.classList.contains("from-dive") && root.dataset.theme !== "light";

	if (emerging) {
		zoomRun(1300, false).then(() => requestAnimationFrame(frame));
	} else if (reduceMotion) {
		draw(0);
	} else {
		requestAnimationFrame(frame);
	}
})();
