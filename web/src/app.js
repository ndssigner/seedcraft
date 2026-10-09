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
	// pieces of each kind that cover 99.9 % of seeds, plus one spare, in
	// packs of 5 (SPEC §6; simulated with the reference implementation)
	const BUY = { 12: { 2: 130, 4: 45, 8: 25, 16: 15, 32: 10 }, 24: { 2: 215, 4: 70, 8: 35, 16: 20, 32: 15 } };
	const symbolsFor = (words, n) => Math.ceil((words === 12 ? 213 : 364) / Math.log2(n));

	// ---- state -------------------------------------------------------
	const st = {
		lang: (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en",
		screen: "dict",
		buy: { n: 16, words: 12 },
		dict: null,  // { things: [{ name, emoji, photo, colour, symbol }], checked }
		edit: null,  // naming in progress: { things, i } or checking: { i }
		make: { seed: "", entropy: null, symbols: null, pos: 0, tab: "walk" },
		read: { taps: [], typing: false, text: "", out: null, error: "" },
	};
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// a dictionary of another size: what was made or read with the old one
	// goes (a renamed piece changes nothing: the sequence is numbers)
	function setDict(d) {
		const same = st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (!same) {
			st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "walk" };
			st.read = { taps: [], typing: false, text: "", out: null, error: "" };
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
		const ring = opts.current ? "#f28c28" : "rgba(0,0,0,.3)", width = opts.current ? 4 : 1.2;
		if (thing.photo) {
			const id = "clip" + (++clipId);
			g.append(svg("clipPath", { id }, svg("circle", { cx: x, cy: y, r })),
				svg("image", { href: thing.photo, x: x - r, y: y - r, width: 2 * r, height: 2 * r, "clip-path": `url(#${id})`, preserveAspectRatio: "xMidYMid slice" }),
				svg("circle", { cx: x, cy: y, r, fill: "none", stroke: ring, "stroke-width": width }));
			return g;
		}
		if (thing.brick) {
			const w = r * 2, hgt = r * 1.5;
			g.append(svg("rect", { x: x - r, y: y - hgt / 2, width: w, height: hgt, rx: 4, fill: thing.colour || "#ddd", stroke: ring, "stroke-width": width }));
			for (const dx of [-r / 2, r / 2]) g.append(svg("rect", { x: x + dx - r / 4, y: y - hgt / 2 - r / 3, width: r / 2, height: r / 3, rx: 2, fill: thing.colour || "#ddd", stroke: "rgba(0,0,0,.35)" }));
		} else {
			const fill = thing.colour || (opts.dark ? "#3a332c" : "#ffffff");
			g.append(svg("circle", { cx: x, cy: y, r, fill, stroke: ring, "stroke-width": width }));
		}
		if (thing.emoji) g.append(svg("text", { x, y: y + r * 0.36, "text-anchor": "middle", "font-size": r * 1.05 }, thing.emoji));
		else if (thing.symbol) {
			const ink = lightColour(thing.colour) ? "#111111" : "#ffffff";
			g.append(svg("text", { x, y: y + r * 0.34, "text-anchor": "middle", "font-size": r * 0.95, "font-weight": 700,
				fill: ink, "font-family": "Menlo, Consolas, 'DejaVu Sans', sans-serif" }, thing.symbol + "︎"));
		} else if (thing.name) {
			const initials = thing.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
			g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * 0.8, "font-weight": 700,
				fill: opts.dark ? "#f3ece4" : "#2b2622" }, initials));
		} else g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * 0.9, fill: "#9a8f84" }, "?"));
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
	const TABS = [["buy", "tabBuy"], ["dict", "tabDict"], ["make", "tabMake"], ["read", "tabRead"]];
	const TAB_OF = { buy: "buy", dict: "dict", name: "dict", check: "dict", make: "make", print: "make", read: "read" };
	function shell() {
		const t = T();
		document.documentElement.lang = st.lang;
		$("draft").textContent = t.draft;
		$("draft").title = t.warnTest;
		$("tagline").textContent = t.subtitle;
		$("lang").textContent = t.langName;
		$("about").textContent = t.aboutTitle;
		$("donate").textContent = "💛 " + t.donateTitle;
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
	$("logo").addEventListener("click", () => go(st.dict ? "make" : "dict"));
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
		$("siblings").replaceChildren(h("span", { text: t.siblings }),
			...SIBLINGS.map(([name, url, key]) => h("span", { class: "sib" }, link(url, name, t[key]), h("span", { class: "sib-desc", text: " — " + t[key] }))));
	}
	function render() {
		shell(); online(); links();
		$("app").replaceChildren(({ buy, dict: dictScreen, name: nameScreen, check: checkScreen, make: makeScreen,
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
	const dictLine = () => {
		const t = T(), d = st.dict;
		if (!d) return h("div", { class: "note" }, t.noDict, " ", h("button", { class: "btn small", on: { click: () => go("dict") } }, t.dictCard));
		return h("div", { class: "dictline" }, h("span", { class: "minis" }, d.things.map((x) => icon(x, 22))),
			h("span", {}, t.dictSummary(d.things.length, d.checked)));
	};

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
				h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => go("dict") } }, t.tabDict + " ▶"))));
	}

	// ---- dictionary ----------------------------------------------------
	function dictFromFile(text, name) {
		if (/\.json$/i.test(name) || text.trim().startsWith("{")) {
			const j = JSON.parse(text);
			const things = (j.things || []).map((x) => ({ name: String(x.name || "").trim(), emoji: x.emoji || "",
				photo: typeof x.photo === "string" && x.photo.startsWith("data:image/") ? x.photo : "" }));
			return things;
		}
		return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((name) => ({ name, emoji: "", photo: "" }));
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
						h("button", { class: "btn", on: { click: () => { st.edit = { things: Array.from({ length: n }, () => ({ name: "", emoji: "", photo: "" })), i: 0 }; go("name"); } } }, t.dictName),
						h("button", { class: "btn ghost", on: { click: () => open.click() } }, t.dictOpen), open),
					err,
					h("details", { class: "more" }, h("summary", { text: t.dictExample }), hint(t.dictExampleHelp), example)),
				panel(h("p", { text: t.dictIntro }), h("ol", { class: "how-to" }, t.dictChecks.map((x) => h("li", { text: x })))));
		}
		const json = () => JSON.stringify({ format: "seedcraft-dictionary", version: 0,
			things: d.things.map((x) => Object.fromEntries(Object.entries({ name: x.name, emoji: x.emoji, photo: x.photo }).filter(([, v]) => v))) }, null, 1);
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
					h("button", { class: "btn push", on: { click: () => go("make") } }, t.tabMake + " ▶"))));
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
				h("div", { class: "row" },
					h("label", { class: "field" }, h("span", { class: "label", text: t.thingEmoji }), emojiIn),
					h("button", { class: "btn ghost small", on: { click: () => photoIn.click() } }, x.photo ? "📷 " + t.photoAgain : "📷 " + t.photoTake),
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
	function makeScreen() {
		const t = T(), m = st.make, d = st.dict;
		if (!d) return h("div", { class: "narrow" }, panel(title(t.makeCard), dictLine()));
		const n = d.things.length, k = Math.log2(n);
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
				panel(title(t.makeCard), seedAlert(),
					field(t.seedTitle, hint(t.seedHelp),
						h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => test(16) } }, t.seedTest12),
							h("button", { class: "btn ghost small", on: { click: () => test(32) } }, t.seedTest24)),
						area, status),
					err,
					h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => {
						if (!check()) { err.replaceChildren(errorBox(t.errWords)); return; }
						m.entropy = S.mnemonicToEntropy(m.seed);
						m.symbols = S.encode(m.entropy, k);
						m.pos = 0; m.tab = "walk";
						render();
					} } }, t.makeIt + " ▶"))),
				panel(field(t.tabDict, dictLine())));
		}
		const L = m.symbols.length, each = S.piecesToBuy(m.symbols, n), cm = Math.ceil((L * 0.8 + 20) / 10) * 10;
		const views = [["walk", t.tabWalk], ["drawing", t.tabDrawing], ["list", t.tabList], ["qr", t.tabQr]];
		const view = h("div", { class: "stack" });
		if (m.tab === "walk") {
			const thing = (i) => d.things[m.symbols[i]];
			const move = (to) => { m.pos = Math.max(0, Math.min(L - 1, to)); render(); };
			const side = (i, label) => h("div", { class: "side" }, i >= 0 && i < L ? [hint(`${label} · ${i + 1}`), icon(thing(i), 44), h("div", { class: "small-name", text: thing(i).name })] : null);
			view.append(
				h("div", { class: "row between" }, h("span", { class: "label", text: t.walkOf(m.pos + 1, L) }), hint(t.walkHelp)),
				h("div", { class: "wizard" }, side(m.pos - 1, t.prevPiece), h("div", { class: "centre" }, icon(thing(m.pos), 104), h("div", { class: "name", text: thing(m.pos).name })), side(m.pos + 1, t.nextPiece)),
				bar((m.pos + 1) / L),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", disabled: m.pos === 0 ? "" : undefined, on: { click: () => move(m.pos - 1) } }, "◀ " + t.prevPiece),
					h("button", { class: "btn push", on: { click: () => m.pos < L - 1 ? move(m.pos + 1) : null } }, m.pos < L - 1 ? t.nextPiece + " ▶" : "✓ " + t.done)),
				stringSvg(d.things, m.symbols, { current: m.pos, onPick: (i) => move(i) }));
		}
		if (m.tab === "drawing") view.append(hint(t.stringHelp), stringSvg(d.things, m.symbols));
		if (m.tab === "list") {
			const text = m.symbols.map((s, i) => `${i + 1}. ${d.things[s].name}`).join("\n");
			view.append(hint(t.listHelp), h("pre", { class: "code", text }),
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(text + "\n", "sequence.txt", "text/plain") } }, t.saveList)));
		}
		if (m.tab === "qr") view.append(h("div", { class: "qrbox" }, qrSvg(S.compactSeedQR(m.entropy)), hint(t.qrHelp)));
		return tool(
			panel(title(t.makeCard), dictLine(),
				h("div", { class: "big-total", text: t.total(L) }),
				h("p", { text: t.shop(each, n, cm) }),
				h("div", { class: "alert", text: t.makeWarn }),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { m.symbols = null; m.entropy = null; render(); } } }, "◀ " + t.otherSeed),
					h("button", { class: "btn ghost small", on: { click: () => go("print") } }, t.printIt),
					h("button", { class: "btn ghost small", on: { click: () => { st.read = { taps: [], typing: false, text: "", out: null, error: "" }; go("read"); } } }, t.readCheck))),
			panel(seg(views, m.tab, (v) => { m.tab = v; render(); }), view));
	}

	// keyboard for the step-by-step view
	addEventListener("keydown", (e) => {
		if (st.screen !== "make" || st.make.tab !== "walk" || !st.make.symbols || /input|textarea/i.test(e.target.tagName)) return;
		if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); st.make.pos = Math.min(st.make.symbols.length - 1, st.make.pos + 1); render(); }
		if (e.key === "ArrowLeft") { st.make.pos = Math.max(0, st.make.pos - 1); render(); }
	});

	// ---- read --------------------------------------------------------
	function readScreen() {
		const t = T(), rd = st.read, d = st.dict;
		if (!d) return h("div", { class: "narrow" }, panel(title(t.readCard), dictLine()));
		const n = d.things.length, len12 = symbolsFor(12, n), len24 = symbolsFor(24, n);
		const readIt = () => {
			const objects = rd.typing
				? rd.text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim().toLowerCase()).filter(Boolean)
				: rd.taps.map((i) => d.things[i].name.toLowerCase());
			rd.error = "";
			if (!objects.length) rd.error = t.errEmpty;
			else {
				try { rd.out = S.decodeObjects(objects, d.things.map((x) => x.name.toLowerCase())); }
				catch (e) { rd.error = /not in the dictionary/.test(e.message) ? t.errUnknown(e.message.match(/"(.*)"/)?.[1] || "") : t.errRead(objects.length, len12, len24); }
			}
			render();
		};
		let input;
		if (!rd.typing) {
			input = [hint(t.tapHelp),
				h("div", { class: "keypad" }, d.things.map((x, i) =>
					h("button", { class: "key", "aria-label": x.name, on: { click: () => {
						rd.taps.push(i);
						if (rd.taps.length === len12 || rd.taps.length === len24) {
							try { S.decodeObjects(rd.taps.map((j) => d.things[j].name), d.things.map((y) => y.name)); readIt(); return; } catch (e) { /* not yet */ }
						}
						render();
					} } }, icon(x, 36), x.name))),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { rd.taps.pop(); render(); } } }, t.undo),
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.clearAsk)) { rd.taps = []; render(); } } } }, t.clear),
					h("button", { class: "btn ghost small push", on: { click: () => { rd.typing = true; render(); } } }, t.typeInstead))];
		} else {
			const area = h("textarea", { class: "input", spellcheck: "false", rows: 10, on: { input: (e) => { rd.text = e.target.value; } } });
			area.value = rd.text;
			input = [hint(t.typeHelp), area,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { rd.typing = false; render(); } } }, t.tapInstead))];
		}
		const last = rd.taps.slice(-5);
		const right = [];
		if (rd.out) {
			const words = S.entropyToMnemonic(rd.out.entropy).split(" ");
			right.push(h("div", { class: "result" }, h("div", { class: "result-title", text: "✓ " + t.seedFound }), seedAlert(),
				h("div", { class: "words" }, words.map((w, i) => h("div", {}, h("span", {}, i + 1), w))),
				rd.out.fixed ? h("div", { class: "note" }, t.repaired(rd.out.fixed)) : null,
				rd.out.reversed ? h("div", { class: "note" }, t.reversed) : null,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { st.read = { taps: [], typing: false, text: "", out: null, error: "" }; render(); } } }, t.clear))));
		} else {
			if (!rd.typing) right.push(
				h("div", { class: "big-total", text: t.tapped(rd.taps.length, len12, len24) }),
				h("div", { class: "lasttaps" }, last.map((i, j) => h("span", { class: j === last.length - 1 ? "newest" : "" },
					icon(d.things[i], j === last.length - 1 ? 48 : 32), h("small", { text: `${rd.taps.length - last.length + j + 1}` })))),
				stringSvg(d.things, rd.taps));
			right.push(errorBox(rd.error), h("div", { class: "row" }, h("button", { class: "btn push", on: { click: readIt } }, t.readIt)));
		}
		return tool(panel(title(t.readCard), dictLine(), ...input), panel(...right));
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
				h("div", { class: "alert" }, t.printWarn),
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
			h("ol", { class: "how-to" }, [[t.how1, t.how1b], [t.how2, t.how2b], [t.how3, t.how3b], [t.how4, t.how4b]].map(([a, b]) => h("li", {}, h("b", { text: a }), " — " + b))),
			h("p", { class: "hint", text: t.carriers }),
			h("h2", { text: t.honestTitle }), h("p", { text: t.honest }),
			h("h2", { text: t.aboutTitle }),
			h("p", { text: t.aboutNet }),
			h("p", { text: t.aboutCheck }),
			h("pre", { class: "code" }, "macOS / Linux:  shasum -a 256 seedcraft-sequences.html\nWindows:        certutil -hashfile seedcraft-sequences.html SHA256"),
			h("p", { text: t.aboutStore }),
			h("p", { class: "hint", text: t.aboutSpec(FORMAT_VERSION) }));
	}

	// ---- donate ------------------------------------------------------
	const DONATE = { bitcoin: "bc1qx5snc0wlc8cg9gwxhyx27y6pkru8rnngyq7uja", lightning: "ndssigner@coinos.io",
		lnurl: "LNURL1DP68GURN8GHJ7CM0D9HX7UEWD9HJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHKUERNWD5KWMN9WGQ8XE42" };
	function copyButton(text) {
		const t = T();
		const b = h("button", { class: "btn ghost small", on: { click: async () => {
			try { await navigator.clipboard.writeText(text); }
			catch (e) { const ta = h("textarea", {}); ta.value = text; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
			b.textContent = "✓ " + t.copied; setTimeout(() => { b.textContent = "📋 " + t.copy; }, 1500);
		} } }, "📋 " + t.copy);
		return b;
	}
	function donate() {
		const t = T();
		const box = (img, title, address, extra) => h("div", { class: "donate-box" },
			h("img", { src: img, alt: title, width: 180, height: 180 }), h("b", { text: title }),
			h("code", { text: address }), copyButton(address), extra || null);
		return h("div", { class: "page" },
			h("h2", { text: t.donateTitle }), h("p", { text: t.donateText }),
			h("div", { class: "donate" },
				box(DONATE_IMAGES.bitcoin, "Bitcoin", DONATE.bitcoin),
				box(DONATE_IMAGES.lightning, "Lightning", DONATE.lightning,
					h("details", { class: "more" }, h("summary", { text: t.donateLnurl }), h("code", { class: "wrap", text: DONATE.lnurl }), copyButton(DONATE.lnurl)))),
			h("p", { class: "hint", text: t.donateMore }));
	}

	render();
})();
