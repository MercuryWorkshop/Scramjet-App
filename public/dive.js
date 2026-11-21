"use strict";
// Home page: pressing Games rushes through the stars (warp speed), fades to black, and then the Games page
// comes back out of the stars (galaxy.js and games.html handle that half). No sound.
(() => {
	const DURATION = 1750; // ms of zoom
	const VEIL_AT = 1450; // ms in, when the screen settles to pure black
	const TARGET = "games.html";

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	let running = false;
	let veil = null;
	let timers = [];

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
