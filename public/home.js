// Home page behavior: clock, search engine pills, quick links, fun facts.
// Kept separate from index.js so the proxy logic is untouched.
(() => {
	const $ = (selector) => document.querySelector(selector);

	const store = {
		get(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* storage unavailable; the choice just won't persist */
			}
		},
	};

	/* The site is always in dark mode */
	const root = document.documentElement;
	root.dataset.theme = "dark";

	/* Clock and greeting */
	const clock = $("#clock");
	const hello = $("#hello");

	function tick() {
		const now = new Date();
		const hour = now.getHours();
		const part =
			hour < 5 ? "Good evening"
			: hour < 12 ? "Good morning"
			: hour < 18 ? "Good afternoon"
			: "Good evening";
		const date = now.toLocaleDateString([], {
			weekday: "long",
			month: "long",
			day: "numeric",
		});
		if (clock) {
			clock.textContent = now.toLocaleTimeString([], {
				hour: "numeric",
				minute: "2-digit",
			});
		}
		let who = "";
		try {
			who = (JSON.parse(localStorage.getItem("vodious-profile") || "{}").name || "").trim();
		} catch (err) {
			/* no saved profile */
		}
		if (hello) hello.textContent = part + (who ? ", " + who : "") + " - " + date;
	}

	tick();
	setInterval(tick, 10000);

	/* Search engine pills */
	const engines = {
		duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s" },
		google: { name: "Google", url: "https://www.google.com/search?q=%s" },
	};
	const engineInput = $("#sj-search-engine");
	const address = $("#sj-address");
	const form = $("#sj-form");
	const enginePills = document.querySelectorAll("[data-engine]");

	function setEngine(key) {
		const engine = engines[key] || engines.duckduckgo;
		const active = engines[key] ? key : "duckduckgo";
		if (engineInput) engineInput.value = engine.url;
		if (address) address.placeholder = "Search " + engine.name + " or type a URL";
		enginePills.forEach((pill) => {
			pill.setAttribute("aria-pressed", String(pill.dataset.engine === active));
		});
		store.set("vodious-engine", active);
	}

	setEngine(store.get("vodious-engine"));

	enginePills.forEach((pill) => {
		pill.addEventListener("click", () => setEngine(pill.dataset.engine));
	});

	/* Quick links: fill the address bar and submit through the normal proxy flow */
	document.querySelectorAll("[data-go]").forEach((button) => {
		button.addEventListener("click", () => {
			if (!address || !form) return;
			address.value = button.dataset.go;
			if (form.requestSubmit) {
				form.requestSubmit();
			} else {
				form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
			}
		});
	});

	/* Fun facts */
	const facts = [
		"Honey never spoils. Archaeologists have found 3,000-year-old honey that was still edible.",
		"Octopuses have three hearts, and two of them stop beating when they swim.",
		"Bananas are berries, but strawberries are not.",
		"A day on Venus is longer than a year on Venus.",
		"Wombats produce cube-shaped droppings.",
		"Sharks are older than trees. They have been around for over 400 million years.",
		"Sea otters sometimes hold hands while they sleep so they don't drift apart.",
		"The Eiffel Tower can grow about 15 centimeters taller in hot weather.",
	];
	const factText = $("#fact-text");
	const factButton = $("#fact-refresh");
	let factIndex = 0;

	if (factText && factButton) {
		factButton.addEventListener("click", () => {
			let next = factIndex;
			while (next === factIndex) {
				next = Math.floor(Math.random() * facts.length);
			}
			factIndex = next;
			factText.textContent = facts[next];
		});
	}
})();
