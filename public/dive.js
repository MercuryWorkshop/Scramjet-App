"use strict";
// Home page: pressing Games dives into the black hole in the corner. The galaxy zooms in until the hole
// fills the screen, with a synthesized "fwoosh" that rises along with the zoom, and then the Games page
// comes back out of the black hole (galaxy.js and games.html handle that half).
(() => {
	const DURATION = 1750; // ms of zoom
	const VEIL_AT = 1450; // ms in, when the screen settles to pure black
	const TARGET = "games.html";

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let running = false;
	let audio = null;
	let veil = null;
	let timers = [];

	/* --------------------------------------------------------------- sound */

	// A whoosh made from filtered noise, a rising tone and a deep swell. Its sweeps use the same
	// easing as the zoom, so sound and picture accelerate together, then it cuts off as the screen goes black.
	function whoosh(seconds) {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		let c;
		try {
			c = new AC();
		} catch (err) {
			return null;
		}
		// The click that started the dive allows audio; resume() covers browsers that still create it suspended
		if (c.state === "suspended" && c.resume) c.resume().catch(() => {});

		const T = seconds;
		const t0 = c.currentTime + 0.02;
		const N = 96;
		const curve = (fn) => Float32Array.from({ length: N }, (_, i) => fn(i / (N - 1)));
		const rise = (u) => Math.pow(Math.min(u / 0.85, 1), 1.8); // same curve as galaxy.js: peaks as the hole covers the screen
		const level = (u) => rise(u) * (u > 0.85 ? Math.max(0, 1 - (u - 0.85) / 0.15) : 1);

		const master = c.createGain();
		master.gain.value = 0.75;
		const limiter = c.createDynamicsCompressor();
		limiter.threshold.value = -12;
		limiter.knee.value = 10;
		limiter.ratio.value = 6;
		limiter.attack.value = 0.003;
		limiter.release.value = 0.2;
		master.connect(limiter);
		limiter.connect(c.destination);

		const stop = t0 + T + 0.1;
		const sources = [];
		const start = (node) => {
			node.start(t0);
			node.stop(stop);
			sources.push(node);
		};

		// 1. The "fwoosh": noise through a band that sweeps up from a low rush to a high hiss
		const noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
		const data = noiseBuffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const noise = c.createBufferSource();
		noise.buffer = noiseBuffer;
		noise.loop = true;
		const band = c.createBiquadFilter();
		band.type = "bandpass";
		band.frequency.setValueCurveAtTime(curve((u) => 180 * Math.pow(7000 / 180, rise(u))), t0, T);
		band.Q.setValueCurveAtTime(curve((u) => 0.9 + 3.2 * rise(u)), t0, T);
		const noiseGain = c.createGain();
		noiseGain.gain.value = 0;
		noiseGain.gain.setValueCurveAtTime(curve((u) => 2.4 * level(u)), t0, T);
		noise.connect(band);
		let tail = band;
		// A swirl across the speakers that speeds up as the hole closes in
		if (c.createStereoPanner) {
			const pan = c.createStereoPanner();
			const swirl = c.createOscillator();
			swirl.frequency.setValueCurveAtTime(curve((u) => 0.6 + 7 * rise(u)), t0, T);
			const depth = c.createGain();
			depth.gain.value = 0.7;
			swirl.connect(depth);
			depth.connect(pan.pan);
			band.connect(pan);
			tail = pan;
			start(swirl);
		}
		tail.connect(noiseGain);
		noiseGain.connect(master);
		start(noise);

		// 2. A rising "suction" tone
		const saw = c.createOscillator();
		saw.type = "sawtooth";
		saw.frequency.setValueCurveAtTime(curve((u) => 70 * Math.pow(13, rise(u))), t0, T);
		const sawLow = c.createBiquadFilter();
		sawLow.type = "lowpass";
		sawLow.frequency.setValueCurveAtTime(curve((u) => 260 + 3000 * rise(u)), t0, T);
		const sawGain = c.createGain();
		sawGain.gain.value = 0;
		sawGain.gain.setValueCurveAtTime(curve((u) => 0.12 * level(u)), t0, T);
		saw.connect(sawLow);
		sawLow.connect(sawGain);
		sawGain.connect(master);
		start(saw);

		// 3. A deep swell underneath
		const sub = c.createOscillator();
		sub.frequency.setValueCurveAtTime(curve((u) => 45 + 70 * rise(u)), t0, T);
		const subGain = c.createGain();
		subGain.gain.value = 0;
		subGain.gain.setValueCurveAtTime(curve((u) => 0.34 * Math.pow(level(u), 1.2)), t0, T);
		sub.connect(subGain);
		subGain.connect(master);
		start(sub);

		// 4. A short low thump as the screen goes black
		const hit = t0 + T * 0.86;
		const thump = c.createOscillator();
		thump.frequency.setValueAtTime(130, hit);
		thump.frequency.exponentialRampToValueAtTime(36, hit + 0.28);
		const thumpGain = c.createGain();
		thumpGain.gain.setValueAtTime(0.0001, hit);
		thumpGain.gain.linearRampToValueAtTime(0.55, hit + 0.01);
		thumpGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.3);
		thump.connect(thumpGain);
		thumpGain.connect(master);
		thump.start(hit);
		thump.stop(hit + 0.4);

		return c;
	}

	function closeAudio() {
		if (!audio) return;
		const c = audio;
		audio = null;
		try {
			const done = c.close();
			if (done && done.catch) done.catch(() => {});
		} catch (err) {
			/* already closed */
		}
	}

	/* ---------------------------------------------------------- transition */

	function later(fn, ms) {
		timers.push(setTimeout(fn, ms));
	}

	function go(href, withDive) {
		if (withDive) {
			try {
				sessionStorage.setItem("vodious-dive", String(Date.now()));
			} catch (err) {
				/* private mode: the Games page just appears without the "coming out" animation */
			}
		}
		window.location.href = href;
	}

	function start(href) {
		if (running) return;
		running = true;

		const galaxy = window.VodiousGalaxy;
		if (reduceMotion || !galaxy || /^(image|grid|plain)$/.test(document.documentElement.dataset.bg || "")) {
			go(href, false);
			return;
		}

		document.body.classList.add("diving");
		audio = whoosh(DURATION / 1000);

		veil = document.createElement("div");
		veil.className = "dive-veil";
		document.body.appendChild(veil);
		later(() => veil && veil.classList.add("on"), VEIL_AT);

		galaxy.dive(DURATION).then(() => later(() => go(href, true), 120));
	}

	// Back to normal: used when the browser restores this page from its back/forward cache mid-dive
	function reset() {
		timers.forEach(clearTimeout);
		timers = [];
		running = false;
		document.body.classList.remove("diving");
		if (veil) veil.remove();
		veil = null;
		closeAudio();
		if (window.VodiousGalaxy) window.VodiousGalaxy.reset();
	}

	/* -------------------------------------------------------------- wiring */

	document.addEventListener("click", (event) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target.closest("a[href]");
		if (!link || link.target === "_blank" || link.getAttribute("href") !== TARGET) return;
		event.preventDefault();
		start(link.href);
	});

	window.addEventListener("pageshow", (event) => {
		if (event.persisted) reset();
	});
})();
