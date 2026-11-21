"use strict";
// Intro animation: purple galaxy -> fall into the black hole -> title pops -> fade to the home page.
// No sound.
// Click, tap or press any key to skip. Skipped entirely when the visitor prefers reduced motion.
(() => {
	const intro = document.getElementById("intro");
	if (!intro) return;
	// The Home button links to /?home, which skips the intro; the Vodious logo links to / and plays it
	if (/[?&]home(&|$)/.test(location.search)) {
		intro.remove();
		return;
	}

	const canvas = intro.querySelector("canvas");
	const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (!ctx || reduceMotion) {
		intro.remove();
		return;
	}

	// The stars are drawn by the WebGL galaxy shader on a canvas underneath; the 2D canvas only draws the black hole
	let gl = null;
	if (window.VodiousGL) {
		const glCanvas = document.createElement("canvas");
		intro.insertBefore(glCanvas, canvas);
		gl = window.VodiousGL.create(glCanvas, {
			palette: window.VodiousGL.paletteFor(),
			dpr: 1.5,
			auto: false,
			interactive: false,
			glow: 0.3,
		});
		if (!gl) glCanvas.remove();
	}

	// Milliseconds
	const TIMING = { galaxy: 2800, zoom: 2600, hold: 350, title: 2000, fade: 1000 };

	const S_DRIFT = 1.12; // slow drift in during the galaxy phase
	const S_MAX = 60; // final zoom factor, the black hole fills the screen long before this
	const TILT = 0.55; // squashes the galaxy disk so it reads as a tilted spiral
	const ROLL = -0.5; // rotates the whole galaxy on screen
	const HOLE = 0.075; // black hole radius, in units of the shorter screen side

	// Light to deep violet, plus one pink for variety
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

	let W = 0;
	let H = 0;
	let U = 0; // shorter screen side, the unit all star positions are measured in
	let cx = 0;
	let cy = 0;
	let buckets = [];

	function build() {
		buckets = Array.from({ length: PALETTE.length * 2 }, () => []);

		// Spiral galaxy
		const count = clamp(Math.round((W * H) / 260), 1400, 4200);
		const arms = 3;
		for (let i = 0; i < count; i++) {
			const r = HOLE * 1.35 + Math.pow(Math.random(), 1.7) * 2.1;
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

		// Distant background stars that don't orbit
		const far = Math.round((W * H) / 2800);
		for (let i = 0; i < far; i++) {
			const ci = Math.floor(Math.random() * 3);
			buckets[ci * 2].push({
				x: (Math.random() * 2 - 1) * (W / U),
				y: (Math.random() * 2 - 1) * (H / U),
				fixed: true,
			});
		}
	}

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		W = window.innerWidth;
		H = window.innerHeight;
		U = Math.min(W, H);
		cx = W / 2;
		cy = H / 2;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		build();
		if (gl) gl.resize();
	}

	const cosR = Math.cos(ROLL);
	const sinR = Math.sin(ROLL);

	function drawNebula(spin, s) {
		const blobs = [
			[-0.35, -0.1, 1.1, "124,58,237", 0.2],
			[0.4, 0.12, 0.9, "192,38,211", 0.14],
			[0.05, 0.35, 1.2, "76,29,149", 0.22],
			[-0.15, -0.3, 0.8, "168,85,247", 0.12],
		];
		const rot = ROLL + spin * 0.25;
		const cr = Math.cos(rot);
		const sr = Math.sin(rot);
		for (const [bx, by, br, rgb, alpha] of blobs) {
			const x = cx + (bx * cr - by * sr) * U * s;
			const y = cy + (bx * sr + by * cr) * U * s;
			const rad = br * U * s;
			const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
			g.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
			g.addColorStop(1, "rgba(" + rgb + ",0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);
		}
	}

	function drawStars(spin, s, sTrail) {
		ctx.lineCap = "round";
		const sizeScale = 1 + 0.12 * Math.sqrt(s);
		for (let b = 0; b < buckets.length; b++) {
			const list = buckets[b];
			if (!list.length) continue;
			ctx.strokeStyle = PALETTE[b >> 1];
			ctx.lineWidth = (b & 1 ? 1.9 : 1.0) * sizeScale;
			ctx.beginPath();
			for (let i = 0; i < list.length; i++) {
				const p = list[i];
				let X;
				let Y;
				if (p.fixed) {
					X = p.x;
					Y = p.y;
				} else {
					const ang = p.a + spin * p.k;
					const xr = Math.cos(ang) * p.r;
					const yr = Math.sin(ang) * p.r * TILT;
					X = xr * cosR - yr * sinR;
					Y = xr * sinR + yr * cosR;
				}
				const x = cx + X * U * s;
				const y = cy + Y * U * s;
				if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
				// Short radial streak behind each star while the camera is moving in
				ctx.moveTo(cx + X * U * sTrail, cy + Y * U * sTrail);
				ctx.lineTo(x + 0.01, y);
			}
			ctx.stroke();
		}
	}

	// Ring colours follow the galaxy colour chosen on the Design page
	const hexRgb = (h) => {
		const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
		return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [168, 85, 247];
	};
	const ringPalette = (window.VodiousGL && window.VodiousGL.paletteFor()) || [];
	const RAINBOW = !!window.VodiousGL && ringPalette.length === 0;
	const RING = (ringPalette.length >= 4
		? ringPalette
		: RAINBOW
			? ["#ffa0b4", "#ffe08a", "#9af0c0", "#9cc4ff"]
			: ["#c084fc", "#a855f7", "#e9d5ff", "#7c3aed"]
	).map(hexRgb);
	const rgba = (c, a, mix) => {
		// mix 0..1 pulls the colour toward white
		const m = mix || 0;
		return "rgba(" + c.map((v) => Math.round(v + (255 - v) * m)).join(",") + "," + a + ")";
	};

	// A black hole with a lensed accretion disk: the black shadow, a thin bright photon ring, the disk's light bent
	// over the top and under the bottom of the shadow, and the flat disk crossing in front. One side of the disk is
	// brighter (Doppler beaming).
	function drawBlackHole(s, cx, cy) {
		const R = HOLE * U * s;
		const glowC = RING[0];
		const midC = RING[1];
		const lightC = RING[2];
		const deepC = RING[3];
		const blur = (n) => Math.min(n, 46);

		ctx.save();
		ctx.globalCompositeOperation = "lighter";

		// Soft glow in the ring colour
		const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 5);
		glow.addColorStop(0, rgba(glowC, 0.42));
		glow.addColorStop(0.25, rgba(midC, 0.22));
		glow.addColorStop(0.6, rgba(deepC, 0.08));
		glow.addColorStop(1, rgba(deepC, 0));
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, W, H);

		ctx.translate(cx, cy);
		ctx.rotate(-0.2);

		// Lensed light of the far side of the disk: a bright ring hugging the shadow, thickest above and below
		for (let pass = 0; pass < 2; pass++) {
			ctx.beginPath();
			ctx.arc(0, 0, R * (pass ? 1.1 : 1.2), 0, Math.PI * 2);
			ctx.lineWidth = R * (pass ? 0.16 : 0.34);
			let strokeStyle;
			if (ctx.createConicGradient) {
				strokeStyle = ctx.createConicGradient(Math.PI * 0.5, 0, 0);
			} else {
				strokeStyle = ctx.createLinearGradient(-R, 0, R, 0);
			}
			strokeStyle.addColorStop(0, rgba(lightC, pass ? 0.95 : 0.5, 0.35));
			strokeStyle.addColorStop(0.25, rgba(midC, pass ? 0.55 : 0.3));
			strokeStyle.addColorStop(0.5, rgba(lightC, pass ? 0.5 : 0.25, 0.2));
			strokeStyle.addColorStop(0.75, rgba(deepC, pass ? 0.45 : 0.25));
			strokeStyle.addColorStop(1, rgba(lightC, pass ? 0.95 : 0.5, 0.35));
			ctx.strokeStyle = strokeStyle;
			ctx.shadowColor = rgba(midC, 0.9);
			ctx.shadowBlur = blur(R * 0.5);
			ctx.stroke();
		}
		ctx.shadowBlur = 0;

		// The shadow
		ctx.globalCompositeOperation = "source-over";
		ctx.beginPath();
		ctx.arc(0, 0, R, 0, Math.PI * 2);
		ctx.fillStyle = "#000";
		ctx.fill();

		// Photon ring: very thin and very bright, right at the edge of the shadow
		ctx.globalCompositeOperation = "lighter";
		ctx.beginPath();
		ctx.arc(0, 0, R * 1.015, 0, Math.PI * 2);
		ctx.lineWidth = Math.max(1.2, R * 0.03);
		ctx.strokeStyle = rgba(lightC, 0.95, 0.6);
		ctx.shadowColor = rgba(glowC, 1);
		ctx.shadowBlur = blur(R * 0.25);
		ctx.stroke();
		ctx.shadowBlur = 0;

		// The disk itself, seen nearly edge-on: a thin flat band crossing in front of the shadow
		const half = R * 3.1;
		const thick = R * 0.15;
		const band = ctx.createLinearGradient(-half, 0, half, 0);
		band.addColorStop(0, rgba(deepC, 0));
		band.addColorStop(0.15, rgba(deepC, 0.35));
		band.addColorStop(0.38, rgba(midC, 0.7));
		band.addColorStop(0.5, rgba(lightC, 1, 0.85));
		band.addColorStop(0.7, rgba(lightC, 1, 0.75));
		band.addColorStop(0.85, rgba(midC, 0.6));
		band.addColorStop(1, rgba(deepC, 0));
		for (let pass = 0; pass < 2; pass++) {
			const t = thick * (pass ? 0.35 : 1);
			ctx.beginPath();
			ctx.moveTo(-half, 0);
			ctx.quadraticCurveTo(0, -t * 2, half, 0);
			ctx.quadraticCurveTo(0, t * 2, -half, 0);
			ctx.fillStyle = band;
			ctx.shadowColor = rgba(midC, 0.9);
			ctx.shadowBlur = pass ? 0 : blur(R * 0.3);
			ctx.fill();
		}
		ctx.restore();
	}

	// The fall aims at the white band across the middle of the black hole
	const PIVOT_R = 0;
	function render(spin, s, sTrail, dt, zoomP) {
		const R0 = HOLE * U;
		const px = cx + Math.cos(-0.2) * R0 * PIVOT_R;
		const py = cy + Math.sin(-0.2) * R0 * PIVOT_R;
		const hx = px + (cx - px) * s;
		const hy = py + (cy - py) * s;
		ctx.globalCompositeOperation = "source-over";
		if (gl) {
			// Stars streak away from the point we are falling toward
			const k = zoomP * zoomP;
			gl.setFocal(0.5 + (px / W - 0.5) * k, 0.5 - (py / H - 0.5) * k);
			ctx.clearRect(0, 0, W, H);
			// Stars drift gently, then streak away from the black hole as the fall begins
			gl.speedUp = 1 + 10 * zoomP * zoomP;
			gl.advance(dt / 1000, 1.9 * Math.pow(zoomP, 1.6));
			ctx.globalCompositeOperation = "lighter";
		} else {
			ctx.fillStyle = "#04010a";
			ctx.fillRect(0, 0, W, H);
			ctx.globalCompositeOperation = "lighter";
			drawNebula(spin, s);
			drawStars(spin, s, sTrail);
		}
		drawBlackHole(s, hx, hy);
		ctx.globalCompositeOperation = "source-over";
	}

	// Sequence
	const title = intro.querySelector(".intro-title");
	// The title takes the colour chosen on the Design page; a wash of the same light floods the screen at the end of the fall
	const mixWhite = (c, m) => c.map((v) => Math.round(v + (255 - v) * m)).join(",");
	intro.style.setProperty("--ti-text", "rgb(" + mixWhite(RING[2], 0.55) + ")");
	intro.style.setProperty("--ti-glow", "rgb(" + RING[1].join(",") + ")");
	intro.style.setProperty("--ti-deep", "rgb(" + RING[3].join(",") + ")");
	intro.style.setProperty("--ti-hi", "rgb(" + mixWhite(RING[2], 0.7) + ")");
	intro.style.setProperty("--ti-mid", "rgb(" + RING[1].join(",") + ")");
	const flash = document.createElement("div");
	flash.className = "intro-flash";
	if (RAINBOW) {
		intro.classList.add("rainbow");
		flash.style.background = "linear-gradient(115deg, #ffc2cf, #ffe9a8 22%, #c4f5d8 44%, #b9d8ff 66%, #e2c8ff 88%)";
		if (title) title.dataset.text = title.textContent;
	}
	intro.insertBefore(flash, title);
	const ring = intro.querySelector(".intro-ring");
	const hint = intro.querySelector(".intro-skip");
	let raf = 0;
	let titleTimer = 0;
	let watchdog = 0;
	let finishing = false;
	let t0 = 0;
	let last = 0;
	let spin = 0;
	let sPrev = 1;

	const ZOOM_END = TIMING.galaxy + TIMING.zoom;
	// Milliseconds since the animation started (same clock as requestAnimationFrame)
	const elapsed = () => (t0 ? performance.now() - t0 : 0);

	function finish(fast) {
		if (finishing) return;
		finishing = true;
		cancelAnimationFrame(raf);
		clearTimeout(titleTimer);
		window.removeEventListener("pointerdown", onPointerDown);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("keydown", onGesture);
		window.removeEventListener("touchend", onGesture);
		window.removeEventListener("click", onGesture);
		clearTimeout(watchdog);
		window.removeEventListener("resize", resize);
		if (fast) intro.classList.add("skipped");
		intro.classList.add("leaving");
		setTimeout(() => {
			if (gl) gl.destroy();
			intro.remove();
		}, (fast ? 500 : TIMING.fade) + 150);
	}

	// Lets the page cut this intro short right away (the logo replays it, even while the last one is fading out)
	window.VodiousIntroStop = () => {
		finish(true);
		if (gl) {
			gl.destroy();
			gl = null;
		}
		intro.remove();
	};

	// Any click, tap or key press skips the intro
	function onGesture(e) {
		if (e && e.type === "keydown" && (e.metaKey || e.ctrlKey || e.altKey)) return;
		finish(true);
	}


	// Mouse presses count as user activation on pointerdown, touch and pen on pointerup
	function onPointerDown(e) {
		if (e.pointerType === "mouse") onGesture(e);
	}

	function onPointerUp(e) {
		if (e.pointerType !== "mouse") onGesture(e);
	}

	function showTitle() {
		ctx.globalCompositeOperation = "source-over";
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, W, H);
		intro.classList.add("titled");
		if (gl) gl.canvas.style.display = "none";
		flash.classList.add("out");
		flash.style.opacity = "0";
		if (title) title.classList.add("show");
		titleTimer = setTimeout(() => finish(false), TIMING.title);
	}

	function frame(now) {
		if (finishing) return;
		try {
			step(now);
		} catch (err) {
			// If drawing ever fails, leave the intro instead of freezing on it
			finish(true);
		}
	}

	function step(now) {
		if (finishing) return;
		if (!t0) {
			t0 = now;
			last = now;
		}
		const t = now - t0;
		const dt = Math.min(50, now - last);
		last = now;

		const zoomP = clamp((t - TIMING.galaxy) / TIMING.zoom, 0, 1);
		spin += dt * 0.00012 * (1 + 5 * zoomP * zoomP);

		let s;
		if (t < TIMING.galaxy) {
			s = 1 + (S_DRIFT - 1) * (t / TIMING.galaxy);
		} else {
			s = S_DRIFT * Math.pow(S_MAX / S_DRIFT, Math.pow(zoomP, 2.2));
		}
		const sTrail = Math.max(1, s - (s - sPrev) * 3);
		sPrev = s;

		if (t >= ZOOM_END + TIMING.hold) {
			showTitle();
			return;
		}
		const fl = clamp((zoomP - 0.7) / 0.28, 0, 1);
		flash.style.opacity = String(fl * fl * (3 - 2 * fl));
		render(spin, s, sTrail, dt, zoomP);
		raf = requestAnimationFrame(frame);
	}

	resize();
	window.addEventListener("resize", resize);
	window.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("pointerup", onPointerUp);
	// Fallbacks for browsers that report touches oddly (a scroll gesture cancels the pointer events)
	window.addEventListener("touchend", onGesture, { passive: true });
	window.addEventListener("click", onGesture);
	const skipBtn = intro.querySelector(".intro-skip-btn");
	// Safety net: whatever happens, the intro is gone a few seconds after it should have ended
	watchdog = setTimeout(() => finish(true), TIMING.galaxy + TIMING.zoom + TIMING.hold + TIMING.title + TIMING.fade + 3000);

	raf = requestAnimationFrame(frame);
})();
