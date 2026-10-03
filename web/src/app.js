// Seedcraft web tool: user interface. Everything the user types is shown as
// text (textContent), never as HTML. Nothing is stored (no localStorage):
// closing the page forgets everything.
"use strict";

(() => {
	const S = SeedcraftSequences;
	const SETS = SEEDCRAFT_SETS;
	const FORMAT_VERSION = document.body.dataset.formatVersion;
	const NS = "http://www.w3.org/2000/svg";
	const $ = (id) => document.getElementById(id);

	// ---- state -------------------------------------------------------
	const st = {
		lang: (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en",
		screen: "home",
		make: { step: 1, seed: "", k: 4, setId: "beads", things: null, edited: false, pin: "" },
		result: null,
		read: { step: 1, setId: "beads", things: null, edited: false, taps: [], typing: false, text: "", pin: "", out: null, error: "" },
	};
	const T = () => SEEDCRAFT_TEXT[st.lang];

	// ---- tiny DOM helpers --------------------------------------------
	function h(tag, props, ...children) {
		const e = document.createElement(tag);
		for (const [k, v] of Object.entries(props || {})) {
			if (v === undefined || v === null || v === false) continue;
			if (k === "class") e.className = v;
			else if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
			else if (k === "text") e.textContent = v;
			else e.setAttribute(k, v);
		}
		for (const c of children.flat()) if (c !== null && c !== undefined && c !== false)
			e.append(c instanceof Node ? c : document.createTextNode(String(c)));
		return e;
	}
	function svg(tag, attrs, ...children) {
		const e = document.createElementNS(NS, tag);
		for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined) e.setAttribute(k, v);
		for (const c of children.flat()) if (c) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
		return e;
	}

	// ---- things ------------------------------------------------------
	const setById = (id) => SETS.find((s) => s.id === id);
	function presetThings(setId, n) {
		return setById(setId).things.slice(0, n).map((t) => ({ emoji: t.emoji || "", symbol: t.symbol || "", colour: t.colour || "", brick: !!t.brick, name: t[st.lang] }));
	}
	function ensureThings(part, n) {
		if (!part.things || (!part.edited && part.things.length !== n)) part.things = presetThings(part.setId, n);
		while (part.things.length < n) {
			const used = new Set(part.things.map((x) => x.symbol));
			part.things.push({ emoji: "", symbol: SEEDCRAFT_SYMBOLS.find((s) => !used.has(s)) || "", colour: "#cccccc", name: "" });
		}
		if (part.things.length > n) part.things = part.things.slice(0, n);
	}
	const lightColour = (hex) => {
		const v = parseInt((hex || "#ffffff").slice(1), 16);
		return ((v >> 16) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 > 150;
	};

	// One bead (or brick) drawn into an SVG group, centred on (x, y).
	function bead(thing, x, y, r, opts = {}) {
		const g = svg("g");
		if (thing.brick) {
			const w = r * 2, hgt = r * 1.5;
			g.append(svg("rect", { x: x - r, y: y - hgt / 2, width: w, height: hgt, rx: 4, fill: thing.colour || "#ddd", stroke: "rgba(0,0,0,.35)" }));
			for (const dx of [-r / 2, r / 2]) g.append(svg("rect", { x: x + dx - r / 4, y: y - hgt / 2 - r / 3, width: r / 2, height: r / 3, rx: 2, fill: thing.colour || "#ddd", stroke: "rgba(0,0,0,.35)" }));
		} else {
			const fill = thing.colour || (opts.dark ? "#3a332c" : "#ffffff");
			g.append(svg("circle", { cx: x, cy: y, r, fill, stroke: opts.legend ? "#f28c28" : "rgba(0,0,0,.3)", "stroke-width": opts.legend ? 3 : 1.2 }));
			if (thing.colour && !thing.emoji && !thing.symbol) g.append(svg("circle", { cx: x - r * 0.35, cy: y - r * 0.35, r: r * 0.22, fill: "rgba(255,255,255,.45)" }));
		}
		if (thing.emoji) g.append(svg("text", { x, y: y + r * 0.36, "text-anchor": "middle", "font-size": r * 1.05 }, thing.emoji));
		else if (thing.symbol) {
			// a symbol in black or white, whichever stands out on the colour
			const ink = lightColour(thing.colour) ? "#111111" : "#ffffff";
			g.append(svg("text", { x, y: y + r * 0.34, "text-anchor": "middle", "font-size": r * 0.95, "font-weight": 700,
				fill: ink, "font-family": "Menlo, Consolas, 'DejaVu Sans', sans-serif" }, thing.symbol + "\uFE0E"));
		}
		if (opts.legend && thing.brick) g.append(svg("rect", { x: x - r - 3, y: y - r, width: 2 * r + 6, height: 2 * r, rx: 6, fill: "none", stroke: "#f28c28", "stroke-width": 3 }));
		return g;
	}
	const darkScreen = () => matchMedia("(prefers-color-scheme: dark)").matches;
	function beadIcon(thing, size = 34, paper = false) {
		const s = svg("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
		s.append(bead(thing, size / 2, size / 2 + (thing.brick ? 2 : 0), size / 2 - 3, { dark: !paper && darkScreen() }));
		return s;
	}

	// The whole string: beads on a thread that snakes row by row.
	function stringSvg(things, sequence, nLegend, opts = {}) {
		const perRow = opts.perRow || 8, cell = 58, r = 21, rowH = opts.paper ? 66 : 74, pad = 66;
		const n = sequence.length, rows = Math.max(1, Math.ceil(n / perRow));
		const W = pad * 2 + (perRow - 1) * cell, H = 40 + (rows - 1) * rowH + (opts.paper ? 44 : 60);
		const pos = (i) => {
			const row = Math.floor(i / perRow), col = i % perRow;
			return [pad + (row % 2 ? perRow - 1 - col : col) * cell, 34 + row * rowH];
		};
		const root = svg("svg", { class: "string", viewBox: `0 0 ${W} ${H}`, role: "img" });
		if (n === 0) return root;
		// thread
		const [sx, sy] = pos(0);
		let d = `M${sx - 30},${sy}`;
		for (let i = 0; i < n; i++) {
			const [x, y] = pos(i);
			if (i > 0 && Math.floor(i / perRow) !== Math.floor((i - 1) / perRow)) {
				const [px] = pos(i - 1), right = Math.floor((i - 1) / perRow) % 2 === 0;
				d += ` L${px + (right ? 18 : -18)},${y - rowH} A${rowH / 2},${rowH / 2} 0 0 ${right ? 1 : 0} ${x + (right ? 18 : -18)},${y}`;
			}
			d += ` L${x},${y}`;
		}
		const [ex, ey] = pos(n - 1), lastRight = Math.floor((n - 1) / perRow) % 2 === 0;
		d += ` L${ex + (lastRight ? 30 : -30)},${ey}`;
		root.append(svg("path", { class: "thread", d }));
		// start (clasp) and end
		root.append(svg("text", { x: sx - 34, y: sy + 7, "text-anchor": "middle", "font-size": 20 }, "🔒"));
		root.append(svg("text", { class: "tag", x: sx - 34, y: sy + 30, "text-anchor": "middle" }, T().clasp));
		root.append(svg("circle", { class: "knot", cx: ex + (lastRight ? 32 : -32), cy: ey, r: 6 }));
		root.append(svg("text", { class: "tag", x: ex + (lastRight ? 32 : -32), y: ey + 26, "text-anchor": "middle" }, T().end));
		// beads and numbers
		const dark = !opts.paper && darkScreen();
		sequence.forEach((idx, i) => {
			const [x, y] = pos(i);
			const g = bead(things[idx], x, y, r, { legend: i < nLegend, dark });
			g.append(svg("title", {}, `${i + 1}: ${things[idx].name}`));
			// on paper, each number sits in a little box to tick off
			if (opts.paper) root.append(svg("rect", { class: "tick", x: x - 13, y: y + r + 3, width: 26, height: 16, rx: 4 }));
			root.append(g, svg("text", { class: "n" + (i < nLegend ? " leg" : ""), x, y: y + r + 15, "text-anchor": "middle" }, i + 1));
		});
		return root;
	}

	// PINs: letters and digits, case-insensitive, shown in upper case
	const cleanPin = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
	// A random PIN for the undecided: 8 characters from 32 that are hard to
	// mix up on paper (no 0/O, no 1/I), 40 bits. 256 % 32 == 0, so no bias.
	const PIN_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
	const randomPin = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => PIN_ALPHABET[b & 31]).join("");
	// "🎲" button next to a PIN input: fills it and asks to write it down apart
	function randomPinButton(input, set) {
		const t = T();
		const note = h("div", { class: "note hidden", text: t.pinWriteDown });
		const btn = h("button", { class: "btn ghost", on: { click: () => {
			input.value = randomPin(); set(input.value); note.classList.remove("hidden");
		} } }, t.pinRandom);
		return [btn, note];
	}

	// ---- shell -------------------------------------------------------
	function shell() {
		const t = T();
		document.documentElement.lang = st.lang;
		$("warn").textContent = t.warnTest;
		$("online").textContent = t.warnOnline;
		$("tagline").textContent = t.subtitle;
		$("lang").textContent = "🌐 " + t.langName;
		$("about").textContent = t.aboutTitle;
	}
	const online = () => $("online").classList.toggle("hidden", !navigator.onLine);
	addEventListener("online", online);
	addEventListener("offline", online);
	$("lang").addEventListener("click", () => {
		st.lang = T().langSwitch;
		for (const part of [st.make, st.read]) if (!part.edited) part.things = null;
		st.result = null;
		render();
	});
	$("logo").addEventListener("click", () => go("home"));
	$("about").addEventListener("click", () => go("about"));
	function go(screen) { st.screen = screen; render(); scrollTo(0, 0); }

	function render() {
		shell();
		online();
		const app = $("app");
		app.replaceChildren(({ home, make: makeScreen, read: readScreen, about, print: printSheet })[st.screen]());
	}

	function steps(labels, current) {
		return h("div", { class: "steps" }, labels.map((l, i) =>
			h("div", { class: i + 1 === current ? "on" : (i + 1 < current ? "done" : "") }, `${i + 1} · ${l}`)));
	}
	const errorBox = (msg) => msg ? h("div", { class: "error", role: "alert" }, msg) : null;

	// ---- home --------------------------------------------------------
	function home() {
		const t = T();
		return h("div", {},
			h("div", { class: "card" },
				h("h2", { text: t.howTitle }),
				h("div", { class: "how" },
					h("div", {}, h("div", { class: "big" }, "🌱"), h("b", { text: t.how1 }), h("span", { text: t.how1b })),
					h("div", {}, h("div", { class: "big" }, "🔴🐱⭐🧱"), h("b", { text: t.how2 }), h("span", { text: t.how2b })),
					h("div", {}, h("div", { class: "big" }, "🧵"), h("b", { text: t.how3 }), h("span", { text: t.how3b }))),
				h("div", { class: "carriers" }, t.carriers)),
			h("div", { class: "choices" },
				h("button", { class: "choice", on: { click: () => { st.make.step = 1; go("make"); } } },
					h("div", { class: "big" }, "🧵"), h("b", { text: t.makeCard }), h("span", { text: t.makeCardB })),
				h("button", { class: "choice", on: { click: () => { st.read.step = 1; go("read"); } } },
					h("div", { class: "big" }, "🔍"), h("b", { text: t.readCard }), h("span", { text: t.readCardB }))));
	}

	// ---- shared: picking the things ----------------------------------
	function thingsEditor(part, n, onChange) {
		const t = T();
		ensureThings(part, n);
		const editor = h("div", { class: "things" });
		const dup = h("div", { class: "error hidden" }, t.dupWarn);
		const refreshDup = () => {
			const names = part.things.map((x) => x.name.trim()).filter((x) => x);
			dup.classList.toggle("hidden", new Set(names).size === names.length);
		};
		part.things.forEach((thing, i) => {
			const icon = h("span", {}, beadIcon(thing));
			const redraw = () => { icon.replaceChildren(beadIcon(thing)); refreshDup(); onChange && onChange(); };
			editor.append(h("div", { class: "thing" },
				h("span", { class: "num" }, i),
				icon,
				h("input", { class: "emoji", value: thing.emoji || thing.symbol, "aria-label": t.thingEmoji, title: t.thingEmoji, maxlength: 8,
					on: { input: (e) => { const v = e.target.value.trim(); if (thing.colour && !thing.emoji && thing.symbol) thing.symbol = v; else thing.emoji = v; part.edited = true; redraw(); } } }),
				h("input", { type: "color", value: thing.colour || "#ffffff", "aria-label": t.thingColour, title: t.thingColour,
					on: { input: (e) => { thing.colour = e.target.value; part.edited = true; redraw(); } } }),
				h("input", { class: "name", value: thing.name, "aria-label": t.thingName, placeholder: t.thingName,
					on: { input: (e) => { thing.name = e.target.value; part.edited = true; refreshDup(); onChange && onChange(); } } })));
		});
		refreshDup();
		return [editor, dup];
	}
	function setPicker(part, n, rerender) {
		return h("div", { class: "sets" }, SETS.map((s) =>
			h("button", { class: "set" + (s.id === part.setId && !part.edited ? " on" : ""),
				on: { click: () => { part.setId = s.id; part.edited = false; part.things = presetThings(s.id, n); rerender(); } } },
				h("div", { class: "peek" }, s.things.slice(0, 5).map((x) => beadIcon({ emoji: x.emoji || "", colour: x.colour || "", brick: !!x.brick }, 26))),
				h("b", { text: s[st.lang] }))));
	}

	// ---- make --------------------------------------------------------
	function makeScreen() {
		const t = T(), m = st.make;
		const wrap = h("div", {}, steps([t.stepSeed, t.stepThings, t.stepString], m.step));
		const card = h("div", { class: "card" });
		wrap.append(card);
		const rerender = () => render();

		if (m.step === 1) {
			const status = h("div", { class: "status" });
			const check = () => {
				if (!m.seed.trim()) { status.className = "status"; status.textContent = t.seedEmpty; return false; }
				try { S.mnemonicToEntropy(m.seed); status.className = "status ok"; status.textContent = t.seedOk(m.seed.trim().split(/\s+/).length); return true; }
				catch (e) { status.className = "status bad"; status.textContent = "❌ " + e.message; return false; }
			};
			const area = h("textarea", { class: "seed", spellcheck: "false", autocomplete: "off", "aria-label": t.seedTitle,
				placeholder: "height demise useless trap grow lion found off key clown transfer enroll",
				on: { input: (e) => { m.seed = e.target.value; nextBtn.disabled = !check(); } } });
			area.value = m.seed;
			const random = (bytes) => { const e = new Uint8Array(bytes); crypto.getRandomValues(e); m.seed = S.entropyToMnemonic(e); area.value = m.seed; nextBtn.disabled = !check(); };
			const nextBtn = h("button", { class: "btn", on: { click: () => { m.step = 2; rerender(); } } }, t.next + " ▶");
			card.append(h("h2", { text: t.seedTitle }), h("p", { class: "help", text: t.seedHelp }),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => random(16) } }, t.seedTest12),
					h("button", { class: "btn ghost small", on: { click: () => random(32) } }, t.seedTest24)),
				area, status,
				h("div", { class: "nav" }, h("button", { class: "btn ghost", on: { click: () => go("home") } }, "◀ " + t.home), nextBtn));
			nextBtn.disabled = !check();
		}

		if (m.step === 2) {
			const n = 1 << m.k;
			ensureThings(m, n);
			const [editor, dup] = thingsEditor(m, n);
			const err = h("div");
			card.append(h("h2", { text: t.thingsTitle }), h("p", { class: "help", text: t.thingsHelp }),
				h("h3", { text: t.howMany }),
				h("div", { class: "seg" }, [1, 2, 3, 4, 5].map((k) =>
					h("button", { class: k === m.k ? "on" : "", on: { click: () => { m.k = k; if (!m.edited) m.things = null; rerender(); } } },
						String(1 << k), k === 4 ? h("small", { text: "⭐ " + t.recommended }) : null))),
				h("h3", { text: t.pickSet }), setPicker(m, n, rerender),
				h("h3", { text: t.yourThings }), editor, dup,
				h("details", { class: "more" }, h("summary", { text: t.more }),
					h("h3", { text: t.pinTitle }), h("p", { class: "help", text: t.pinHelp }),
					(() => {
						const input = h("input", { class: "pin", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", value: m.pin, placeholder: "PIN",
							on: { input: (e) => { m.pin = cleanPin(e.target.value); e.target.value = m.pin; } } });
						const [btn, note] = randomPinButton(input, (v) => { m.pin = v; });
						return h("div", {}, h("div", { class: "row" }, input, btn), note);
					})()),
				err,
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => { m.step = 1; rerender(); } } }, "◀ " + t.back),
					h("button", { class: "btn", on: { click: () => {
						const names = m.things.map((x) => x.name.trim());
						if (names.some((x) => !x) || new Set(names).size !== n) { err.replaceChildren(errorBox(t.errCount(n, new Set(names.filter((x) => x)).size))); return; }
						try {
							const entropy = S.mnemonicToEntropy(m.seed);
							const symbols = S.encode(entropy, m.k, m.pin || undefined);
							st.result = { things: m.things.map((x) => ({ ...x, name: x.name.trim() })), symbols, n, pin: m.pin,
								qr: S.compactSeedQR(m.pin ? S.pinXor(entropy, m.pin) : entropy) };
							m.step = 3; rerender();
						} catch (e) { err.replaceChildren(errorBox(e.message)); }
					} } }, t.makeIt)));
		}

		if (m.step === 3 && st.result) {
			const r = st.result;
			const sequence = [...Array(r.n).keys(), ...r.symbols];
			const counts = new Array(r.n).fill(1);
			for (const s of r.symbols) counts[s]++;
			card.append(h("h2", { text: t.resultTitle }),
				h("div", { class: "big-total", text: t.total(sequence.length, r.n, r.symbols.length) }),
				h("div", { class: "row" },
					h("button", { class: "btn", on: { click: () => buildMode(r.things, sequence, r.n) } }, t.buildIt),
					h("button", { class: "btn ghost", on: { click: () => {
						st.read.things = r.things.map((x) => ({ ...x })); st.read.edited = true; st.read.taps = [];
						st.read.text = sequence.map((i) => r.things[i].name).join("\n"); st.read.typing = true;
						st.read.pin = r.pin; st.read.step = 2; st.read.out = null; go("read");
					} } }, t.readCheck)),
				h("button", { class: "btn ghost", on: { click: () => go("print") } }, t.printIt),
				h("h3", { text: t.legendTitle }), h("p", { class: "help", text: t.legendHelp }),
				h("div", { class: "legend" }, r.things.map((x, i) => h("span", { class: "item" }, beadIcon(x, 30), x.name, h("em", {}, `= ${i}`)))),
				h("h3", { text: t.stringTitle }), h("p", { class: "help", text: t.stringHelp }),
				stringSvg(r.things, sequence, r.n),
				h("h3", { text: t.shopTitle }),
				h("div", { class: "legend" }, r.things.map((x, i) => h("span", { class: "item" }, beadIcon(x, 30), x.name, h("em", {}, `× ${counts[i]}`)))),
				h("p", { class: "help", text: t.shopHelp(r.symbols.length + 1) }),
				h("details", { class: "more" }, h("summary", { text: t.asText }), h("p", { class: "help", text: t.asTextHelp }),
					h("pre", { class: "code" }, sequence.map((i, j) => `${j + 1}. ${r.things[i].name}`).join("\n"))),
				h("details", { class: "more" }, h("summary", { text: t.qrTitle }),
					h("div", { class: "qrbox" }, qrSvg(r.qr), h("p", { class: "help", text: r.pin ? t.qrHelpPin : t.qrHelp }))),
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => { m.step = 2; rerender(); } } }, "◀ " + t.back),
					h("button", { class: "btn ghost", on: { click: () => { m.step = 1; m.seed = ""; m.pin = ""; st.result = null; rerender(); } } }, "🔁 " + t.startAgain)));
		}
		return wrap;
	}

	function qrSvg(qr) {
		const n = qr.size, b = 2;
		let d = "";
		for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.getModule(x, y)) d += `M${x + b},${y + b}h1v1h-1z`;
		return svg("svg", { class: "qr", viewBox: `0 0 ${n + 2 * b} ${n + 2 * b}`, "shape-rendering": "crispEdges" }, svg("path", { d, fill: "#000" }));
	}

	// Big one-thing-at-a-time view to build the string.
	function buildMode(things, sequence, nLegend) {
		const t = T();
		let i = 0;
		const big = h("div"), count = h("div", { class: "count" }), tag = h("span", { class: "tag" }), name = h("div", { class: "name" });
		const bar = h("div"), prev = h("button", { class: "btn ghost" }, t.prev), next = h("button", { class: "btn" });
		const overlay = h("div", { class: "overlay", role: "dialog" },
			h("div", { class: "build" }, count, tag, big, name, h("div", { class: "progress" }, bar), h("div", { class: "nav" }, prev, next)));
		const show = () => {
			const thing = things[sequence[i]];
			big.replaceChildren(beadIcon(thing, 150));
			count.textContent = t.buildOf(i + 1, sequence.length);
			tag.textContent = i < nLegend ? "🗝️ " + t.buildLegend : "🌱 " + t.buildSeed;
			name.textContent = thing.name;
			bar.style.width = `${(100 * (i + 1)) / sequence.length}%`;
			prev.disabled = i === 0;
			next.textContent = i === sequence.length - 1 ? t.done : t.nextThing;
		};
		const close = () => { overlay.remove(); removeEventListener("keydown", keys); };
		const keys = (e) => {
			if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next.click(); }
			if (e.key === "ArrowLeft") prev.click();
			if (e.key === "Escape") close();
		};
		prev.addEventListener("click", () => { if (i > 0) { i--; show(); } });
		next.addEventListener("click", () => { if (i < sequence.length - 1) { i++; show(); } else close(); });
		overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
		addEventListener("keydown", keys);
		document.body.append(overlay);
		show();
		next.focus();
	}

	// ---- read --------------------------------------------------------
	function readScreen() {
		const t = T(), rd = st.read;
		const wrap = h("div", {}, steps([t.stepThings, t.stepRead, t.stepDone], rd.step));
		const card = h("div", { class: "card" });
		wrap.append(card);
		const rerender = () => render();

		if (rd.step === 1) {
			const n = rd.things ? rd.things.length : (1 << st.make.k);
			const sizes = h("div", { class: "seg" }, [1, 2, 3, 4, 5].map((k) =>
				h("button", { class: (1 << k) === n ? "on" : "", on: { click: () => { rd.edited = false; rd.things = presetThings(rd.setId, 1 << k); rerender(); } } }, String(1 << k))));
			ensureThings(rd, n);
			const [editor, dup] = thingsEditor(rd, n);
			card.append(h("h2", { text: t.readTitle }), h("p", { class: "help", text: t.readThingsHelp }),
				st.result ? h("button", { class: "btn ghost small", on: { click: () => { rd.things = st.result.things.map((x) => ({ ...x })); rd.edited = true; rerender(); } } }, "🧵 " + t.useMine) : null,
				h("h3", { text: t.howMany }), sizes,
				h("h3", { text: t.pickSet }), setPicker(rd, n, rerender),
				h("h3", { text: t.yourThings }), editor, dup,
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => go("home") } }, "◀ " + t.home),
					h("button", { class: "btn", on: { click: () => { rd.step = 2; rd.out = null; rd.error = ""; rerender(); } } }, t.next + " ▶")));
		}

		if (rd.step === 2) {
			ensureThings(rd, rd.things.length);
			const nameIndex = new Map(rd.things.map((x, i) => [x.name.trim(), i]));
			const preview = h("div"), counter = h("div", { class: "status" });
			const tapsAsIndexes = () => rd.taps;
			const refresh = () => {
				const seq = tapsAsIndexes();
				preview.replaceChildren(stringSvg(rd.things, seq, 0));
				counter.textContent = t.tapped(seq.length);
			};
			const keypad = h("div", { class: "keypad" }, rd.things.map((x, i) =>
				h("button", { class: "key", "aria-label": x.name, on: { click: () => { rd.taps.push(i); refresh(); } } }, beadIcon(x, 44), x.name)));
			const area = h("textarea", { spellcheck: "false", rows: 6, on: { input: (e) => { rd.text = e.target.value; } } });
			area.value = rd.text;
			const err = h("div");
			const readIt = () => {
				rd.error = "";
				const objects = rd.typing
					? rd.text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim()).filter((s) => s)
					: rd.taps.map((i) => rd.things[i].name.trim());
				if (!objects.length) { err.replaceChildren(errorBox(t.errEmpty)); return; }
				const kinds = new Set(objects).size;
				if (![2, 4, 8, 16, 32].includes(kinds)) { err.replaceChildren(errorBox(t.errKinds(kinds))); return; }
				try { rd.out = S.decodeObjects(objects, rd.pin || undefined); rd.step = 3; rerender(); }
				catch (e) { err.replaceChildren(errorBox(t.errRead)); }
			};
			card.append(h("h2", { text: t.tapTitle }), h("p", { class: "help", text: t.tapHelp }));
			if (!rd.typing) {
				card.append(keypad, counter, preview,
					h("div", { class: "row" },
						h("button", { class: "btn ghost small", on: { click: () => { rd.taps.pop(); refresh(); } } }, t.undo),
						h("button", { class: "btn ghost small", on: { click: () => { rd.taps = []; refresh(); } } }, t.clear),
						h("button", { class: "btn ghost small", on: { click: () => { rd.typing = true; rerender(); } } }, t.typeInstead)));
				refresh();
			} else {
				card.append(h("p", { class: "help", text: t.typeHelp }), area,
					h("button", { class: "btn ghost small", on: { click: () => { rd.typing = false; rerender(); } } }, "👆 " + t.tapTitle));
			}
			card.append(h("details", { class: "more", open: rd.pin ? "" : undefined }, h("summary", { text: t.pinTitle }),
				h("p", { class: "help", text: t.pinRead }),
				h("input", { class: "pin", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", value: rd.pin, on: { input: (e) => { rd.pin = cleanPin(e.target.value); e.target.value = rd.pin; } } })),
				err,
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => { rd.step = 1; rerender(); } } }, "◀ " + t.back),
					h("button", { class: "btn", on: { click: readIt } }, t.readIt)));
		}

		if (rd.step === 3 && rd.out) {
			const words = S.entropyToMnemonic(rd.out.entropy).split(" ");
			card.append(h("h2", { text: t.seedFound }),
				h("div", { class: "words" }, words.map((w, i) => h("div", {}, h("span", {}, i + 1), w))),
				rd.out.fixed ? h("div", { class: "note" }, t.repaired(rd.out.fixed)) : null,
				rd.out.reversed ? h("div", { class: "note" }, "↔️ " + t.reversed) : null,
				rd.pin ? h("div", { class: "note" }, "🔢 " + t.pinNote) : null,
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => { rd.step = 2; rerender(); } } }, "◀ " + t.back),
					h("button", { class: "btn ghost", on: { click: () => { rd.taps = []; rd.text = ""; rd.pin = ""; rd.out = null; rd.step = 1; go("home"); } } }, "🏠 " + t.home)));
		}
		return wrap;
	}

	// ---- printable sheet ----------------------------------------------
	// For whoever makes the string: what to buy and the order, with nothing
	// about what it is for (no seed, no legend).
	function printSheet() {
		const t = T(), r = st.result;
		if (!r) { st.screen = "home"; return home(); }
		const sequence = [...Array(r.n).keys(), ...r.symbols];
		const counts = new Array(r.n).fill(1);
		for (const s of r.symbols) counts[s]++;
		const cm = Math.ceil((sequence.length * 0.8 + 20) / 10) * 10;
		// a sheet of paper can be lost: recommend a PIN, settable right here
		const pinInput = h("input", { class: "pin", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "PIN", "aria-label": t.pinTitle,
			on: { input: (e) => { e.target.value = cleanPin(e.target.value); } } });
		const pinErr = h("div");
		const [pinRandomBtn, pinNote] = randomPinButton(pinInput, () => pinErr.replaceChildren());
		const pinBox = r.pin
			? h("div", { class: "note" }, t.pinSet(r.pin.length))
			: h("div", { class: "card pin-advice" }, h("h3", { text: t.pinAdviceTitle }), h("p", { text: t.pinAdvice }),
				h("div", { class: "row" }, pinInput, h("button", { class: "btn", on: { click: () => {
					const pin = pinInput.value;
					if (pin.length < 8) { pinErr.replaceChildren(errorBox(t.pinShort)); return; }
					const entropy = S.mnemonicToEntropy(st.make.seed);
					st.make.pin = pin;
					st.result = { ...r, pin, symbols: S.encode(entropy, Math.log2(r.n), pin), qr: S.compactSeedQR(S.pinXor(entropy, pin)) };
					render(); scrollTo(0, 0);
				} } }, t.pinAdviceBtn), pinRandomBtn), pinNote, pinErr);
		return h("div", {},
			h("div", { class: "noprint" },
				h("div", { class: "error" }, t.printWarn),
				pinBox,
				h("div", { class: "nav" },
					h("button", { class: "btn ghost", on: { click: () => go("make") } }, t.printBack),
					h("button", { class: "btn", on: { click: () => print() } }, t.printBtn))),
			h("div", { class: "card sheet" },
				h("h2", { text: t.sheetTitle }), h("p", { class: "help", text: t.sheetSub }),
				h("h3", { text: t.sheetShop }),
				h("div", { class: "legend shop" }, r.things.map((x, i) => h("span", { class: "item" }, beadIcon(x, 34, true), x.name, h("em", {}, `× ${counts[i]}`)))),
				h("p", { text: t.sheetString(cm) }),
				h("h3", { text: t.sheetHow }),
				h("ol", { class: "how-to" }, [t.sheetStep1, t.sheetStep2, t.sheetStep3, t.sheetStep4].map((s) => h("li", { text: s }))),
				h("div", { class: "magic" }, h("div", { class: "magic-title", text: t.sheetMagicTitle }), h("p", { text: t.sheetMagic })),
				// the other side of the sheet: the drawing alone, as big as fits
				h("div", { class: "drawing-page" },
					h("h3", { text: t.sheetDrawing }),
					stringSvg(r.things, sequence, 0, { paper: true, perRow: sequence.length > 80 ? 10 : 8 }))));
	}

	// ---- about -------------------------------------------------------
	function about() {
		const t = T();
		return h("div", { class: "card" },
			h("h2", { text: t.aboutTitle }),
			h("p", { text: "🔒 " + t.aboutNet }),
			h("p", { text: "🧾 " + t.aboutCheck }),
			h("pre", { class: "code" }, "macOS / Linux:  shasum -a 256 seedcraft-sequences.html\nWindows:        certutil -hashfile seedcraft-sequences.html SHA256"),
			h("p", { text: "🫙 " + t.aboutStore }),
			h("p", { class: "help", text: t.aboutSpec(FORMAT_VERSION) }),
			h("div", { class: "nav" }, h("button", { class: "btn ghost", on: { click: () => go("home") } }, "◀ " + t.home)));
	}

	render();
})();
