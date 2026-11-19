"use strict";
// Tab cloak: changes the browser tab's name and icon, and opens the site inside an about:blank or blob: page.
// Loaded on every page so the chosen disguise is applied everywhere; the Settings page adds the controls.
(() => {
	const KEY = "vodious-cloak";

	// Small icons drawn here (no files needed). They are simple look-alikes, not the real logos.
	const icon = (body) =>
		"data:image/svg+xml," +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' + body + "</svg>");
	const PRESETS = {
		vodious: {
			label: "Vodious",
			title: "Vodious",
			icon: icon(
				'<circle cx="16" cy="16" r="15" fill="#2b0f5c"/><circle cx="16" cy="16" r="10" fill="none" stroke="#c993ff" stroke-width="2.5"/><circle cx="16" cy="16" r="6" fill="#000"/>'
			),
			go: "",
		},
		google: {
			label: "Google",
			title: "Google",
			icon: icon(
				'<rect width="32" height="32" rx="6" fill="#fff"/><text x="16" y="24.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="25" fill="#4285f4">G</text>'
			),
			go: "https://www.google.com/",
		},
		newtab: {
			label: "New Tab",
			title: "New Tab",
			icon: icon('<rect x="5" y="3" width="22" height="26" rx="3" fill="#dadce0"/><rect x="9" y="9" width="14" height="2.5" rx="1" fill="#9aa0a6"/><rect x="9" y="15" width="14" height="2.5" rx="1" fill="#9aa0a6"/>'),
			go: "https://www.google.com/",
		},
		classroom: {
			label: "Google Classroom",
			title: "Classroom",
			icon: icon(
				'<rect x="2" y="5" width="28" height="22" rx="3" fill="#0f9d58"/><circle cx="16" cy="14" r="3.6" fill="#fff"/><path d="M9 24c0-4 3-6 7-6s7 2 7 6z" fill="#fff"/>'
			),
			go: "https://classroom.google.com/",
		},
		docs: {
			label: "Google Docs",
			title: "Untitled document - Google Docs",
			icon: icon(
				'<path d="M7 2h13l6 6v22H7z" fill="#4285f4"/><path d="M20 2l6 6h-6z" fill="#a1c2fa"/><rect x="11" y="14" width="11" height="2" fill="#fff"/><rect x="11" y="18" width="11" height="2" fill="#fff"/><rect x="11" y="22" width="7" height="2" fill="#fff"/>'
			),
			go: "https://docs.google.com/document/",
		},
	};

	/* ------------------------------------------------------------ storage */

	function read() {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || "{}");
			return v && typeof v === "object" ? v : {};
		} catch (err) {
			return {};
		}
	}
	let state = Object.assign({ preset: "vodious", customTitle: "", customIcon: "", redirect: "none" }, read());
	function save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(state));
		} catch (err) {
			/* private mode: the choice lasts until the page closes */
		}
	}

	function current() {
		const p = PRESETS[state.preset] || PRESETS.vodious;
		return {
			title: state.customTitle.trim() || p.title,
			icon: state.customIcon.trim() || p.icon,
		};
	}

	/* ----------------------------------------------------------- disguise */

	function apply() {
		const d = current();
		document.title = d.title;
		document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
		const link = document.createElement("link");
		link.rel = "icon";
		link.href = d.icon;
		document.head.appendChild(link);
	}

	/* -------------------------------------------------------- open cloaked */

	const esc = (s) =>
		String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

	function pageHtml(url) {
		const d = current();
		return (
			'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
			"<title>" + esc(d.title) + '</title><link rel="icon" href="' + esc(d.icon) + '">' +
			"<style>html,body{margin:0;height:100%;background:#09060f;overflow:hidden}iframe{border:0;display:block;width:100%;height:100%}</style></head><body>" +
			'<iframe src="' + esc(url) + '" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe></body></html>'
		);
	}

	// The address of this site as it is open right now (without any #section)
	function siteUrl() {
		const here = location.href.split("#")[0];
		return /^(https?|file):/.test(here) ? new URL("./", here).href : here;
	}

	function say(message) {
		const el = document.getElementById("cloak-status");
		if (el) el.textContent = message;
	}

	function afterOpen() {
		const target = state.redirect !== "none" && PRESETS[state.redirect] ? PRESETS[state.redirect].go : "";
		if (target) setTimeout(() => location.replace(target), 250);
	}

	function openBlank() {
		const w = window.open("about:blank", "_blank");
		if (!w) return say("The browser blocked the new tab. Allow pop-ups for this site and try again.");
		w.document.open();
		w.document.write(pageHtml(siteUrl()));
		w.document.close();
		say("Opened in about:blank.");
		afterOpen();
	}

	function openBlob() {
		const url = URL.createObjectURL(new Blob([pageHtml(siteUrl())], { type: "text/html" }));
		const w = window.open(url, "_blank");
		if (!w) return say("The browser blocked the new tab. Allow pop-ups for this site and try again.");
		say("Opened as a blob: page.");
		afterOpen();
	}

	/* ----------------------------------------------------------- settings UI */

	function buildUi() {
		const box = document.getElementById("cloak-presets");
		if (!box || box.dataset.ready) return;
		box.dataset.ready = "1";
		const buttons = [];
		for (const [id, p] of Object.entries(PRESETS)) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "preset";
			b.setAttribute("role", "radio");
			b.dataset.preset = id;
			const img = document.createElement("img");
			img.src = p.icon;
			img.alt = "";
			img.width = 20;
			img.height = 20;
			const span = document.createElement("span");
			span.textContent = p.label;
			b.append(img, span);
			b.addEventListener("click", () => {
				state.preset = id;
				state.customTitle = "";
				state.customIcon = "";
				if (titleIn) titleIn.value = "";
				if (iconIn) iconIn.value = "";
				save();
				apply();
				sync();
			});
			box.appendChild(b);
			buttons.push(b);
		}
		const titleIn = document.getElementById("cloak-title");
		const iconIn = document.getElementById("cloak-icon");
		const redirect = document.getElementById("cloak-redirect");
		const sync = () => {
			buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.preset === state.preset && !state.customTitle && !state.customIcon)));
			const d = current();
			const prev = document.getElementById("cloak-preview");
			if (prev) {
				prev.querySelector("img").src = d.icon;
				prev.querySelector("span").textContent = d.title;
			}
		};
		if (titleIn) {
			titleIn.value = state.customTitle;
			titleIn.addEventListener("input", () => {
				state.customTitle = titleIn.value;
				save();
				apply();
				sync();
			});
		}
		if (iconIn) {
			iconIn.value = state.customIcon;
			iconIn.addEventListener("change", () => {
				state.customIcon = iconIn.value.trim();
				save();
				apply();
				sync();
			});
		}
		if (redirect) {
			redirect.value = state.redirect;
			redirect.addEventListener("change", () => {
				state.redirect = redirect.value;
				save();
			});
		}
		const reset = document.getElementById("cloak-reset");
		if (reset)
			reset.addEventListener("click", () => {
				state = { preset: "vodious", customTitle: "", customIcon: "", redirect: "none" };
				if (titleIn) titleIn.value = "";
				if (iconIn) iconIn.value = "";
				if (redirect) redirect.value = "none";
				save();
				apply();
				sync();
			});
		const a = document.getElementById("open-blank");
		const bl = document.getElementById("open-blob");
		if (a) a.addEventListener("click", openBlank);
		if (bl) bl.addEventListener("click", openBlob);
		sync();
	}

	window.VodiousCloak = { apply, buildUi, PRESETS };

	// Settings may be a page of its own or a view inside the single-file build; build the controls when the DOM is ready
	function start() {
		apply();
		buildUi();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
