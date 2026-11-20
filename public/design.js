"use strict";
// Backgrounds: applies the chosen look on every page, and wires up the Design page.
(() => {
	const KEY = "vodious-design";
	const root = document.documentElement;

	const OPTIONS = [
		{ id: "purple", label: "Purple galaxy", galaxy: true, thumb: "radial-gradient(circle at 70% 30%, #a855f7, #3b0f7a 45%, #09060f 75%)" },
		{ id: "blue", label: "Blue galaxy", galaxy: true, thumb: "radial-gradient(circle at 70% 30%, #5aa9ff, #123a8a 45%, #060a14 75%)" },
		{ id: "green", label: "Green galaxy", galaxy: true, thumb: "radial-gradient(circle at 70% 30%, #5be39a, #0f5c3a 45%, #05100a 75%)" },
		{ id: "red", label: "Red galaxy", galaxy: true, thumb: "radial-gradient(circle at 70% 30%, #ff7a6b, #7a1d1d 45%, #120606 75%)" },
		{ id: "grid", label: "Green grid", thumb: "linear-gradient(rgba(34,197,94,.55) 1px, transparent 1px) 0 0/12px 12px, linear-gradient(90deg, rgba(34,197,94,.55) 1px, transparent 1px) 0 0/12px 12px, #04110a" },
		{ id: "plain", label: "Plain dark", thumb: "#0b0b10" },
		{ id: "image", label: "My image", thumb: "" },
	];

	function read() {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || "{}");
			return v && typeof v === "object" ? v : {};
		} catch (err) {
			return {};
		}
	}
	let state = Object.assign({ bg: "purple", image: "" }, read());
	if (!OPTIONS.some((o) => o.id === state.bg) || (state.bg === "image" && !state.image)) state.bg = "purple";

	function save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(state));
			return true;
		} catch (err) {
			return false; // storage full or blocked
		}
	}

	/* ------------------------------------------------------------- applying */

	function layer() {
		let el = document.getElementById("bg-layer");
		if (!el) {
			el = document.createElement("div");
			el.id = "bg-layer";
			el.setAttribute("aria-hidden", "true");
			document.body.insertBefore(el, document.body.firstChild);
		}
		return el;
	}

	function apply() {
		root.dataset.bg = state.bg;
		const el = layer();
		if (state.bg === "image" && state.image) {
			const veil = root.dataset.theme === "light" ? "rgba(247,244,255,0.72), rgba(247,244,255,0.72)" : "rgba(9,6,15,0.35), rgba(9,6,15,0.55)";
			el.style.backgroundImage = "linear-gradient(" + veil + '), url("' + state.image + '")';
		} else {
			el.style.backgroundImage = "";
		}
	}

	/* ----------------------------------------------------------- image helper */

	// Reads an image file and returns a smaller JPEG/PNG data URL. mode "cover" crops to exactly w x h; "fit" keeps the shape.
	function resizeImage(file, w, h, mode, type) {
		return new Promise((resolve, reject) => {
			if (!file || !/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				let cw = w;
				let ch = h;
				if (mode === "fit") {
					const k = Math.min(1, w / img.width, h / img.height);
					cw = Math.max(1, Math.round(img.width * k));
					ch = Math.max(1, Math.round(img.height * k));
				}
				const c = document.createElement("canvas");
				c.width = cw;
				c.height = ch;
				const ctx = c.getContext("2d");
				if (mode === "cover") {
					const k = Math.max(cw / img.width, ch / img.height);
					const sw = cw / k;
					const sh = ch / k;
					ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, cw, ch);
				} else {
					ctx.drawImage(img, 0, 0, cw, ch);
				}
				resolve(c.toDataURL(type || "image/jpeg", 0.85));
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("That file could not be read as an image."));
			};
			img.src = url;
		});
	}
	window.VodiousImg = { resize: resizeImage };

	/* ---------------------------------------------------------------- Design page */

	function say(message) {
		const el = document.getElementById("design-status");
		if (el) el.textContent = message;
	}

	function buildUi() {
		const grid = document.getElementById("bg-options");
		if (!grid || grid.dataset.ready) return;
		grid.dataset.ready = "1";
		const file = document.getElementById("bg-file");
		const remove = document.getElementById("bg-remove");
		const tiles = [];

		const sync = () => {
			tiles.forEach((t) => t.setAttribute("aria-checked", String(t.dataset.bg === state.bg)));
			const imgTile = tiles.find((t) => t.dataset.bg === "image");
			if (imgTile) {
				const thumb = imgTile.querySelector(".thumb");
				thumb.style.backgroundImage = state.image ? 'url("' + state.image + '")' : "";
				imgTile.querySelector(".tile-label").textContent = state.image ? "My image" : "Upload an image";
			}
			if (remove) remove.hidden = !state.image;
		};

		for (const o of OPTIONS) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "bg-tile";
			b.setAttribute("role", "radio");
			b.dataset.bg = o.id;
			const thumb = document.createElement("span");
			thumb.className = "thumb";
			if (o.thumb) thumb.style.background = o.thumb;
			else thumb.classList.add("thumb-upload");
			const label = document.createElement("span");
			label.className = "tile-label";
			label.textContent = o.label;
			b.append(thumb, label);
			b.addEventListener("click", () => {
				if (o.id === "image" && !state.image) {
					if (file) file.click();
					return;
				}
				state.bg = o.id;
				save();
				apply();
				sync();
				say(o.label + " is on.");
			});
			grid.appendChild(b);
			tiles.push(b);
		}

		if (file)
			file.addEventListener("change", async () => {
				const f = file.files && file.files[0];
				file.value = "";
				if (!f) return;
				try {
					const data = await resizeImage(f, 1920, 1080, "fit", "image/jpeg");
					state.image = data;
					state.bg = "image";
					if (!save()) {
						state.image = "";
						state.bg = "purple";
						apply();
						sync();
						return say("That image is too big to save in this browser. Try a smaller one.");
					}
					apply();
					sync();
					say("Your image is now the background.");
				} catch (err) {
					say(err.message);
				}
			});
		const pick = document.getElementById("bg-pick");
		if (pick) pick.addEventListener("click", () => file && file.click());
		if (remove)
			remove.addEventListener("click", () => {
				state.image = "";
				if (state.bg === "image") state.bg = "purple";
				save();
				apply();
				sync();
				say("Image removed.");
			});
		sync();
	}

	window.VodiousDesign = { apply, buildUi };
	new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

	function start() {
		apply();
		buildUi();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
