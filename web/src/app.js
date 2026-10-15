// Seedcraft web tool: user interface. Everything the user types is shown as
// text (textContent), never as HTML. Nothing is stored (no localStorage):
// closing the page forgets everything; a dictionary can be saved to a file.
"use strict";

(() => {
	const S = SeedcraftSequences;
	const SETS = SEEDCRAFT_SETS;
	const FORMAT_VERSION = document.body.dataset.formatVersion;
	const NS = "http://www.w3.org/2000/svg";
	const $ = (id) => document.getElementById(id);
	const SIZES = [2, 4, 8, 16, 32];
	// the colours offered for a piece: the first 16 example beads' (their names without "bead")
	const BEAD_COLOURS = SETS.find((set) => set.id === "beads").things.slice(0, 16).map((b) => ({ colour: b.colour,
		name: { en: b.en.replace(/ bead$/, ""), es: b.es.replace(/^Cuenta /, "") } }));
	// pieces of each kind that cover 99.9 % of seeds, plus one spare, in
	// packs of 5 (SPEC §6; simulated with the reference implementation)
	const BUY = { 12: { 2: 130, 4: 45, 8: 25, 16: 15, 32: 10 }, 24: { 2: 215, 4: 70, 8: 35, 16: 20, 32: 15 } };
	const symbolsFor = (words, n) => Math.ceil((words === 12 ? 213 : 364) / Math.log2(n));

	// ---- state -------------------------------------------------------
	const st = {
		lang: (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en",
		screen: "intro",
		buy: { n: 16, words: 12 },
		dict: null,  // { things: [{ name, emoji, photo, colour, symbol }], checked }
		edit: null,  // naming in progress: { things, i } or checking: { i }
		mode: null,  // "basic" or "pad" (SPEC §10), chosen before making or reading
		make: { seed: "", entropy: null, symbols: null, pos: 0, tab: "walk" },
		read: freshRead(),
	};
	// what is being read: the sequence (taps, typing, text, as before) and, in
	// pad mode, the pad (padIn: as a string of things, or as a file's text)
	function freshRead() {
		return { taps: [], typing: false, text: "", out: null, error: "", which: "seq",
			padIn: { source: "string", taps: [], typing: false, text: "", file: "", dict: null } };
	}
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// a dictionary of another size: what was made or read with the old one
	// goes (a renamed piece changes nothing: the sequence is numbers)
	function setDict(d) {
		const same = st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (!same) {
			st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "walk" };
			st.read = freshRead();
		}
	}

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
	const errorBox = (msg) => msg ? h("div", { class: "error", role: "alert" }, msg) : null;
	function download(data, name, type) {
		const url = URL.createObjectURL(new Blob([data], { type }));
		const a = h("a", { href: url, download: name });
		document.body.append(a); a.click(); a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}

	// ---- things ------------------------------------------------------
	const lightColour = (hex) => {
		const v = parseInt((hex || "#ffffff").slice(1), 16);
		return ((v >> 16) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 > 150;
	};
	const darkScreen = () => matchMedia("(prefers-color-scheme: dark)").matches;
	let clipId = 0;
	// One piece drawn into an SVG group, centred on (x, y): its photo, else
	// its emoji, else its symbol on its colour, else its initials.
	function bead(thing, x, y, r, opts = {}) {
		const g = svg("g");
		// the current piece's ring takes the page's accent (class ring-cur, in the CSS)
		const ring = opts.current ? "#2f45a8" : thing.photo && thing.colour ? thing.colour : "rgba(0,0,0,.3)", width = opts.current ? 4 : thing.photo && thing.colour ? 3 : 1.2;
		const cur = opts.current ? "ring-cur" : undefined;
		if (thing.photo) {
			const id = "clip" + (++clipId);
			g.append(svg("clipPath", { id }, svg("circle", { cx: x, cy: y, r })),
				svg("image", { href: thing.photo, x: x - r, y: y - r, width: 2 * r, height: 2 * r, "clip-path": `url(#${id})`, preserveAspectRatio: "xMidYMid slice" }),
				svg("circle", { cx: x, cy: y, r, fill: "none", stroke: ring, "stroke-width": width, class: cur }));
			return g;
		}
		if (thing.brick) {
			const w = r * 2, hgt = r * 1.5;
			g.append(svg("rect", { x: x - r, y: y - hgt / 2, width: w, height: hgt, rx: 4, fill: thing.colour || "#ddd", stroke: ring, "stroke-width": width, class: cur }));
			for (const dx of [-r / 2, r / 2]) g.append(svg("rect", { x: x + dx - r / 4, y: y - hgt / 2 - r / 3, width: r / 2, height: r / 3, rx: 2, fill: thing.colour || "#ddd", stroke: "rgba(0,0,0,.35)" }));
		} else {
			const fill = thing.colour || (opts.dark ? "#222c2b" : "#ffffff");
			g.append(svg("circle", { cx: x, cy: y, r, fill, stroke: ring, "stroke-width": width, class: cur }));
		}
		if (thing.emoji) g.append(svg("text", { x, y: y + r * 0.36, "text-anchor": "middle", "font-size": r * 1.05 }, thing.emoji));
		else if (thing.symbol) {
			const ink = lightColour(thing.colour) ? "#111111" : "#ffffff";
			g.append(svg("text", { x, y: y + r * 0.34, "text-anchor": "middle", "font-size": r * 0.95, "font-weight": 700,
				fill: ink, "font-family": "Menlo, Consolas, 'DejaVu Sans', sans-serif" }, thing.symbol + "︎"));
		} else if (thing.name) {
			const initials = thing.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
			g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * 0.8, "font-weight": 700,
				fill: thing.colour ? (lightColour(thing.colour) ? "#111111" : "#ffffff") : opts.dark ? "#e2eae7" : "#1c2826" }, initials));
		} else g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * 0.9, fill: "#8e9693" }, "?"));
		return g;
	}
	function icon(thing, size = 34, paper = false, current = false) {
		const s = svg("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: "icon" });
		s.append(bead(thing, size / 2, size / 2 + (thing.brick ? 2 : 0), size / 2 - 3, { dark: !paper && darkScreen(), current }));
		return s;
	}

	// The whole string: pieces on a thread that snakes row by row. opts:
	// paper (tick boxes), perRow, current (highlighted), onPick(i).
	function stringSvg(things, sequence, opts = {}) {
		const perRow = opts.perRow || 8, cell = 58, r = 21, rowH = opts.paper ? 66 : 74, pad = 66;
		const n = sequence.length, rows = Math.max(1, Math.ceil(n / perRow));
		const W = pad * 2 + (perRow - 1) * cell, H = 40 + (rows - 1) * rowH + (opts.paper ? 44 : 60);
		const pos = (i) => {
			const row = Math.floor(i / perRow), col = i % perRow;
			return [pad + (row % 2 ? perRow - 1 - col : col) * cell, 34 + row * rowH];
		};
		const root = svg("svg", { class: "string", viewBox: `0 0 ${W} ${H}`, role: "img" });
		if (n === 0) return root;
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
		root.append(svg("text", { x: sx - 34, y: sy + 7, "text-anchor": "middle", "font-size": 20 }, "🔒"));
		root.append(svg("text", { class: "tag", x: sx - 34, y: sy + 30, "text-anchor": "middle" }, T().clasp));
		root.append(svg("circle", { class: "knot", cx: ex + (lastRight ? 32 : -32), cy: ey, r: 6 }));
		root.append(svg("text", { class: "tag", x: ex + (lastRight ? 32 : -32), y: ey + 26, "text-anchor": "middle" }, T().end));
		const dark = !opts.paper && darkScreen();
		sequence.forEach((idx, i) => {
			const [x, y] = pos(i);
			const g = bead(things[idx], x, y, r, { dark, current: i === opts.current });
			g.append(svg("title", {}, `${i + 1}: ${things[idx].name}`));
			if (opts.onPick) { g.setAttribute("class", "pick"); g.addEventListener("click", () => opts.onPick(i)); }
			if (opts.paper) root.append(svg("rect", { class: "tick", x: x - 13, y: y + r + 3, width: 26, height: 16, rx: 4 }));
			root.append(g, svg("text", { class: "n" + (i === opts.current ? " leg" : ""), x, y: y + r + 15, "text-anchor": "middle" }, i + 1));
		});
		return root;
	}

	// A photo of a piece: the centre square, 192 px, as a JPEG data URL (the
	// only kind of image this page may show).
	function photoOf(file) {
		return new Promise((resolve, reject) => {
			const fr = new FileReader();
			fr.onerror = reject;
			fr.onload = () => {
				const img = new Image();
				img.onerror = reject;
				img.onload = () => {
					const side = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas");
					c.width = c.height = 192;
					c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 192, 192);
					resolve(c.toDataURL("image/jpeg", 0.85));
				};
				img.src = fr.result;
			};
			fr.readAsDataURL(file);
		});
	}

	// ---- shell -------------------------------------------------------
	const TABS = [["intro", "tabIntro"], ["buy", "tabBuy"], ["dict", "tabDict"], ["make", "tabMake"], ["read", "tabRead"]];
	const TAB_OF = { intro: "intro", buy: "buy", dict: "dict", name: "dict", check: "dict", make: "make", print: "make", read: "read" };
	function shell() {
		const t = T();
		document.documentElement.lang = st.lang;
		$("draft").textContent = t.draft;
		$("draft").title = t.warnTest;
		$("tagline").textContent = t.subtitle;
		$("lang").textContent = t.langName;
		$("about").textContent = t.aboutTitle;
		$("donate").textContent = t.donateTitle;
		$("tabs").replaceChildren(...TABS.map(([name, label]) => h("button", { class: TAB_OF[st.screen] === name ? "on" : "", on: { click: () => go(name) } },
			t[label], name === "dict" && st.dict ? h("span", { class: "count-badge", text: st.dict.things.length + (st.dict.checked ? " ✓" : "") }) : null)));
	}
	// the connection, always in sight; the warnings themselves appear next to a seed (seedAlert)
	const online = () => {
		const t = T(), on = navigator.onLine;
		$("net").className = "net " + (on ? "on" : "off");
		$("net").textContent = on ? t.netOn : t.netOff;
		$("net-why").replaceChildren(h("b", { text: on ? t.netOnTitle : t.netOffTitle }), h("div", { text: on ? t.netOnWhy : t.netOffWhy }));
	};
	const seedAlert = () => h("div", { class: "alert" }, navigator.onLine ? T().seedOnline : T().seedTest);
	addEventListener("online", online);
	addEventListener("offline", online);
	$("lang").addEventListener("click", () => { st.lang = T().langSwitch; render(); });
	$("logo").addEventListener("click", () => go("intro"));
	$("about").addEventListener("click", () => go("about"));
	$("donate").addEventListener("click", () => go("donate"));
	// the explanation of the connection: on hover (CSS), or on a tap, for touch screens
	$("net").addEventListener("click", (e) => { e.stopPropagation(); $("net-why").classList.toggle("open"); });
	document.addEventListener("click", () => $("net-why").classList.remove("open"));
	function go(screen) { st.screen = screen; render(); scrollTo(0, 0); }
	// the repository, and the sister projects (plain links: the page itself still connects nowhere)
	const REPO_URL = "https://github.com/ndssigner/seedcraft";
	const SIBLINGS = [["NDS-Signer", "https://github.com/ndssigner/nds-signer", "sibNds"], ["ur-tones", "https://github.com/ndssigner/ur-tones", "sibUrTones"]];
	const link = (href, text, tip) => h("a", { href, target: "_blank", rel: "noopener noreferrer", title: tip || null }, text);
	function links() {
		const t = T();
		$("repo").href = $("gh").href = REPO_URL;
		$("gh").title = t.repo;
		$("repo").textContent = t.repo;

	}
	function render() {
		shell(); online(); links();
		$("app").replaceChildren(({ intro, buy, dict: dictScreen, name: nameScreen, check: checkScreen, make: makeScreen,
			read: readScreen, print: printSheet, about, donate })[st.screen]());
	}

	// ---- small building blocks ----------------------------------------
	const field = (label, ...children) => h("div", { class: "field" }, h("div", { class: "label", text: label }), ...children);
	const panel = (...children) => h("section", { class: "panel" }, ...children);
	const tool = (...panels) => h("div", { class: "tool" }, ...panels);
	const title = (text) => h("h2", { class: "panel-title", text });
	const hint = (text) => h("div", { class: "hint", text });
	const bar = (fraction) => { const b = h("div"); b.style.width = `${Math.round(100 * fraction)}%`; return h("div", { class: "bar-track" }, b); };
	// segmented control: [value, label, mark]
	const seg = (items, value, set) => h("div", { class: "seg" }, items.map(([v, label, mark]) =>
		h("button", { class: v === value ? "on" : "", on: { click: () => set(v) } }, label, mark ? h("small", { text: mark }) : null)));
	// an element edged in a piece's colour (CSS var --c)
	const tint = (e, colour) => { if (colour) e.style.setProperty("--c", colour); return e; };
	const dictLine = () => {
		const t = T(), d = st.dict;
		if (!d) return h("div", { class: "note" }, t.noDict, " ", h("button", { class: "btn small", on: { click: () => go("dict") } }, t.dictCard));
		return h("div", { class: "dictline" }, h("span", { class: "minis" }, d.things.map((x) => icon(x, 22))),
			h("span", {}, t.dictSummary(d.things.length, d.checked)));
	};
	// the two modes (SPEC §10, §11.1), chosen before making or reading: what
	// each one keeps safe, and what it doesn't. Changing it starts over.
	function setMode(mode) {
		st.mode = mode;
		st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "walk" };
		st.read = freshRead();
		render();
	}
	function modeChoice() {
		const t = T();
		const option = (mode, name, points) => h("button", { class: "mode" + (st.mode === mode ? " on" : ""), "aria-pressed": String(st.mode === mode),
			on: { click: () => setMode(mode) } }, h("b", { text: name }), h("span", { class: "points" }, points.map((x) => h("span", { text: x }))));
		return panel(title(t.modeTitle), hint(t.modeHelp),
			h("div", { class: "modes" }, option("basic", t.modeBasic, t.modeBasicPoints), option("pad", t.modePad, t.modePadPoints)), hint(t.modeMore));
	}
	const modeLine = () => h("div", { class: "row between" }, h("span", { class: "meta", text: T().modeNow(st.mode) }),
		h("button", { class: "btn ghost small", on: { click: () => setMode(null) } }, T().modeChange));

	// ---- what to buy -------------------------------------------------
	function buy() {
		const t = T(), b = st.buy;
		const count = symbolsFor(b.words, b.n), each = BUY[b.words][b.n];
		return tool(
			panel(title(t.buyCard), hint(t.buyHelp),
				field(t.seedWords, seg([[12, "12"], [24, "24"]], b.words, (v) => { b.words = v; render(); })),
				field(t.howMany, seg(SIZES.map((n) => [n, String(n), n === 16 ? "★" : ""]), b.n, (v) => { b.n = v; render(); }), hint("★ " + t.recommended))),
			panel(h("div", { class: "big-total", text: t.buyEach(each, b.n) }),
				h("p", { text: t.buyWhy(count, Math.ceil((count * 0.8 + 20) / 10) * 10) }),
				hint(t.buyExact),
				h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => go("dict") } }, t.tabDict))));
	}

	// ---- dictionary ----------------------------------------------------
	function dictFromFile(text, name) {
		if (/\.json$/i.test(name) || text.trim().startsWith("{")) {
			const j = JSON.parse(text);
			const things = (j.things || []).map((x) => ({ name: String(x.name || "").trim(), emoji: x.emoji || "",
				colour: /^#[0-9a-f]{6}$/i.test(x.colour || "") ? x.colour.toLowerCase() : "",
				photo: typeof x.photo === "string" && x.photo.startsWith("data:image/") ? x.photo : "" }));
			return things;
		}
		return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name, emoji: "", colour: "", photo: "" }));
	}
	const dictProblem = (things) => {
		const t = T();
		if (!SIZES.includes(things.length)) return t.errDictSize(things.length);
		if (things.some((x) => !x.name.trim())) return t.errDictName;
		if (new Set(things.map((x) => x.name.trim().toLowerCase())).size !== things.length) return t.errDictDup;
		return "";
	};
	function dictScreen() {
		const t = T(), d = st.dict;
		const err = h("div");
		const open = h("input", { type: "file", accept: ".json,.txt,application/json,text/plain", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			try {
				const things = dictFromFile(await f.text(), f.name), problem = dictProblem(things);
				if (problem) { err.replaceChildren(errorBox(problem)); return; }
				setDict({ things, checked: false });
				render();
			} catch (x) { err.replaceChildren(errorBox(t.errDictFile)); }
		} } });
		if (!d) {
			let n = st.buy.n;
			const sizes = h("div");
			const drawSizes = () => sizes.replaceChildren(seg(SIZES.map((v) => [v, String(v), v === 16 ? "★" : ""]), n, (v) => { n = v; drawSizes(); }));
			drawSizes();
			const example = h("div", { class: "row" }, SETS.map((set) => h("button", { class: "btn ghost small", on: { click: () => {
				setDict({ things: set.things.slice(0, n).map((x) => ({ name: x[st.lang], emoji: x.emoji || "", colour: x.colour || "", symbol: x.symbol || "", brick: !!x.brick, photo: "" })), checked: false });
				render();
			} } }, set.icon + " " + set[st.lang])));
			return tool(
				panel(title(t.dictCard),
					field(t.howMany, sizes, hint("★ " + t.recommended)),
					h("div", { class: "row" },
						h("button", { class: "btn", on: { click: () => { st.edit = { things: Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" })), i: 0 }; go("name"); } } }, t.dictName),
						h("button", { class: "btn ghost", on: { click: () => open.click() } }, t.dictOpen), open),
					err,
					h("details", { class: "more" }, h("summary", { text: t.dictExample }), hint(t.dictExampleHelp), example)),
				panel(h("p", { text: t.dictIntro }), h("ol", { class: "how-to" }, t.dictChecks.map((x) => h("li", { text: x })))));
		}
		const json = () => JSON.stringify({ format: "seedcraft-dictionary", version: 0,
			things: d.things.map((x) => Object.fromEntries(Object.entries({ name: x.name, emoji: x.emoji, colour: x.colour, photo: x.photo }).filter(([, v]) => v))) }, null, 1);
		return tool(
			panel(title(t.dictHave(d.things.length)),
				h("div", { class: "dict-grid" }, d.things.map((x, i) => h("div", { class: "piece" }, h("span", { class: "num", text: String(i) }), icon(x, 34), h("span", { text: x.name }))))),
			panel(
				d.checked ? h("div", { class: "note ok" }, "✓ " + t.dictChecked) : h("div", { class: "note warn", text: t.dictNotChecked }),
				h("div", { class: "row" },
					h("button", { class: d.checked ? "btn ghost" : "btn", on: { click: () => { st.edit = { i: 0 }; go("check"); } } }, t.dictCheck),
					h("button", { class: "btn ghost", on: { click: () => { st.edit = { things: d.things.map((x) => ({ ...x })), i: 0 }; go("name"); } } }, t.dictEdit)),
				field(t.dictSave, hint(t.dictSaveHelp),
					h("div", { class: "row" },
						h("button", { class: "btn ghost small", on: { click: () => download(json(), "dictionary.json", "application/json") } }, t.dictSaveJson),
						h("button", { class: "btn ghost small", on: { click: () => download(d.things.map((x) => x.name).join("\n") + "\n", "dictionary.txt", "text/plain") } }, t.dictSaveTxt))),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.dictForgetAsk)) { setDict(null); render(); } } } }, t.dictForget),
					h("button", { class: "btn push", on: { click: () => go("make") } }, t.tabMake))));
	}

	// naming the pieces one by one
	function nameScreen() {
		const t = T(), ed = st.edit, n = ed.things.length, x = ed.things[ed.i];
		const err = h("div");
		const nameIn = h("input", { type: "text", class: "big-input", value: x.name, placeholder: t.dictNamePh, autocomplete: "off", "aria-label": t.thingName,
			on: { input: (e) => { x.name = e.target.value; drawStrip(); preview.replaceChildren(icon(x, 96)); }, keydown: (e) => { if (e.key === "Enter") next(); } } });
		const emojiIn = h("input", { type: "text", class: "emoji", value: x.emoji, placeholder: "🙂", "aria-label": t.thingEmoji, maxlength: 8,
			on: { input: (e) => { x.emoji = e.target.value.trim(); drawStrip(); preview.replaceChildren(icon(x, 96)); } } });
		const preview = h("div", { class: "preview" }, icon(x, 96));
		const photoIn = h("input", { type: "file", accept: "image/*", capture: "environment", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			try { x.photo = await photoOf(f); render(); } catch (z) { err.replaceChildren(errorBox(t.errPhoto)); }
		} } });
		// its colour: one of the beads' colours, any other, or none
		const colours = h("div", { class: "swatches", role: "group", "aria-label": t.thingColour });
		const setColour = (c) => { x.colour = c; drawColours(); drawStrip(); preview.replaceChildren(icon(x, 96)); };
		function drawColours() {
			const swatch = (c, label) => {
				const b = h("button", { class: "swatch" + (c ? "" : " none") + (x.colour === c ? " on" : ""), title: label, "aria-label": label,
					"aria-pressed": String(x.colour === c), on: { click: () => setColour(c) } });
				if (c) b.style.setProperty("--c", c);
				return b;
			};
			const other = x.colour && !BEAD_COLOURS.some((b) => b.colour === x.colour);
			colours.replaceChildren(swatch("", t.colourNone), ...BEAD_COLOURS.map((b) => swatch(b.colour, b.name[st.lang])),
				h("label", { class: "swatch-any" + (other ? " on" : "") }, h("input", { type: "color", value: x.colour || "#7f7f7f",
					on: { input: (e) => setColour(e.target.value.toLowerCase()) } }), t.colourOther));
		}
		drawColours();
		const strip = h("div", { class: "strip" });
		function drawStrip() {
			strip.replaceChildren(...ed.things.map((y, j) => h("button", { class: "mini" + (j === ed.i ? " on" : ""), title: y.name || "?",
				on: { click: () => { ed.i = j; render(); } } }, h("span", { class: "num", text: String(j) }), icon(y, 28, false, j === ed.i))));
		}
		drawStrip();
		const valid = () => {
			if (!x.name.trim()) return t.errDictName;
			if (ed.things.some((y, j) => j !== ed.i && y.name.trim().toLowerCase() === x.name.trim().toLowerCase())) return t.errDictDupOne(x.name.trim());
			return "";
		};
		function next() {
			const problem = valid();
			if (problem) { err.replaceChildren(errorBox(problem)); return; }
			if (ed.i < n - 1) { ed.i++; render(); return; }
			const all = dictProblem(ed.things);
			if (all) { err.replaceChildren(errorBox(all)); return; }
			setDict({ things: ed.things.map((y) => ({ ...y, name: y.name.trim() })), checked: false });
			st.edit = { i: 0 };
			go("check");
		}
		const side = (j) => j >= 0 && j < n
			? h("div", { class: "side" }, hint(j < ed.i ? t.prevPiece : t.nextPiece), icon(ed.things[j], 44), h("div", { class: "num", text: `${j} · ${ed.things[j].name || "?"}` }))
			: h("div", { class: "side" });
		setTimeout(() => nameIn.focus(), 0);
		return tool(
			panel(
				h("div", { class: "row between" }, title(t.dictName), h("span", { class: "meta", text: t.pieceOf(ed.i, n) })),
				hint(t.nameHelp),
				h("div", { class: "wizard" }, side(ed.i - 1), h("div", { class: "centre" }, preview), side(ed.i + 1)),
				field(t.thingName, nameIn),
				field(t.thingColour, colours),
				h("div", { class: "row end" },
					h("label", { class: "field" }, h("span", { class: "label", text: t.thingEmoji }), emojiIn),
					h("button", { class: "btn ghost small", on: { click: () => photoIn.click() } }, x.photo ? t.photoAgain : t.photoTake),
					x.photo ? h("button", { class: "btn ghost small", on: { click: () => { x.photo = ""; render(); } } }, t.photoRemove) : null, photoIn),
				err,
				h("div", { class: "row" },
					h("button", { class: "btn ghost", on: { click: () => { if (ed.i > 0) { ed.i--; render(); } else go("dict"); } } }, "◀ " + (ed.i > 0 ? t.back : t.tabDict)),
					h("button", { class: "btn push", on: { click: next } }, ed.i < n - 1 ? t.next + " ▶" : "✓ " + t.dictDone))),
			panel(field(t.wholeDict, strip)));
	}

	// a round of checking against the real thing
	function checkScreen() {
		const t = T(), d = st.dict, ed = st.edit, n = d.things.length, x = d.things[ed.i];
		return h("div", { class: "narrow" }, panel(
			h("div", { class: "row between" }, title(t.dictCheck), h("span", { class: "meta", text: t.pieceOf(ed.i, n) })),
			hint(t.checkHelp),
			h("div", { class: "wizard" },
				h("div", { class: "side" }, ed.i > 0 ? [hint(t.prevPiece), icon(d.things[ed.i - 1], 44)] : null),
				h("div", { class: "centre" }, icon(x, 96), h("div", { class: "name", text: x.name })),
				h("div", { class: "side" }, ed.i < n - 1 ? [hint(t.nextPiece), icon(d.things[ed.i + 1], 44)] : null)),
			h("p", { class: "question", text: t.checkAsk(ed.i) }),
			bar((ed.i + 1) / n),
			h("div", { class: "row" },
				h("button", { class: "btn ghost", on: { click: () => { st.edit = { things: d.things.map((y) => ({ ...y })), i: ed.i }; go("name"); } } }, "✗ " + t.checkNo),
				h("button", { class: "btn push", on: { click: () => {
					if (ed.i < n - 1) { ed.i++; render(); return; }
					d.checked = true; go("dict");
				} } }, "✓ " + t.checkYes))));
	}

	// ---- make --------------------------------------------------------
	function qrSvg(qr) {
		const n = qr.size, b = 2;
		let d = "";
		for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.getModule(x, y)) d += `M${x + b},${y + b}h1v1h-1z`;
		return svg("svg", { class: "qr", viewBox: `0 0 ${n + 2 * b} ${n + 2 * b}`, "shape-rendering": "crispEdges" }, svg("path", { d, fill: "#000" }));
	}
	// ---- the QR code by hand: an interactive version of the by-hand manual ----
	// Each piece → its number → k bits → the next k white squares of the
	// template, row by row (SPEC §3); the last bits are the header (version,
	// mask) and padding, which go on no square.
	// The template drawn as squares. dark(r, c): a square's colour (the QR code's,
	// or the bits read so far); fixedDark(r, c): a fixed square's (null: not known yet).
	function handGrid(size, dark, fixedDark, cells, upto, current, onPick, done) {
		const cs = 14, m = 30, w = 2 * m + size * cs;
		const fn = S.functionModules(size);
		const owner = new Map(cells.map(([r, c], i) => [r * size + c, i]));
		// when everything is filled in, the template's grey turns white: a QR code to scan
		const g = svg("svg", { class: "hand-qr" + (done ? " done" : ""), viewBox: `0 0 ${w} ${w}` });
		// finished: a white quiet zone of 2 modules and no numbers, so that it scans
		if (done) g.append(svg("rect", { x: m - 2 * cs, y: m - 2 * cs, width: (size + 4) * cs, height: (size + 4) * cs, fill: "#ffffff" }));
		for (let i = 0; i < size && !done; i++) {
			g.append(svg("text", { x: m - 4, y: m + i * cs + cs * 0.72, "text-anchor": "end", class: "rc" + (current.rows.has(i) ? " on" : "") }, String(i + 1)));
			if (i % 2 === 0 || current.cols.has(i)) g.append(svg("text", { x: m + i * cs + cs / 2, y: m - 5, "text-anchor": "middle", class: "rc" + (current.cols.has(i) ? " on" : "") }, String(i + 1)));
		}
		for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
			const key = r * size + c;
			let cls;
			if (fn.has(key)) { const f = fixedDark(r, c); cls = f === null ? "pending" : f ? "fn-dark" : "fn-light"; }
			else {
				const bit = owner.get(key), on = dark(r, c, bit);
				if (current.bits.has(bit)) cls = on ? "cur-dark" : "cur-light";
				else if (bit < upto) cls = on ? "dark" : "light";
				else cls = "empty";
			}
			const rect = svg("rect", { x: m + c * cs, y: m + r * cs, width: cs, height: cs, class: "cell " + cls });
			if (!fn.has(key) && onPick) rect.addEventListener("click", () => onPick(owner.get(key)));
			g.append(rect);
		}
		return g;
	}
	// The QR code by hand, for a sequence of symbols: step by step (at: the piece
	// being drawn; at = L: all of it), or live while reading (no qr yet, no move).
	// qr: the seed's CompactSeedQR once known; without it, the template's size
	// comes from the number of pieces and the squares from the bits themselves.
	function handView(d, symbols, qr, at, move) {
		const t = T(), n = d.things.length, k = Math.log2(n), L = symbols.length;
		const size = qr ? qr.size : L > symbolsFor(12, n) ? 25 : 21;
		const cells = S.dataModulesRowMajor(size), ndata = cells.length;
		const i = Math.max(-1, Math.min(L, at));
		const bits = S.symbolsToBits(symbols, k);
		const mask = qr ? qr.mask : bits.length >= ndata + 5 ? parseInt(bits.slice(ndata + 2, ndata + 5).join(""), 2) : "?";
		const first = i * k, own = i >= 0 && i < L ? [...Array(k).keys()].map((j) => first + j) : [];
		const current = { bits: new Set(own.filter((b) => b < ndata)), rows: new Set(), cols: new Set() };
		const byRow = new Map();
		for (const b of current.bits) {
			const [r, c] = cells[b];
			current.rows.add(r); current.cols.add(c);
			if (!byRow.has(r)) byRow.set(r, []);
			byRow.get(r).push(c + 1);
		}
		const done = !!qr && i >= L;
		const upto = done ? ndata : Math.max(0, first);
		const dark = qr ? (r, c) => qr.getModule(c, r) : (r, c, bit) => bits[bit] === 1;
		const fixedDark = qr ? (r, c) => qr.getModule(c, r) : (r, c) => S.templateModule(size, r, c);
		const grid = handGrid(size, dark, fixedDark, cells, upto, current, move ? (bit) => move(Math.floor(bit / k)) : null, done);
		const info = [];
		if (i >= 0 && i < L) {
			const s = symbols[i], thing = d.things[s];
			const bitSpans = own.map((b) => h("span", { class: "bit" + (b >= ndata ? " hdr" : ""), text: String(bits[b]) }));
			info.push(h("div", { class: "hand-piece" }, icon(thing, 48),
				h("div", {}, h("b", { text: thing.name }), h("div", { class: "hint", text: t.handNumber(s, k) }), h("div", { class: "bits" }, bitSpans))));
			if (current.bits.size) info.push(hint(t.handCells([...byRow].map(([r, cs]) => [r + 1, cs]))));
			if (own.some((b) => b >= ndata && b < ndata + 5)) info.push(h("div", { class: "note" }, t.handHeader, " ", h("b", { text: t.handTemplate(size, mask) })));
			else if (own.some((b) => b >= ndata + 5)) info.push(h("div", { class: "note", text: t.handPadding }));
		} else if (done) {
			info.push(h("div", { class: "note ok", text: "✓ " + t.handDone }), hint(t.handTemplate(size, qr.mask)));
		}
		const legend = h("details", { class: "more" }, h("summary", { text: t.handLegend }),
			h("div", { class: "hand-legend" }, d.things.map((x, s) => h("div", {}, icon(x, 22), h("span", { class: "num", text: String(s) }),
				h("code", { text: s.toString(2).padStart(k, "0") })))));
		// the mask is in the header, after the data: in the last pieces of the string
		const expected = qr ? L : size === 25 ? symbolsFor(24, n) : symbolsFor(12, n);
		return [
			i <= 0 ? hint(move ? t.handIntro : t.handLiveIntro) : null,
			(i <= 0 || !move) && !done ? h("div", { class: "note" }, qr ? t.handMaskKnown(expected - Math.floor(ndata / k), size, qr.mask) : t.handMaskWhere(expected - Math.floor(ndata / k), size)) : null,
			h("div", { class: "row between" }, h("span", { class: "label", text: i < 0 ? t.handNone : i < L ? t.handStep(i + 1, qr ? L : expected) : t.handStep(L, L) }),
				h("span", { class: "meta", text: t.handTemplate(size, mask) })),
			...info,
			move ? h("div", { class: "row" },
				h("button", { class: "btn ghost", disabled: i === 0 ? "" : undefined, "aria-label": t.prevPiece, on: { click: () => move(i - 1) } }, "◀"),
				h("button", { class: "btn", disabled: i >= L ? "" : undefined, on: { click: () => move(i + 1) } }, t.nextPiece + " ▶"),
				h("button", { class: "btn ghost small push", on: { click: () => move(i >= L ? 0 : L) } }, i >= L ? t.handRestart : t.handAll)) : null,
			grid, move ? hint(t.handClick) : null, legend];
	}

	function makeScreen() {
		const t = T(), m = st.make, d = st.dict;
		if (!d) return h("div", { class: "narrow" }, panel(title(t.makeCard), dictLine()));
		if (!st.mode) return tool(modeChoice(), panel(title(t.makeCard), dictLine()));
		const n = d.things.length, k = Math.log2(n), padMode = st.mode === "pad";
		if (!m.symbols) {
			const area = h("textarea", { class: "input mono", rows: 3, spellcheck: "false", autocomplete: "off", placeholder: "height demise useless trap grow lion found off key clown transfer enroll" });
			area.value = m.seed;
			const status = h("div", { class: "status" }), err = h("div");
			const check = () => {
				m.seed = area.value;
				const words = m.seed.trim().split(/\s+/).filter(Boolean).length;
				try { S.mnemonicToEntropy(m.seed); status.className = "status ok"; status.textContent = t.seedOk(words); return true; }
				catch (e) { status.className = "status bad"; status.textContent = words ? e.message : t.seedEmpty; return false; }
			};
			area.addEventListener("input", check);
			const test = (bytes) => { const e = new Uint8Array(bytes); crypto.getRandomValues(e); area.value = S.entropyToMnemonic(e); check(); };
			check();
			return tool(
				panel(title(t.makeCard), modeLine(), seedAlert(),
					field(t.seedTitle, hint(t.seedHelp),
						h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => test(16) } }, t.seedTest12),
							h("button", { class: "btn ghost small", on: { click: () => test(32) } }, t.seedTest24)),
						area, status),
					err,
					h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => {
						if (!check()) { err.replaceChildren(errorBox(t.errWords)); return; }
						m.entropy = S.mnemonicToEntropy(m.seed);
						if (padMode) {
							// the basic sequence plus a pad drawn here (SPEC §10.9)
							m.basic = S.encode(m.entropy, k);
							m.devicePad = S.newPad(m.basic.length, n);
							m.handPad = null; m.handText = "";
							m.pad = m.devicePad;
							m.symbols = S.encrypt(m.basic, m.pad, n);
						} else m.symbols = S.encode(m.entropy, k);
						m.pos = 0; m.padPos = 0; m.which = "seq"; m.hand = 0; m.tab = "walk";
						render();
					} } }, t.makeIt))),
				panel(field(t.tabDict, dictLine())));
		}
		const L = m.symbols.length;
		// in pad mode, two strings to make: the sequence and the pad
		const onPad = padMode && m.which === "pad", string = onPad ? m.pad : m.symbols, posKey = onPad ? "padPos" : "pos";
		const each = S.piecesToBuy(padMode ? m.symbols.concat(m.pad) : m.symbols, n), cm = Math.ceil((L * 0.8 + 20) / 10) * 10;
		// the QR code by hand starts from the basic sequence: in pad mode, only after subtracting the pad
		if (padMode && m.tab === "hand") m.tab = "walk";
		const views = [["walk", t.tabWalk], padMode ? null : ["hand", t.tabHand], ["drawing", t.tabDrawing], ["list", t.tabList], ["qr", t.tabQr]].filter(Boolean);
		const view = h("div", { class: "stack" });
		if (padMode && m.tab !== "qr") view.append(h("div", { class: "note", text: onPad ? t.padStringHelp : t.seqStringHelp }));
		if (m.tab === "walk") {
			const thing = (i) => d.things[string[i]];
			const pos = m[posKey];
			const move = (to) => { m[posKey] = Math.max(0, Math.min(L - 1, to)); render(); };
			const side = (i, label) => h("div", { class: "side" }, i >= 0 && i < L ? [hint(`${label} · ${i + 1}`), icon(thing(i), 44), h("div", { class: "small-name", text: thing(i).name })] : null);
			view.append(
				h("div", { class: "row between" }, h("span", { class: "label", text: t.walkOf(pos + 1, L) }), hint(t.walkHelp)),
				h("div", { class: "wizard" }, side(pos - 1, t.prevPiece), h("div", { class: "centre" }, icon(thing(pos), 104), h("div", { class: "name", text: thing(pos).name })), side(pos + 1, t.nextPiece)),
				bar((pos + 1) / L),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", disabled: pos === 0 ? "" : undefined, on: { click: () => move(pos - 1) } }, "◀ " + t.prevPiece),
					h("button", { class: "btn push", on: { click: () => pos < L - 1 ? move(pos + 1) : null } }, pos < L - 1 ? t.nextPiece + " ▶" : "✓ " + t.done)),
				stringSvg(d.things, string, { current: pos, onPick: (i) => move(i) }));
		}
		if (m.tab === "drawing") view.append(hint(t.stringHelp), stringSvg(d.things, string));
		if (m.tab === "list") {
			const text = string.map((s, i) => `${i + 1}. ${d.things[s].name}`).join("\n");
			// in pad mode, file names that say nothing about which is which
			const name = padMode ? (onPad ? "list-b.txt" : "list-a.txt") : "sequence.txt";
			view.append(hint(t.listHelp), h("pre", { class: "code", text }),
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(text + "\n", name, "text/plain") } }, t.saveList)));
		}
		if (m.tab === "hand") {
			if (m.hand === undefined) m.hand = 0;
			const move = (to) => { m.hand = Math.max(0, Math.min(L, to)); render(); };
			view.append(...handView(d, m.symbols, S.compactSeedQR(m.entropy), m.hand, move).filter(Boolean));
		}
		if (m.tab === "qr") view.append(h("div", { class: "qrbox" }, qrSvg(S.compactSeedQR(m.entropy)), hint(padMode ? t.qrHelpPad : t.qrHelp)));
		return tool(
			panel(title(t.makeCard), dictLine(), modeLine(),
				h("div", { class: "big-total", text: padMode ? t.padTotal(L) : t.total(L) }),
				h("p", { text: padMode ? t.padShop(each, n, cm) : t.shop(each, n, cm) }),
				h("div", { class: "alert", text: padMode ? t.padMakeWarn : t.makeWarn }),
				padMode ? padTools() : null,
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { m.symbols = null; m.entropy = null; render(); } } }, "◀ " + t.otherSeed),
					h("button", { class: "btn ghost small", on: { click: () => go("print") } }, t.printIt),
					h("button", { class: "btn ghost small", on: { click: () => { st.read = freshRead(); go("read"); } } }, t.readCheck))),
			panel(padMode ? seg([["seq", t.stringSeq], ["pad", t.stringPad]], m.which, (v) => { m.which = v; render(); }) : null,
				seg(views, m.tab, (v) => { m.tab = v; render(); }), view));
	}

	// Pad mode, making: the pad drawn here (for learning only), a pad made by
	// hand added to it if you like (SPEC §10.2), and the pad saved as a file (§10.7).
	function padTools() {
		const t = T(), m = st.make, n = st.dict.things.length, L = m.symbols.length;
		const remake = () => {
			m.pad = m.handPad ? S.addPads(m.devicePad, m.handPad, n) : m.devicePad;
			m.symbols = S.encrypt(m.basic, m.pad, n);
			m.pos = 0; m.padPos = 0;
			render();
		};
		let hand;
		if (m.handPad) hand = h("div", { class: "note ok" }, "✓ " + t.padHandAdded, " ",
			h("button", { class: "btn ghost small", on: { click: () => { m.handPad = null; remake(); } } }, t.padHandRemove));
		else {
			const area = h("textarea", { class: "input", rows: 4, spellcheck: "false", autocomplete: "off", placeholder: "3A37 DFE7 0239…",
				on: { input: (e) => { m.handText = e.target.value; } } });
			area.value = m.handText || "";
			const err = h("div");
			const add = () => {
				// one character per number, as in the pad file; spaces, line breaks and notes after # are ignored
				const chars = [...(m.handText || "").replace(/#.*$/gm, "").replace(/\s+/g, "").toUpperCase()];
				const value = (ch) => { const v = S.PAD_DIGITS.indexOf(ch); return v < n ? v : -1; };
				const bad = chars.find((ch) => value(ch) < 0);
				if (bad !== undefined) { err.replaceChildren(errorBox(t.errHandChar(bad, n))); return; }
				if (chars.length !== L) { err.replaceChildren(errorBox(t.errHandLength(chars.length, L))); return; }
				m.handPad = chars.map(value);
				m.handText = "";
				remake();
			};
			hand = h("details", { class: "more" }, h("summary", { text: t.padHandTitle }), hint(t.padHandHelp(n, L)), area, err,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: add } }, t.padHandAdd)));
		}
		const file = S.writePadFile(m.pad, n);
		return field(t.padTitle,
			h("div", { class: "note warn", text: t.padLearnOnly }),
			hand,
			hint(t.padFileHelp),
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(file, "numbers.txt", "text/plain") } }, t.padFileSave)),
			h("details", { class: "more" }, h("summary", { text: t.padFileSee }), h("pre", { class: "code", text: file })));
	}

	// keyboard for the step-by-step view
	addEventListener("keydown", (e) => {
		if (/input|textarea/i.test(e.target.tagName)) return;
		const rd = st.read;
		if (st.screen === "read" && rd.out && rd.view === "hand") {
			const L = rd.symbols.length, at = rd.hand || 0;
			if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); rd.hand = Math.min(L, at + 1); render(); }
			if (e.key === "ArrowLeft") { rd.hand = Math.max(0, at - 1); render(); }
			return;
		}
		if (st.screen !== "make" || !st.make.symbols) return;
		if (st.make.tab === "hand") {
			const L = st.make.symbols.length, at = st.make.hand || 0;
			if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); st.make.hand = Math.min(L, at + 1); render(); }
			if (e.key === "ArrowLeft") { st.make.hand = Math.max(0, at - 1); render(); }
			return;
		}
		if (st.make.tab !== "walk") return;
		const key = st.mode === "pad" && st.make.which === "pad" ? "padPos" : "pos";
		if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); st.make[key] = Math.min(st.make.symbols.length - 1, st.make[key] + 1); render(); }
		if (e.key === "ArrowLeft") { st.make[key] = Math.max(0, st.make[key] - 1); render(); }
	});

	// ---- read --------------------------------------------------------
	// In pad mode there are two things to read: the sequence, tapped or typed
	// as in the basic mode, and the pad, as a second string of things (with
	// the same dictionary or its own) or as a pad file, typed, pasted or opened.
	function readScreen() {
		const t = T(), rd = st.read, d = st.dict;
		if (!d) return h("div", { class: "narrow" }, panel(title(t.readCard), dictLine()));
		if (!st.mode) return tool(modeChoice(), panel(title(t.readCard), dictLine()));
		const n = d.things.length, k = Math.log2(n), len12 = symbolsFor(12, n), len24 = symbolsFor(24, n);
		const padMode = st.mode === "pad", pin = rd.padIn, padThings = pin.dict || d.things;
		// what is tapped or typed now: the sequence, or the pad's string
		const onPad = padMode && rd.which === "pad", slot = onPad ? pin : rd, things = onPad ? padThings : d.things;
		const namesOf = (th) => th.map((x) => x.name.toLowerCase());
		const objectsOf = (sl, th) => sl.typing
			? sl.text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim().toLowerCase()).filter(Boolean)
			: sl.taps.map((i) => th[i].name.toLowerCase());
		// the pad's numbers, from its file or its string
		const padSymbols = () => {
			if (pin.source === "string") return S.readSequence(objectsOf(pin, padThings), namesOf(padThings));
			const f = S.readPadFile(pin.file);
			if (f.n !== n) throw new S.PadFileError("dictn", "N does not match the dictionary", null, [f.n, n]);
			return f.pad;
		};
		const padFileState = () => { try { return { pad: S.readPadFile(pin.file).pad }; } catch (e) { return { error: e }; } };
		const decodeNow = () => padMode
			? S.decodePad(S.readSequence(objectsOf(rd, d.things), namesOf(d.things)), padSymbols(), k)
			: S.decodeObjects(objectsOf(rd, d.things), namesOf(d.things));
		const readIt = () => {
			const objects = objectsOf(rd, d.things);
			rd.error = "";
			if (!objects.length) rd.error = t.errEmpty;
			else if (padMode && (pin.source === "file" ? !pin.file.trim() : !objectsOf(pin, padThings).length)) rd.error = t.errPadEmpty;
			else {
				try {
					if (padMode) {
						const c = S.readSequence(objects, namesOf(d.things)), p = padSymbols();
						if (c.length !== p.length) rd.error = t.errPadLength(c.length, p.length);
						else {
							try { rd.out = S.decodePad(c, p, k); }
							catch (e) { if (!(e instanceof S.DecodeError)) throw e; rd.error = t.errPadRead(c.length, len12, len24); }
						}
					} else {
						const names = namesOf(d.things);
						rd.out = S.decodeObjects(objects, names);
						// the symbols to draw by hand: as read (from the clasp), or, if a
						// misread piece was repaired, the seed's own
						const read = objects.map((o) => names.indexOf(o));
						rd.symbols = rd.out.fixed ? S.encode(rd.out.entropy, k) : rd.out.reversed ? read.reverse() : read;
						rd.hand = 0;
					}
				}
				catch (e) {
					if (e instanceof S.PadFileError) rd.error = t.errPadFile(e.code, e.line, e.detail);
					else if (/not in the dictionary/.test(e.message)) rd.error = t.errUnknown(e.message.match(/"(.*)"/)?.[1] || "");
					else rd.error = t.errRead(objects.length, len12, len24);
				}
			}
			render();
		};
		// pieces tapped (or typed) for the sequence, or for the pad's string
		const piecesInput = () => {
			if (slot.typing) {
				const area = h("textarea", { class: "input", spellcheck: "false", rows: 10, on: { input: (e) => { slot.text = e.target.value; } } });
				area.value = slot.text;
				return [hint(t.typeHelp), area,
					h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { slot.typing = false; render(); } } }, t.tapInstead))];
			}
			return [hint(onPad ? t.tapPadHelp : t.tapHelp),
				h("div", { class: "keypad" }, things.map((x, i) =>
					tint(h("button", { class: "key" + (x.colour ? " tinted" : ""), "aria-label": x.name, on: { click: () => {
						slot.taps.push(i);
						// a whole string: read the seed as soon as it gives one
						if (slot.taps.length === len12 || slot.taps.length === len24) {
							try { decodeNow(); readIt(); return; } catch (e) { /* not yet */ }
						}
						render();
					} } }, icon(x, 36), x.name), x.colour))),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { slot.taps.pop(); render(); } } }, t.undo),
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.clearAsk)) { slot.taps = []; render(); } } } }, t.clear),
					h("button", { class: "btn ghost small push", on: { click: () => { slot.typing = true; render(); } } }, t.typeInstead))];
		};
		// the pad as a file: typed, pasted or opened (it stays on this computer)
		const padFileInput = () => {
			const status = h("div", { class: "status" });
			const showState = () => {
				if (!pin.file.trim()) { status.className = "status"; status.textContent = ""; return; }
				const f = padFileState();
				status.className = "status " + (f.pad ? "ok" : "bad");
				status.textContent = f.pad ? t.padFileOk(f.pad.length) : t.errPadFile(f.error.code, f.error.line, f.error.detail);
			};
			const area = h("textarea", { class: "input", spellcheck: "false", rows: 8, placeholder: "54 16\n3A37 DFE7 0239 3E0F 6\n…",
				on: { input: (e) => { pin.file = e.target.value; showState(); } } });
			area.value = pin.file;
			showState();
			const open = h("input", { type: "file", accept: ".txt,text/plain", class: "hidden", on: { change: async (e) => {
				const f = e.target.files[0];
				if (!f) return;
				pin.file = await f.text();
				render();
			} } });
			return [hint(t.padFileReadHelp), area, status,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => open.click() } }, t.padFileOpen), open)];
		};
		// the pad's string can have its own dictionary (SPEC §11.4)
		const padDictInput = () => {
			const err = h("div");
			const open = h("input", { type: "file", accept: ".json,.txt,application/json,text/plain", class: "hidden", on: { change: async (e) => {
				const f = e.target.files[0];
				if (!f) return;
				try {
					const own = dictFromFile(await f.text(), f.name), problem = dictProblem(own);
					if (problem) { err.replaceChildren(errorBox(problem)); return; }
					if (own.length !== n) { err.replaceChildren(errorBox(t.errPadDictSize(own.length, n))); return; }
					pin.dict = own; pin.taps = [];
					render();
				} catch (x) { err.replaceChildren(errorBox(t.errDictFile)); }
			} } });
			return h("div", { class: "stack" },
				h("div", { class: "row between" }, h("span", { class: "meta", text: pin.dict ? t.padDictOwn(n) : t.padDictSame }),
					pin.dict ? h("button", { class: "btn ghost small", on: { click: () => { pin.dict = null; pin.taps = []; render(); } } }, t.padDictForget)
						: h("button", { class: "btn ghost small", on: { click: () => open.click() } }, t.padDictOpen), open),
				err);
		};
		const left = [title(t.readCard), dictLine()];
		if (padMode) {
			const padCount = pin.source === "file" ? (padFileState().pad || []).length : objectsOf(pin, padThings).length;
			left.push(modeLine(), hint(t.readPadHelp),
				seg([["seq", `${t.stringSeq} · ${objectsOf(rd, d.things).length}`], ["pad", `${t.stringPad} · ${padCount}`]], rd.which, (v) => { rd.which = v; render(); }));
			if (onPad) {
				left.push(seg([["string", t.padAsString], ["file", t.padAsFile]], pin.source, (v) => { pin.source = v; render(); }));
				if (pin.source === "file") left.push(...padFileInput());
				else left.push(padDictInput(), ...piecesInput());
			} else left.push(...piecesInput());
		} else left.push(modeLine(), ...piecesInput());

		const last = slot.taps.slice(-5);
		const right = [];
		// what was read: the string (then the seed), or the QR code by hand —
		// live while tapping, to draw it as you go, and step by step once read.
		// In pad mode the strings are not the QR code: only the seed is shown.
		const view = padMode ? "string" : rd.view || "string";
		if (!padMode && (!rd.typing || rd.out))
			right.push(seg([["string", rd.out ? t.seedFound : t.readViewString], ["hand", t.tabHand]], view, (v) => { rd.view = v; render(); }));
		if (view === "hand" && (rd.out || !rd.typing)) {
			if (rd.out) {
				const L = rd.symbols.length;
				const move = (to) => { rd.hand = Math.max(0, Math.min(L, to)); render(); };
				right.push(...handView(d, rd.symbols, S.compactSeedQR(rd.out.entropy), rd.hand || 0, move).filter(Boolean));
			} else right.push(h("div", { class: "big-total", text: t.tapped(rd.taps.length, len12, len24) }),
				...handView(d, rd.taps, null, rd.taps.length - 1, null).filter(Boolean));
		} else if (rd.out) {
			const words = S.entropyToMnemonic(rd.out.entropy).split(" ");
			right.push(h("div", { class: "result" }, h("div", { class: "result-title", text: "✓ " + t.seedFound }), seedAlert(),
				h("div", { class: "words" }, words.map((w, i) => h("div", {}, h("span", {}, i + 1), w))),
				rd.out.fixed ? h("div", { class: "note" }, t.repaired(rd.out.fixed)) : null,
				rd.out.reversed ? h("div", { class: "note" }, t.reversed) : null,
				rd.out.swapped ? h("div", { class: "note" }, t.padSwapped) : null,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { st.read = freshRead(); render(); } } }, t.clear))));
		} else if (!slot.typing && !(onPad && pin.source === "file")) right.push(
			onPad ? h("div", { class: "label", text: t.stringPad }) : padMode ? h("div", { class: "label", text: t.stringSeq }) : null,
			h("div", { class: "big-total", text: t.tapped(slot.taps.length, len12, len24) }),
			h("div", { class: "lasttaps" }, last.map((i, j) => h("span", { class: j === last.length - 1 ? "newest" : "" },
				icon(things[i], j === last.length - 1 ? 48 : 32), h("small", { text: `${slot.taps.length - last.length + j + 1}` })))),
			stringSvg(things, slot.taps));
		if (!rd.out) right.push(errorBox(rd.error), h("div", { class: "row" }, h("button", { class: "btn push", on: { click: readIt } }, t.readIt)));
		return tool(panel(...left), panel(...right));
	}

	// ---- printable sheet ----------------------------------------------
	// For whoever makes the string: what to buy and the order, with nothing
	// about what it is for, and nothing about the dictionary's order (the
	// shopping list is in alphabetical order, without numbers).
	function printSheet() {
		const t = T(), m = st.make, d = st.dict;
		if (!d || !m.symbols) { st.screen = "make"; return makeScreen(); }
		const n = d.things.length, each = S.piecesToBuy(m.symbols, n), cm = Math.ceil((m.symbols.length * 0.8 + 20) / 10) * 10;
		const shop = [...d.things].sort((a, b) => a.name.localeCompare(b.name, st.lang));
		return h("div", {},
			h("div", { class: "noprint panel print-bar" },
				h("div", { class: "alert" }, st.mode === "pad" ? t.printWarnPad : t.printWarn),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", on: { click: () => go("make") } }, "◀ " + t.back),
					h("button", { class: "btn push", on: { click: () => print() } }, t.printBtn))),
			h("div", { class: "card sheet" },
				h("h2", { text: t.sheetTitle }), h("p", { class: "help", text: t.sheetSub }),
				h("h3", { text: t.sheetShop }),
				h("p", { text: t.sheetEach(each) }),
				h("div", { class: "legend shop" }, shop.map((x) => h("span", { class: "item" }, icon(x, 34, true), x.name))),
				h("p", { text: t.sheetString(cm) }),
				h("h3", { text: t.sheetHow }),
				h("ol", { class: "how-to" }, [t.sheetStep1, t.sheetStep2, t.sheetStep3, t.sheetStep4].map((s) => h("li", { text: s }))),
				h("div", { class: "magic" }, h("div", { class: "magic-title", text: t.sheetMagicTitle }), h("p", { text: t.sheetMagic })),
				h("div", { class: "drawing-page" },
					h("h3", { text: t.sheetDrawing }),
					stringSvg(d.things, m.symbols, { paper: true, perRow: m.symbols.length > 80 ? 10 : 8 }))));
	}

	// ---- about -------------------------------------------------------
	function about() {
		const t = T();
		return h("div", { class: "page" },
			h("h2", { text: t.howTitle }),
			h("ol", { class: "how-to" }, [[t.how1, t.how1b], [t.how2, t.how2b], [t.how3, t.how3b], [t.how4, t.how4b]].map(([a, b]) => h("li", {}, h("b", { text: a }), h("span", { text: b })))),
			h("p", { class: "hint", text: t.carriers }),
			h("h2", { text: t.honestTitle }), h("p", { text: t.honest }),
			h("h2", { text: t.aboutTitle }),
			h("p", { text: t.aboutNet }),
			h("p", { text: t.aboutCheck }),
			h("pre", { class: "code" }, "macOS / Linux:  shasum -a 256 seedcraft-sequences.html\nWindows:        certutil -hashfile seedcraft-sequences.html SHA256"),
			h("p", { text: t.aboutStore }),
			h("p", { class: "hint", text: t.aboutSpec(FORMAT_VERSION) }));
	}

	// The start page's picture: the first pieces of the pretend seed "abandon … about"
	// with the example beads, threaded once from the clasp (CSS, unless reduced motion)
	function heroString() {
		const things = SETS[0].things.slice(0, 16).map((x) => ({ name: x[st.lang], emoji: x.emoji || "", colour: x.colour || "", symbol: x.symbol || "", brick: !!x.brick }));
		const test = S.mnemonicToEntropy("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
		const drawing = stringSvg(things, S.encode(test, 4, 0).slice(0, 16), { perRow: 8 });
		drawing.setAttribute("aria-hidden", "true");
		[...drawing.children].filter((e) => e.tagName === "g").forEach((g, i) => {
			g.classList.add("bead-in");
			g.style.setProperty("animation-delay", `${120 + i * 55}ms`);
		});
		return h("figure", { class: "hero-string" }, drawing, h("figcaption", { text: T().heroCaption }));
	}
	// ---- start: what Seedcraft is, how it goes, what protects what, offline use, the sister projects ----
	function intro() {
		const t = T();
		const card = (name, url, desc) => h("a", { class: "sib-card", href: url, target: "_blank", rel: "noopener noreferrer" },
			h("b", { text: name + " ↗" }), h("span", { text: desc }));
		const tryExample = () => {
			const set = SETS[0];
			setDict({ things: set.things.slice(0, 16).map((x) => ({ name: x[st.lang], emoji: x.emoji || "", colour: x.colour || "", symbol: x.symbol || "", brick: !!x.brick, photo: "" })), checked: false });
			go("make");
		};
		return h("div", { class: "intro" },
			h("section", { class: "hero" },
				h("div", { class: "hero-text" }, h("h1", { text: t.introTitle }), h("p", { class: "lead", text: t.introLead }),
					h("div", { class: "row" },
						h("button", { class: "btn big", on: { click: () => go("dict") } }, t.startDict),
						h("button", { class: "btn ghost big", on: { click: tryExample } }, t.startTry),
						h("button", { class: "btn ghost", on: { click: () => go("buy") } }, t.startBuy))),
				heroString()),
			h("section", { class: "panel" }, h("h2", { class: "panel-title", text: t.stepsTitle }),
				h("ol", { class: "steps" }, t.steps.map(([a, b], i) => h("li", {}, h("b", { text: `${i + 1}. ${a}` }), h("span", { text: b }))))),
			h("div", { class: "tool" },
				panel(h("h2", { class: "panel-title", text: t.expectTitle }),
					h("ul", { class: "list" }, t.expect.map((x) => h("li", { text: x })))),
				panel(h("h2", { class: "panel-title", text: t.safeTitle }),
					h("ul", { class: "list" }, t.safe.map((x) => h("li", { text: x }))),
					h("div", { class: "row" }, link(REPO_URL + "/releases", t.releases),
						link(REPO_URL + "/blob/main/docs/seedcraft-by-hand-" + st.lang + ".pdf", t.manual)))),
			h("section", { class: "panel" }, h("h2", { class: "panel-title", text: t.siblingsTitle }),
				h("div", { class: "sib-cards" }, SIBLINGS.map(([name, url, key]) => card(name, url, t[key])))),
			h("section", { class: "panel" }, h("h2", { class: "panel-title", text: t.supportTitle }), donateBody()));
	}

	// ---- donate ------------------------------------------------------
	const DONATE = { bitcoin: "bc1qx5snc0wlc8cg9gwxhyx27y6pkru8rnngyq7uja", lightning: "ndssigner@coinos.io",
		lnurl: "LNURL1DP68GURN8GHJ7CM0D9HX7UEWD9HJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHKUERNWD5KWMN9WGQ8XE42" };
	function copyButton(text) {
		const t = T();
		const b = h("button", { class: "btn ghost small", on: { click: async () => {
			try { await navigator.clipboard.writeText(text); }
			catch (e) { const ta = h("textarea", {}); ta.value = text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
			b.textContent = "✓ " + t.copied; setTimeout(() => { b.textContent = t.copy; }, 1500);
		} } }, t.copy);
		return b;
	}
	function donate() {
		const t = T();
		return h("div", { class: "page" }, h("h2", { text: t.donateTitle }), donateBody());
	}
	function donateBody() {
		const t = T();
		const box = (img, title, address, extra) => h("div", { class: "donate-box" },
			h("img", { src: img, alt: title, width: 160, height: 160 }), h("b", { text: title }),
			h("code", { text: address }), copyButton(address), extra || null);
		return h("div", {}, h("p", { text: t.donateText }),
			h("div", { class: "donate" },
				box(DONATE_IMAGES.bitcoin, "Bitcoin", DONATE.bitcoin),
				box(DONATE_IMAGES.lightning, "Lightning", DONATE.lightning,
					h("details", { class: "more" }, h("summary", { text: t.donateLnurl }), h("code", { class: "wrap", text: DONATE.lnurl }), copyButton(DONATE.lnurl)))),
			h("p", { class: "hint", text: t.donateMore }));
	}

	render();
})();
