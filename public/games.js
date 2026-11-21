"use strict";
// Games page: lists the games in games.json (A-Z, with search) and plays each one inside this site,
// in an iframe in the page's own player, instead of opening an about:blank tab.
//
// games.json is an array of entries like:
//   { "name": "Game name", "url": "https://example.com/game.html", "image": "optional-thumbnail.png" }
(() => {
	const $ = (selector) => document.querySelector(selector);

	const list = $("#games-list");
	const search = $("#games-search");
	const letters = $("#games-letters");
	const status = $("#games-status");
	const count = $("#games-count");

	const player = $("#player");
	const stage = $("#player-stage");
	const loading = $("#player-loading");
	const titleEl = $("#player-title");
	const btnFullscreen = $("#player-fullscreen");
	const fullscreenLabel = $("#player-fullscreen-label");
	const btnReload = $("#player-reload");
	const altBtn = $("#player-alt");
	const tabBtn = $("#player-tab");
	const btnClose = $("#player-close");
	// The page behind the player is made inert while a game is open, so Tab can't wander into it
	const behind = [$(".top"), $(".games-page"), $(".foot")].filter(Boolean);

	const tabButtons = [...document.querySelectorAll("#games-tabs [data-tab]")];
	let tab = "site"; // "site": hosted on this site, "mirror": from the jsdmirror CDN, "static": from staticdelivr, "gn": gn-math, "axe": Axe Guys games
	let games = [];
	let sections = [];
	let current = null; // the game being played
	let opener = null; // the tile to give focus back to
	let frame = null;
	let frameBlob = ""; // object URL of the current frame, when it was loaded that way
	let mode = 0; // how the game is loaded: 0 inline, 1 from a blob, 2 straight from its address
	let token = 0; // bumped on every launch and close, so stale loads are ignored
	let cached = { url: "", html: "" }; // the current game's HTML, so Reload doesn't download it again

	/* ---------------------------------------------------------------- data */

	// Only http(s) and relative URLs are allowed (never javascript: or data:)
	function safeUrl(value) {
		try {
			const url = new URL(value, location.href);
			return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
		} catch (err) {
			return "";
		}
	}

	function normalize(entry) {
		if (!entry || typeof entry !== "object") return null;
		const name = typeof entry.name === "string" ? entry.name.trim() : "";
		const url = typeof entry.url === "string" ? safeUrl(entry.url.trim()) : "";
		if (!name || !url) return null;
		const image = typeof entry.image === "string" ? safeUrl(entry.image.trim()) : "";
		// Links relative to this site are games hosted on this site; full http(s) links live on other hosts
		const local = !/^[a-z][a-z0-9+.-]*:/i.test(entry.url.trim());
		const src = entry.s === "static" || entry.s === "gn" || entry.s === "axe" ? entry.s : local ? "site" : "mirror";
		return { name, url, image, local, src, mode: entry.mode === 1 || entry.mode === 2 ? entry.mode : 0 };
	}

	async function loadGames() {
		try {
			const res = await fetch("games.json", { cache: "no-cache" });
			if (!res.ok) throw new Error("HTTP " + res.status);
			const data = await res.json();
			const raw = Array.isArray(data) ? data : Array.isArray(data.games) ? data.games : [];
			games = raw
				.map(normalize)
				.filter(Boolean)
				.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
		} catch (err) {
			status.textContent = /Missing file/.test((err && err.message) || "")
				? err.message + ". If you opened vodious.svg straight from your computer, upload all the files to a website and open it from there (browsers block local files from loading each other)."
				: "Couldn't load games.json. Open this page from your web server rather than as a local file.";
			return;
		}
		if (!games.length) {
			status.textContent = "No games in games.json yet.";
			return;
		}
		render();
	}

	/* ---------------------------------------------------------------- list */

	function badge(game) {
		const el = document.createElement("span");
		el.className = "game-badge";
		el.textContent = game.name.charAt(0).toUpperCase();
		return el;
	}

	function tile(game, index) {
		const el = document.createElement("button");
		el.type = "button";
		el.className = "game";
		el.dataset.index = String(index);

		let lead;
		if (game.image) {
			lead = document.createElement("img");
			lead.className = "game-thumb";
			lead.alt = "";
			lead.loading = "lazy";
			lead.src = game.image;
			lead.addEventListener("error", () => lead.replaceWith(badge(game)), { once: true });
		} else {
			lead = badge(game);
		}

		const name = document.createElement("span");
		name.className = "game-name";
		name.textContent = game.name;
		el.append(lead, name);
		return el;
	}

	function render() {
		list.textContent = "";
		letters.textContent = "";
		sections = [];

		const groups = new Map();
		games.forEach((game, index) => {
			const key = /^[a-z]/i.test(game.name) ? game.name.charAt(0).toUpperCase() : "#";
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(index);
		});
		const keys = [...groups.keys()].sort((a, b) => (a === "#" ? -1 : b === "#" ? 1 : a < b ? -1 : 1));

		for (const key of keys) {
			const section = document.createElement("section");
			section.className = "letter-group";
			section.id = "letter-" + (key === "#" ? "num" : key);

			const heading = document.createElement("h2");
			heading.textContent = key;
			const grid = document.createElement("div");
			grid.className = "game-grid";

			const tiles = groups.get(key).map((i) => {
				const el = tile(games[i], i);
				grid.appendChild(el);
				return { el, lc: games[i].name.toLowerCase(), src: games[i].src };
			});
			section.append(heading, grid);
			list.appendChild(section);

			const chip = document.createElement("a");
			chip.className = "pill";
			chip.href = "#" + section.id;
			chip.textContent = key;
			letters.appendChild(chip);

			sections.push({ el: section, chip, tiles });
		}
		applyFilter();
	}

	function applyFilter() {
		const query = search.value.trim().toLowerCase();
		const inTab = (g) => g.src === tab;
		let shown = 0;
		for (const s of sections) {
			let any = false;
			for (const t of s.tiles) {
				const hit = (!query || t.lc.includes(query)) && t.src === tab;
				t.el.hidden = !hit;
				if (hit) {
					any = true;
					shown++;
				}
			}
			s.el.hidden = !any;
			s.chip.hidden = !any;
		}
		const total = games.filter(inTab).length;
		count.textContent = query
			? shown + " of " + total + (total === 1 ? " game" : " games")
			: total + (total === 1 ? " game" : " games");
		status.textContent = shown ? "" : query ? "No games match “" + search.value.trim() + "”." : "No games in this tab.";
		tabButtons.forEach((b) => {
			const badge = b.querySelector(".tab-count");
			if (badge) {
				const n = games.filter((g) => g.src === b.dataset.tab).length;
				badge.textContent = n ? n.toLocaleString() : "";
			}
		});
	}

	/* ---------------------------------------------------------------- tabs */

	function selectTab(name) {
		tab = name;
		tabButtons.forEach((b) => {
			const on = b.dataset.tab === name;
			b.setAttribute("aria-selected", on ? "true" : "false");
			b.tabIndex = on ? 0 : -1;
		});
		search.value = "";
		applyFilter();
		window.scrollTo(0, 0);
	}

	/* -------------------------------------------------------------- player */

	function showLoading(message, withRetry) {
		loading.textContent = "";
		const text = document.createElement("span");
		text.textContent = message;
		loading.appendChild(text);
		if (withRetry) {
			const retry = document.createElement("button");
			retry.type = "button";
			retry.className = "player-btn";
			retry.textContent = "Try again";
			retry.addEventListener("click", launch);
			loading.appendChild(retry);
			retry.focus();
		}
		loading.hidden = false;
	}

	function removeFrame() {
		// Removing the iframe stops the game's scripts and audio
		if (frame) frame.remove();
		frame = null;
		if (frameBlob) URL.revokeObjectURL(frameBlob);
		frameBlob = "";
	}

	function focusGame() {
		try {
			if (frame && frame.contentWindow) frame.contentWindow.focus();
		} catch (err) {
			/* cross-origin frame: nothing to focus */
		}
	}

	// Games that load their own files with relative paths still find them, because the
	// page is given a <base> pointing at the folder the game came from
	function withBase(html, url) {
		if (/<base\s/i.test(html)) return html;
		const base = '<base href="' + url.slice(0, url.lastIndexOf("/") + 1) + '">';
		if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
		if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + "<head>" + base + "</head>");
		return base + html;
	}

	function mountFrame(source) {
		removeFrame();
		const f = document.createElement("iframe");
		f.className = "player-frame";
		f.title = current.name;
		f.setAttribute("allow", "autoplay; fullscreen; gamepad; clipboard-write; accelerometer; gyroscope");
		f.setAttribute("allowfullscreen", "");
		f.addEventListener(
			"load",
			() => {
				loading.hidden = true;
				focusGame();
			},
			{ once: true }
		);
		f.addEventListener("load", () => window.VodiousCloak && window.VodiousCloak.attachKeys(f.contentWindow));
		if (source.srcdoc !== undefined) f.srcdoc = source.srcdoc;
		else if (source.blob !== undefined) {
			frameBlob = URL.createObjectURL(new Blob([source.blob], { type: "text/html" }));
			f.src = frameBlob;
		} else f.src = source.src;
		stage.appendChild(f);
		frame = f;
	}

	// (Re)starts the current game from scratch
	async function launch() {
		if (!current) return;
		const mine = ++token;
		const game = current;
		removeFrame();
		showLoading("Loading " + game.name + "…", false);

		altBtn.title = "Loading method " + (mode + 1) + " of 3 - click to try another";
		if (mode === 2) {
			mountFrame({ src: game.url });
			return;
		}
		let html = cached.url === game.url ? cached.html : null;
		if (html === null) {
			try {
				const res = await fetch(game.url);
				if (mine !== token) return;
				if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { http: true });
				html = await res.text();
				if (mine !== token) return;
				cached = { url: game.url, html };
			} catch (err) {
				if (mine !== token) return;
				if (err && err.http) {
					showLoading("Couldn't load " + game.name + " (" + err.message + ").", true);
				} else {
					// The host doesn't allow reading the file from this page, so let the frame load it directly
					mountFrame({ src: game.url });
				}
				return;
			}
		}
		if (mine !== token) return;
		const prepared = withBase(html, game.url);
		mountFrame(mode === 1 ? { blob: prepared } : { srcdoc: prepared });
	}

	// "Another way": cycles through the ways of loading a game, for games that show a black screen in the first
	function tryAnotherWay() {
		mode = (mode + 1) % 3;
		launch();
	}

	// Opens the game on its own page, like the old about:blank trick
	function openInTab() {
		if (!current) return;
		let target = current.url;
		if (cached.url === current.url && cached.html) {
			target = URL.createObjectURL(new Blob([withBase(cached.html, current.url)], { type: "text/html" }));
			setTimeout(() => URL.revokeObjectURL(target), 120000);
		}
		window.open(target, "_blank");
	}

	function openGame(game, tile) {
		current = game;
		mode = game.mode || 0;
		opener = tile;
		titleEl.textContent = game.name;
		player.hidden = false;
		document.body.classList.add("playing");
		behind.forEach((el) => (el.inert = true));
		btnClose.focus();
		launch();
	}

	function closeGame() {
		if (player.hidden) return;
		token++;
		leaveFullscreen();
		removeFrame();
		player.hidden = true;
		document.body.classList.remove("playing");
		behind.forEach((el) => (el.inert = false));
		current = null;
		if (opener && document.contains(opener)) opener.focus();
		opener = null;
	}

	/* ---------------------------------------------------------- fullscreen */

	const fullscreenAvailable = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
	const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

	function leaveFullscreen() {
		if (!fullscreenElement()) return;
		const exit = document.exitFullscreen || document.webkitExitFullscreen;
		try {
			const result = exit.call(document);
			if (result && result.catch) result.catch(() => {});
		} catch (err) {
			/* already out */
		}
	}

	async function toggleFullscreen() {
		if (fullscreenElement()) {
			leaveFullscreen();
			return;
		}
		// The stage (not the whole player) goes fullscreen, so the game gets the entire screen
		const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
		if (!request) return;
		try {
			await request.call(stage);
		} catch (err) {
			/* the browser refused; the game still fills the player */
		}
	}

	function syncFullscreen() {
		const on = fullscreenElement() === stage;
		btnFullscreen.setAttribute("aria-pressed", String(on));
		btnFullscreen.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
		fullscreenLabel.textContent = on ? "Exit fullscreen" : "Fullscreen";
		focusGame();
	}

	/* -------------------------------------------------------------- wiring */

	list.addEventListener("click", (event) => {
		const button = event.target.closest(".game");
		if (!button) return;
		const game = games[Number(button.dataset.index)];
		if (game) openGame(game, button);
	});

	search.addEventListener("input", applyFilter);
	btnReload.addEventListener("click", launch);
	altBtn.addEventListener("click", tryAnotherWay);
	tabBtn.addEventListener("click", openInTab);
	btnClose.addEventListener("click", closeGame);

	if (fullscreenAvailable) {
		btnFullscreen.addEventListener("click", toggleFullscreen);
		document.addEventListener("fullscreenchange", syncFullscreen);
		document.addEventListener("webkitfullscreenchange", syncFullscreen);
	} else {
		btnFullscreen.hidden = true; // e.g. iPhone Safari; the player already fills the screen
	}

	// Escape closes the game, unless it is being used to leave fullscreen
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !player.hidden && !fullscreenElement()) closeGame();
	});

	tabButtons.forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
	loadGames();
})();
