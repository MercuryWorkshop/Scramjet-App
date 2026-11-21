"use strict";
// Intro animation: purple galaxy -> fall into the black hole -> title pops -> fade to the home page.
// Sound is synthesized live with the Web Audio API (no audio files).
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
			glow: 0.45,
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
	const RING = (ringPalette.length >= 4 ? ringPalette : ["#c084fc", "#a855f7", "#e9d5ff", "#7c3aed"]).map(hexRgb);
	const rgba = (c, a, mix) => {
		// mix 0..1 pulls the colour toward white
		const m = mix || 0;
		return "rgba(" + c.map((v) => Math.round(v + (255 - v) * m)).join(",") + "," + a + ")";
	};

	// A black hole with a lensed accretion disk: the black shadow, a thin bright photon ring, the disk's light bent
	// over the top and under the bottom of the shadow, and the flat disk crossing in front. One side of the disk is
	// brighter (Doppler beaming).
	function drawBlackHole(s) {
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
		const thick = R * 0.11;
		const band = ctx.createLinearGradient(-half, 0, half, 0);
		band.addColorStop(0, rgba(deepC, 0));
		band.addColorStop(0.15, rgba(deepC, 0.35));
		band.addColorStop(0.38, rgba(midC, 0.7));
		band.addColorStop(0.5, rgba(lightC, 0.8, 0.3));
		band.addColorStop(0.7, rgba(lightC, 1, 0.55));
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

	function render(spin, s, sTrail, dt, zoomP) {
		ctx.globalCompositeOperation = "source-over";
		if (gl) {
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
		drawBlackHole(s);
		ctx.globalCompositeOperation = "source-over";
	}

	// Sequence
	const title = intro.querySelector(".intro-title");
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

	/* ---------------------------------------------------------------------
	 * Sound. Everything is synthesized with the Web Audio API.
	 *
	 * Browsers keep a new AudioContext "suspended" until the visitor has
	 * interacted with the page. If sound is blocked, the intro still plays
	 * silently, the hint changes to say so, and the first click or key press
	 * turns sound on without skipping. Sounds are triggered from the
	 * animation's own clock, so they stay in sync even when sound starts late.
	 * ------------------------------------------------------------------ */
	const AudioCtor = window.AudioContext || window.webkitAudioContext;
	const HINT_SKIP = hint ? hint.textContent : "";
	const HINT_SOUND = "Click or press a key for sound, then again to skip";
	let audio = null;

	function setHint(soundLocked) {
		if (hint) hint.textContent = soundLocked ? HINT_SOUND : HINT_SKIP;
	}

	function makeNoise(c, brown) {
		const length = Math.floor(c.sampleRate * 3);
		const buffer = c.createBuffer(1, length, c.sampleRate);
		const data = buffer.getChannelData(0);
		let lastOut = 0;
		for (let i = 0; i < length; i++) {
			const white = Math.random() * 2 - 1;
			if (brown) {
				lastOut = (lastOut + 0.02 * white) / 1.02;
				data[i] = lastOut * 3.5;
			} else {
				data[i] = white;
			}
		}
		return buffer;
	}

	function noiseSource(c, buffer, loop) {
		const source = c.createBufferSource();
		source.buffer = buffer;
		source.loop = loop;
		return source;
	}

	function createAudio() {
		if (!AudioCtor) return null;
		try {
			const c = new AudioCtor();
			const master = c.createGain();
			master.gain.value = 0.6;
			// Gentle limiter so the impact can't clip
			const limiter = c.createDynamicsCompressor();
			limiter.threshold.value = -14;
			limiter.knee.value = 12;
			limiter.ratio.value = 6;
			limiter.attack.value = 0.003;
			limiter.release.value = 0.25;
			master.connect(limiter);
			limiter.connect(c.destination);
			return {
				ctx: c,
				master,
				white: makeNoise(c, false),
				brown: makeNoise(c, true),
				drone: false,
				whoosh: false,
				impact: false,
				stopped: false,
				unlockTried: false,
			};
		} catch (err) {
			return null;
		}
	}

	// Low cosmic sub-bass drone: slow beating sines plus soft "space wind".
	// It swells and rises in pitch as the camera falls in, then cuts out
	// just before the impact.
	function startDrone(t) {
		const { ctx: c, master, brown } = audio;
		const now = c.currentTime;
		const toEnd = Math.max(0.1, (ZOOM_END - t) / 1000);
		const end = now + toEnd;
		const progress = clamp(t / ZOOM_END, 0, 1);
		const level = 0.2;
		const rise = Math.min(t >= TIMING.galaxy ? 0.6 : 1.6, toEnd - 0.05);

		const filter = c.createBiquadFilter();
		filter.type = "lowpass";
		filter.Q.value = 0.8;
		filter.frequency.setValueAtTime(130 + 190 * progress, now);
		filter.frequency.linearRampToValueAtTime(320, end);

		const lfo = c.createOscillator();
		const lfoDepth = c.createGain();
		lfo.frequency.value = 0.11;
		lfoDepth.gain.value = 22;
		lfo.connect(lfoDepth);
		lfoDepth.connect(filter.frequency);

		const g = c.createGain();
		g.gain.setValueAtTime(0.0001, now);
		g.gain.exponentialRampToValueAtTime(level, now + rise);
		g.gain.linearRampToValueAtTime(level * 1.3, end);
		g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
		filter.connect(g);
		g.connect(master);

		const voices = [
			["sine", 41, 0.5],
			["sine", 41.7, 0.5], // beats against the first voice
			["triangle", 82.4, 0.12],
		];
		const sources = [lfo];
		for (const [type, freq, amp] of voices) {
			const osc = c.createOscillator();
			const vg = c.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq * (1 + 0.35 * progress), now);
			osc.frequency.linearRampToValueAtTime(freq * 1.35, end);
			vg.gain.value = amp;
			osc.connect(vg);
			vg.connect(filter);
			sources.push(osc);
		}

		const wind = noiseSource(c, brown, true);
		const windLow = c.createBiquadFilter();
		const windGain = c.createGain();
		windLow.type = "lowpass";
		windLow.frequency.value = 260;
		windGain.gain.value = 0.15;
		wind.connect(windLow);
		windLow.connect(windGain);
		windGain.connect(g);
		sources.push(wind);

		for (const s of sources) {
			s.start(now);
			s.stop(end + 0.4);
		}
	}

	// Rising suction sweep. Its pitch, brightness and loudness follow the same
	// curve as the camera zoom, so it peaks as the screen goes black, then is
	// sucked into silence.
	function startWhoosh(t) {
		const { ctx: c, master, white } = audio;
		const p0 = clamp((t - TIMING.galaxy) / TIMING.zoom, 0, 1);
		const remaining = ((1 - p0) * TIMING.zoom) / 1000;
		if (remaining < 0.2) return;

		const now = c.currentTime;
		const end = now + remaining;
		const N = 64;
		const ease = new Float32Array(N);
		for (let i = 0; i < N; i++) {
			const p = p0 + (1 - p0) * (i / (N - 1));
			ease[i] = Math.pow(p, 2.2); // matches the camera's zoom easing
		}
		const curve = (fn) => Float32Array.from(ease, fn);

		// Airy noise band that sweeps upward
		const noise = noiseSource(c, white, true);
		const band = c.createBiquadFilter();
		band.type = "bandpass";
		band.Q.value = 1.6;
		band.frequency.setValueCurveAtTime(
			curve((v) => 140 * Math.pow(6200 / 140, v)),
			now,
			remaining
		);
		const noiseGain = c.createGain();
		noiseGain.gain.value = 0;
		noiseGain.gain.setValueCurveAtTime(curve((v) => 0.9 * v), now, remaining);
		noiseGain.gain.setValueAtTime(0.9, end + 0.005);
		noiseGain.gain.linearRampToValueAtTime(0, end + 0.16);

		// The sound swirls from ear to ear, faster and faster
		let swirl = null;
		if (c.createStereoPanner) {
			const pan = c.createStereoPanner();
			const panLfo = c.createOscillator();
			const panDepth = c.createGain();
			panLfo.frequency.setValueCurveAtTime(
				curve((v) => 0.25 * Math.pow(12.8, v)),
				now,
				remaining
			);
			panDepth.gain.value = 0.75;
			panLfo.connect(panDepth);
			panDepth.connect(pan.pan);
			swirl = { pan, panLfo };
		}
		noise.connect(band);
		if (swirl) {
			band.connect(swirl.pan);
			swirl.pan.connect(noiseGain);
		} else {
			band.connect(noiseGain);
		}
		noiseGain.connect(master);

		// Rising pitched layer underneath
		const saw = c.createOscillator();
		saw.type = "sawtooth";
		saw.frequency.setValueCurveAtTime(curve((v) => 55 * Math.pow(20, v)), now, remaining);
		const sawLow = c.createBiquadFilter();
		sawLow.type = "lowpass";
		sawLow.Q.value = 2.5;
		sawLow.frequency.setValueCurveAtTime(
			curve((v) => 200 * Math.pow(13, v)),
			now,
			remaining
		);
		const sawGain = c.createGain();
		sawGain.gain.value = 0;
		sawGain.gain.setValueCurveAtTime(curve((v) => 0.17 * v), now, remaining);
		sawGain.gain.setValueAtTime(0.17, end + 0.005);
		sawGain.gain.linearRampToValueAtTime(0, end + 0.16);
		saw.connect(sawLow);
		sawLow.connect(sawGain);
		sawGain.connect(master);

		const sources = [noise, saw];
		if (swirl) sources.push(swirl.panLfo);
		for (const s of sources) {
			s.start(now);
			s.stop(end + 0.3);
		}
	}

	// Deep cinematic bass impact with a soft sci-fi shimmer on top.
	function playImpact() {
		const { ctx: c, master, white, brown } = audio;
		const t = c.currentTime + 0.03;

		const tone = (type, f0, f1, fall, peak, decay, lowpass) => {
			const osc = c.createOscillator();
			const g = c.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(f0, t);
			osc.frequency.exponentialRampToValueAtTime(f1, t + fall);
			g.gain.setValueAtTime(0.0001, t);
			g.gain.linearRampToValueAtTime(peak, t + 0.008);
			g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
			let tail = osc;
			if (lowpass) {
				const lp = c.createBiquadFilter();
				lp.type = "lowpass";
				lp.frequency.value = lowpass;
				osc.connect(lp);
				tail = lp;
			}
			tail.connect(g);
			g.connect(master);
			osc.start(t);
			osc.stop(t + decay + 0.1);
		};

		// Sub boom and body
		tone("sine", 130, 34, 0.9, 1.0, 2.8);
		tone("triangle", 72, 46, 0.6, 0.55, 1.6, 260);

		// Short crack at the front of the hit
		const crack = noiseSource(c, white, false);
		const crackLow = c.createBiquadFilter();
		crackLow.type = "lowpass";
		crackLow.frequency.setValueAtTime(3200, t);
		crackLow.frequency.exponentialRampToValueAtTime(140, t + 0.35);
		const crackGain = c.createGain();
		crackGain.gain.setValueAtTime(0.0001, t);
		crackGain.gain.linearRampToValueAtTime(0.9, t + 0.004);
		crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
		crack.connect(crackLow);
		crackLow.connect(crackGain);
		crackGain.connect(master);
		crack.start(t, Math.random() * 1.5);
		crack.stop(t + 0.5);

		// Low rumble tail
		const rumble = noiseSource(c, brown, true);
		const rumbleLow = c.createBiquadFilter();
		rumbleLow.type = "lowpass";
		rumbleLow.frequency.value = 150;
		const rumbleGain = c.createGain();
		rumbleGain.gain.setValueAtTime(0.0001, t);
		rumbleGain.gain.linearRampToValueAtTime(0.7, t + 0.05);
		rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
		rumble.connect(rumbleLow);
		rumbleLow.connect(rumbleGain);
		rumbleGain.connect(master);
		rumble.start(t);
		rumble.stop(t + 3.4);

		// Shimmer: glassy partials, a bright upward glide and a high air swell,
		// all through a soft echo
		const bus = c.createGain();
		bus.gain.value = 0.9;
		bus.connect(master);
		const echo = c.createDelay(1);
		echo.delayTime.value = 0.23;
		const echoFeedback = c.createGain();
		echoFeedback.gain.value = 0.38;
		const echoTone = c.createBiquadFilter();
		echoTone.type = "lowpass";
		echoTone.frequency.value = 4800;
		const echoWet = c.createGain();
		echoWet.gain.value = 0.5;
		bus.connect(echo);
		echo.connect(echoTone);
		echoTone.connect(echoFeedback);
		echoFeedback.connect(echo);
		echoTone.connect(echoWet);
		echoWet.connect(master);

		const partials = [
			[1046.5, 0.03],
			[1568.0, 0.026],
			[2093.0, 0.02],
			[2637.0, 0.016],
			[3520.0, 0.012],
		];
		partials.forEach(([freq, amp], i) => {
			const start = t + 0.04 + i * 0.07;
			const osc = c.createOscillator();
			const g = c.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			osc.detune.value = (Math.random() * 2 - 1) * 8;
			const vibrato = c.createOscillator();
			const vibratoDepth = c.createGain();
			vibrato.frequency.value = 5.3;
			vibratoDepth.gain.value = freq * 0.003;
			vibrato.connect(vibratoDepth);
			vibratoDepth.connect(osc.frequency);
			g.gain.setValueAtTime(0.0001, start);
			g.gain.exponentialRampToValueAtTime(amp, start + 0.45);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
			osc.connect(g);
			if (c.createStereoPanner) {
				const pan = c.createStereoPanner();
				pan.pan.value = (Math.random() * 2 - 1) * 0.6;
				g.connect(pan);
				pan.connect(bus);
			} else {
				g.connect(bus);
			}
			osc.start(start);
			vibrato.start(start);
			osc.stop(t + 3.8);
			vibrato.stop(t + 3.8);
		});

		const glide = c.createOscillator();
		const glideGain = c.createGain();
		glide.type = "sine";
		glide.frequency.setValueAtTime(380, t);
		glide.frequency.exponentialRampToValueAtTime(3400, t + 0.7);
		glideGain.gain.setValueAtTime(0.0001, t);
		glideGain.gain.exponentialRampToValueAtTime(0.03, t + 0.25);
		glideGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
		glide.connect(glideGain);
		glideGain.connect(bus);
		glide.start(t);
		glide.stop(t + 1.2);

		const air = noiseSource(c, white, true);
		const airHigh = c.createBiquadFilter();
		airHigh.type = "highpass";
		airHigh.frequency.value = 7000;
		const airGain = c.createGain();
		airGain.gain.setValueAtTime(0.0001, t);
		airGain.gain.exponentialRampToValueAtTime(0.018, t + 0.35);
		airGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
		air.connect(airHigh);
		airHigh.connect(airGain);
		airGain.connect(bus);
		air.start(t);
		air.stop(t + 2.5);
	}

	// Start whichever sounds are due. Safe to call every frame.
	function updateAudio(t) {
		if (!audio || audio.stopped || audio.ctx.state !== "running") return;
		if (!audio.drone) {
			audio.drone = true;
			if (t < ZOOM_END - 200) startDrone(t);
		}
		if (!audio.whoosh && t >= TIMING.galaxy && t < ZOOM_END) {
			audio.whoosh = true;
			startWhoosh(t);
		}
	}

	// Fade everything out and release the audio hardware
	function stopAudio(seconds) {
		if (!audio || audio.stopped) return;
		audio.stopped = true;
		const c = audio.ctx;
		try {
			const now = c.currentTime;
			const gain = audio.master.gain;
			gain.cancelScheduledValues(now);
			gain.setValueAtTime(gain.value, now);
			gain.linearRampToValueAtTime(0, now + seconds);
		} catch (err) {
			/* nothing to fade */
		}
		setTimeout(() => {
			try {
				c.close().catch(() => {});
			} catch (err) {
				/* already closed */
			}
		}, (seconds + 0.3) * 1000);
	}

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
		stopAudio(fast ? 0.35 : TIMING.fade / 1000);
		if (fast) intro.classList.add("skipped");
		intro.classList.add("leaving");
		setTimeout(() => {
			if (gl) gl.destroy();
			intro.remove();
		}, (fast ? 500 : TIMING.fade) + 150);
	}

	// While sound is blocked and there is still sound to come, the first click
	// or key press only turns sound on. Every other gesture skips the intro.
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
		if (title) title.classList.add("show");
		if (ring) ring.classList.add("show");
		if (audio && !audio.stopped && !audio.impact && audio.ctx.state === "running") {
			audio.impact = true;
			playImpact();
		}
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

		updateAudio(t);

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

	audio = createAudio();
	if (audio) {
		audio.ctx.addEventListener("statechange", () => {
			if (audio && !audio.stopped && audio.ctx.state === "running") {
				setHint(false);
				updateAudio(elapsed());
			}
		});
		// Works straight away where autoplay is allowed; otherwise stays suspended
		audio.ctx.resume().catch(() => {});

	}

	raf = requestAnimationFrame(frame);
})();
