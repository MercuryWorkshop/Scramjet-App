"use strict";
// Profile: username, profile picture and banner. Shared by every page (nav icon) and the Profile page.
(() => {
	const KEY = "vodious-profile";
	const svg = (w, h, body) =>
		"data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '">' + body + "</svg>");

	/* ------------------------------------------------------------ presets */

	const disc = (c1, c2, glyph) =>
		svg(
			64, 64,
			'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>' + glyph
		);
	const AVATARS = [
		{ id: "planet", label: "Planet", src: disc("#7c3aed", "#1e1b4b", '<circle cx="32" cy="32" r="13" fill="#e9d5ff"/><ellipse cx="32" cy="33" rx="25" ry="7" fill="none" stroke="#c4b5fd" stroke-width="3" transform="rotate(-20 32 32)"/>') },
		{ id: "moon", label: "Moon", src: disc("#334155", "#0f172a", '<path d="M40 14a19 19 0 1 0 10 31A16 16 0 0 1 40 14z" fill="#f1f5f9"/>') },
		{ id: "star", label: "Star", src: disc("#f59e0b", "#b45309", '<path d="M32 10l6.5 14 15 1.6-11.3 10 3.3 15L32 42.5 18.5 50.6l3.3-15-11.3-10 15-1.6z" fill="#fff7d6"/>') },
		{ id: "rocket", label: "Rocket", src: disc("#ef4444", "#7f1d1d", '<path d="M32 9c8 6 11 16 9 28H23c-2-12 1-22 9-28z" fill="#fff"/><circle cx="32" cy="26" r="4.5" fill="#60a5fa"/><path d="M23 37l-7 9 9-2zM41 37l7 9-9-2z" fill="#fecaca"/><path d="M28 40h8l-4 12z" fill="#fbbf24"/>') },
		{ id: "ghost", label: "Ghost", src: disc("#6366f1", "#312e81", '<path d="M18 50V30a14 14 0 0 1 28 0v20l-5-4-4.5 4-4.5-4-4.5 4-4.5-4z" fill="#fff"/><circle cx="26.5" cy="30" r="2.6" fill="#1e1b4b"/><circle cx="37.5" cy="30" r="2.6" fill="#1e1b4b"/>') },
		{ id: "alien", label: "Alien", src: disc("#22c55e", "#14532d", '<path d="M32 12c13 0 19 10 17 20-2 10-9 18-17 18s-15-8-17-18c-2-10 4-20 17-20z" fill="#bbf7d0"/><ellipse cx="24" cy="31" rx="5" ry="8" fill="#052e16" transform="rotate(-18 24 31)"/><ellipse cx="40" cy="31" rx="5" ry="8" fill="#052e16" transform="rotate(18 40 31)"/>') },
		{ id: "comet", label: "Comet", src: disc("#0ea5e9", "#0c4a6e", '<path d="M14 46L40 24" stroke="#bae6fd" stroke-width="7" stroke-linecap="round" opacity=".45"/><path d="M20 50L42 30" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="43" cy="27" r="9" fill="#fff"/>') },
		{ id: "hole", label: "Black hole", src: disc("#581c87", "#09060f", '<circle cx="32" cy="32" r="20" fill="none" stroke="#e9b8ff" stroke-width="4"/><circle cx="32" cy="32" r="12" fill="#000"/>') },
	];

	const stars = (n, w, h, seed) => {
		let s = seed;
		const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
		let out = "";
		for (let i = 0; i < n; i++) out += '<circle cx="' + (r() * w).toFixed(0) + '" cy="' + (r() * h).toFixed(0) + '" r="' + (0.6 + r() * 1.6).toFixed(1) + '" fill="#fff" opacity="' + (0.35 + r() * 0.6).toFixed(2) + '"/>';
		return out;
	};
	const sky = (id, a, b, c) =>
		svg(1200, 300, '<defs><radialGradient id="g" cx="75%" cy="30%" r="90%"><stop offset="0" stop-color="' + a + '"/><stop offset=".5" stop-color="' + b + '"/><stop offset="1" stop-color="' + c + '"/></radialGradient></defs><rect width="1200" height="300" fill="url(#g)"/>' + stars(90, 1200, 300, id));
	const BANNERS = [
		{ id: "nebula", label: "Purple nebula", src: sky(11, "#8b3dff", "#2a0e5c", "#09060f") },
		{ id: "ocean", label: "Deep blue", src: sky(23, "#3b82f6", "#0b2a66", "#050b17") },
		{ id: "forest", label: "Green glow", src: sky(37, "#34d399", "#0b4a33", "#04100b") },
		{ id: "sunset", label: "Sunset", src: svg(1200, 300, '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1561"/><stop offset=".55" stop-color="#d9467a"/><stop offset="1" stop-color="#ffb35c"/></linearGradient></defs><rect width="1200" height="300" fill="url(#g)"/><circle cx="900" cy="250" r="70" fill="#ffe3a3" opacity=".9"/>' + stars(40, 1200, 150, 5)) },
		{ id: "grid", label: "Green grid", src: svg(1200, 300, '<defs><pattern id="p" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#22c55e" stroke-opacity=".5"/></pattern></defs><rect width="1200" height="300" fill="#04110a"/><rect width="1200" height="300" fill="url(#p)"/>') },
		{ id: "dark", label: "Midnight", src: svg(1200, 300, '<rect width="1200" height="300" fill="#0d0b14"/>' + stars(60, 1200, 300, 77)) },
	];

	/* ------------------------------------------------------------ storage */

	const DEFAULT = { name: "", avatar: { type: "none" }, banner: { type: "preset", id: "nebula" } };
	function read() {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || "{}");
			return v && typeof v === "object" ? v : {};
		} catch (err) {
			return {};
		}
	}
	let state = Object.assign({}, DEFAULT, read());
	function save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(state));
			return true;
		} catch (err) {
			return false;
		}
	}

	const avatarSrc = () => {
		const a = state.avatar || {};
		if (a.type === "image" && a.data) return a.data;
		if (a.type === "preset") {
			const p = AVATARS.find((x) => x.id === a.id);
			if (p) return p.src;
		}
		return "";
	};
	const bannerSrc = () => {
		const b = state.banner || {};
		if (b.type === "image" && b.data) return b.data;
		const p = BANNERS.find((x) => x.id === (b.id || "nebula")) || BANNERS[0];
		return p.src;
	};

	/* ------------------------------------------------------------ applying */

	// Small profile picture in the menu, when one is chosen
	function applyNav() {
		const src = avatarSrc();
		document.querySelectorAll(".nav-link[data-view='profile'], .nav-link[href='profile.html']").forEach((a) => {
			let img = a.querySelector(".nav-avatar");
			const icon = a.querySelector("svg");
			if (src) {
				if (!img) {
					img = document.createElement("img");
					img.className = "nav-avatar";
					img.alt = "";
					a.insertBefore(img, a.firstChild);
				}
				img.src = src;
				if (icon) icon.style.display = "none";
			} else {
				if (img) img.remove();
				if (icon) icon.style.display = "";
			}
		});
	}

	/* ------------------------------------------------------------ Profile page */

	function say(message) {
		const el = document.getElementById("profile-status");
		if (el) el.textContent = message;
	}

	function buildUi() {
		const nameIn = document.getElementById("profile-name-in");
		if (!nameIn || nameIn.dataset.ready) return;
		nameIn.dataset.ready = "1";
		const prevBanner = document.getElementById("profile-banner");
		const prevAvatar = document.getElementById("profile-avatar");
		const prevName = document.getElementById("profile-name");
		const avGrid = document.getElementById("avatar-options");
		const bnGrid = document.getElementById("banner-options");
		const avFile = document.getElementById("avatar-file");
		const bnFile = document.getElementById("banner-file");
		const avTiles = [];
		const bnTiles = [];

		const initial = () => (state.name.trim() ? state.name.trim().charAt(0).toUpperCase() : "?");
		const sync = () => {
			prevBanner.style.backgroundImage = 'url("' + bannerSrc() + '")';
			const a = avatarSrc();
			prevAvatar.style.backgroundImage = a ? 'url("' + a + '")' : "";
			prevAvatar.textContent = a ? "" : initial();
			prevName.textContent = state.name.trim() || "Your username";
			prevName.classList.toggle("empty", !state.name.trim());
			avTiles.forEach((t) => t.setAttribute("aria-checked", String(state.avatar.type === "preset" && state.avatar.id === t.dataset.id)));
			bnTiles.forEach((t) => t.setAttribute("aria-checked", String(state.banner.type === "preset" && state.banner.id === t.dataset.id)));
			document.getElementById("avatar-clear").hidden = state.avatar.type === "none";
			applyNav();
		};

		nameIn.value = state.name;
		nameIn.addEventListener("input", () => {
			state.name = nameIn.value.slice(0, 20);
			save();
			sync();
		});

		const tile = (grid, list, item, square, onPick) => {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "pick" + (square ? " pick-sq" : " pick-wide");
			b.setAttribute("role", "radio");
			b.dataset.id = item.id;
			b.title = item.label;
			b.setAttribute("aria-label", item.label);
			b.style.backgroundImage = 'url("' + item.src + '")';
			b.addEventListener("click", onPick);
			grid.appendChild(b);
			list.push(b);
		};
		AVATARS.forEach((p) =>
			tile(avGrid, avTiles, p, true, () => {
				state.avatar = { type: "preset", id: p.id };
				save();
				sync();
			})
		);
		BANNERS.forEach((p) =>
			tile(bnGrid, bnTiles, p, false, () => {
				state.banner = { type: "preset", id: p.id };
				save();
				sync();
			})
		);

		const upload = (input, w, h, field, label) =>
			input.addEventListener("change", async () => {
				const f = input.files && input.files[0];
				input.value = "";
				if (!f) return;
				try {
					const data = await window.VodiousImg.resize(f, w, h, "cover", "image/jpeg");
					const before = state[field];
					state[field] = { type: "image", data };
					if (!save()) {
						state[field] = before;
						return say("That image is too big to save in this browser. Try a smaller one.");
					}
					sync();
					say("Your " + label + " is saved.");
				} catch (err) {
					say(err.message);
				}
			});
		upload(avFile, 256, 256, "avatar", "profile picture");
		upload(bnFile, 1200, 300, "banner", "banner");
		document.getElementById("avatar-pick").addEventListener("click", () => avFile.click());
		document.getElementById("banner-pick").addEventListener("click", () => bnFile.click());
		document.getElementById("avatar-clear").addEventListener("click", () => {
			state.avatar = { type: "none" };
			save();
			sync();
			say("Profile picture removed.");
		});
		document.getElementById("profile-reset").addEventListener("click", () => {
			state = JSON.parse(JSON.stringify(DEFAULT));
			nameIn.value = "";
			save();
			sync();
			say("Profile reset.");
		});
		sync();
	}

	window.VodiousProfile = { applyNav, buildUi, get name() { return state.name.trim(); } };

	function start() {
		applyNav();
		buildUi();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
