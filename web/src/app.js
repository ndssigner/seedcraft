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
	// the same for both strings of pad mode (SPEC §10.6); for a pad-mode
	// sequence alone, the table above, except N = 2 with 12 words: 135
	const PAD_BUY = { 12: { 2: 250, 4: 80, 8: 35, 16: 20, 32: 15 }, 24: { 2: 410, 4: 125, 8: 55, 16: 30, 32: 20 } };
	const buyFor = (words, n, mode, padAs) => mode === "pad" && padAs === "string" ? PAD_BUY[words][n]
		: mode === "pad" && words === 12 && n === 2 ? 135 : BUY[words][n];
	const symbolsFor = (words, n) => Math.ceil((words === 12 ? 213 : 364) / Math.log2(n));
	// The forms of SPEC §11.2, as data: the recommended N, how the pieces are
	// drawn (strung on a thread, in rows, or written as entries), the example
	// dictionary, whether the form keeps its order, centimetres per piece for
	// strung ones. Their words are in SEEDCRAFT_TEXT[lang].forms.
	const FORMS = [
		{ id: "book", exampleFirst: true, n: 8, family: "written", set: "streets", keeps: true },
		{ id: "stickers", n: 16, family: "rows", set: "charms", keeps: true },
		{ id: "photos", exampleFirst: true, n: 8, family: "rows", set: "photos", keeps: true },
		{ id: "necklace", n: 16, family: "strung", set: "beads", keeps: true, cm: 0.8 },
		{ id: "gems", n: 8, family: "strung", set: "gems", keeps: true, cm: 0.6 },
		{ id: "bricks", n: 16, family: "rows", set: "bricks", keeps: true },
		{ id: "books", exampleFirst: true, n: 8, family: "rows", set: "authors", keeps: false },
		{ id: "cards", exampleFirst: true, n: 4, family: "rows", set: "suits", keeps: false },
		{ id: "other", n: 16, family: "rows", set: null, keeps: true },
	];
	const formOf = (id) => FORMS.find((f) => f.id === id) || FORMS[2];
	// playing cards: four decks for 12 words, six for 24 (SPEC §11.2)
	const materialsOf = (id, L, n) => {
		const f = formOf(id), words = L > symbolsFor(12, n) ? 24 : 12;
		return T().forms[id].materials(L, f.cm ? Math.ceil((L * f.cm + 20) / 10) * 10 : 0, words === 12 ? 4 : 6);
	};

	// ---- state -------------------------------------------------------
	const st = {
		lang: (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en",
		screen: "intro",  // intro, make, read, print, about, donate
		// the two journeys, each a sequence of steps (see MAKE_STEPS, READ_STEPS)
		step: { make: "plan", read: "have" },
		plan: { words: 12, n: 16, padAs: "string", form: "necklace", padForm: null },  // padForm: the pad's own form, if another
		padDict: null,  // the pad's own dictionary, when it is another collection (SPEC §11.4)
		dict: null,  // { things: [{ name, emoji, photo, colour, symbol }], checked }
		edit: null,  // the dictionary being named: { kind: "name", things, i }, or checked: { kind: "check", i }
		mode: null,  // "basic" or "pad" (SPEC §10), chosen before making or reading
		make: { seed: "", entropy: null, symbols: null, pos: 0, tab: "walk" },
		read: freshRead(),
	};
	// what is being read: the sequence (taps, typing, text, as before) and, in
	// pad mode, the pad (padIn: as a string of things, or as a file's text)
	function freshRead(padAs = "string") {
		return { taps: [], typing: false, text: "", out: null, error: "", which: "seq",
			padIn: { source: padAs, taps: [], typing: false, text: "", file: "", dict: null } };
	}
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// a dictionary of another size: what was made or read with the old one
	// goes (a renamed piece changes nothing: the sequence is numbers)
	function setDict(d) {
		const same = st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (d) st.plan.n = d.things.length;
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
	// a piece's symbol: an emoji, or a few letters; by default its name's
	// initials (a one-word name, its first three letters: Square and Street must differ)
	const PICTOGRAPH = /\p{Extended_Pictographic}/u;
	const initialsOf = (name) => {
		const words = (name || "").trim().split(/\s+/).filter(Boolean);
		return !words.length ? "" : words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 2).toUpperCase() : words[0].slice(0, 3);
	};
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
		} else if (opts.tile) {
			const fill = thing.colour || (opts.dark ? "#222c2b" : "#ffffff");
			g.append(svg("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: r / 4, fill, stroke: ring, "stroke-width": width, class: cur }));
		} else {
			const fill = thing.colour || (opts.dark ? "#222c2b" : "#ffffff");
			g.append(svg("circle", { cx: x, cy: y, r, fill, stroke: ring, "stroke-width": width, class: cur }));
		}
		if (thing.emoji && PICTOGRAPH.test(thing.emoji)) g.append(svg("text", { x, y: y + r * 0.36, "text-anchor": "middle", "font-size": r * 1.05 }, thing.emoji));
		else if (thing.symbol && !thing.emoji) {
			const ink = lightColour(thing.colour) ? "#111111" : "#ffffff";
			g.append(svg("text", { x, y: y + r * 0.34, "text-anchor": "middle", "font-size": r * 0.95, "font-weight": 700,
				fill: ink, "font-family": "Menlo, Consolas, 'DejaVu Sans', sans-serif" }, thing.symbol + "︎"));
		} else if (thing.name || thing.emoji) {
			const initials = thing.emoji || initialsOf(thing.name);
			g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * (initials.length > 3 ? 0.5 : initials.length > 2 ? 0.62 : 0.8), "font-weight": 700,
				fill: thing.colour ? (lightColour(thing.colour) ? "#111111" : "#ffffff") : opts.dark ? "#e2eae7" : "#1c2826" }, initials));
		} else g.append(svg("text", { x, y: y + r * 0.3, "text-anchor": "middle", "font-size": r * 0.9, fill: "#8e9693" }, "?"));
		return g;
	}
	function icon(thing, size = 34, paper = false, current = false) {
		const s = svg("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, class: "icon" });
		s.append(bead(thing, size / 2, size / 2 + (thing.brick ? 2 : 0), size / 2 - 3, { dark: !paper && darkScreen(), current }));
		return s;
	}

	// The whole sequence: pieces on a thread that snakes row by row (the
	// thread is the order, whatever the form). opts: paper (tick boxes),
	// perRow, current (highlighted), onPick(i), pad (the pad's thread), form
	// (its start and end, and tiles for forms in rows).
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
		root.append(svg("path", { class: "thread" + (opts.pad ? " pad" : ""), d }));
		const f = opts.form && formOf(opts.form), w = opts.form && T().forms[opts.form];
		root.append(svg("text", { x: sx - 34, y: sy + 7, "text-anchor": "middle", "font-size": 20 }, !f || f.family === "strung" ? "🔒" : "★"));
		root.append(svg("text", { class: "tag", x: sx - 34, y: sy + 30, "text-anchor": "middle" }, w ? w.start : T().clasp));
		root.append(svg("circle", { class: "knot" + (opts.pad ? " pad" : ""), cx: ex + (lastRight ? 32 : -32), cy: ey, r: 6 }));
		root.append(svg("text", { class: "tag", x: ex + (lastRight ? 32 : -32), y: ey + 26, "text-anchor": "middle" }, w ? w.end : T().end));
		const dark = !opts.paper && darkScreen(), tile = !!f && f.family === "rows";
		sequence.forEach((idx, i) => {
			const [x, y] = pos(i);
			const g = bead(things[idx], x, y, r, { dark, current: i === opts.current, tile });
			g.append(svg("title", {}, `${i + 1}: ${things[idx].name}`));
			if (opts.onPick) { g.setAttribute("class", "pick"); g.addEventListener("click", () => opts.onPick(i)); }
			if (opts.paper) root.append(svg("rect", { class: "tick", x: x - 13, y: y + r + 3, width: 26, height: 16, rx: 4 }));
			root.append(g, svg("text", { class: "n" + (i === opts.current ? " leg" : ""), x, y: y + r + 15, "text-anchor": "middle" }, i + 1));
		});
		return root;
	}

	// An address book's entries, as ruled lines: the number, a blank for any
	// name and number, and the kind of street. Same options as stringSvg.
	function entriesList(things, sequence, opts = {}) {
		return h("ol", { class: "entries" + (opts.paper ? " paper" : "") + (opts.pad ? " pad" : "") }, sequence.map((idx, i) =>
			h("li", { class: i === opts.current ? "on" : null, on: opts.onPick ? { click: () => opts.onPick(i) } : null },
				h("span", { class: "n", text: String(i + 1) }), h("span", { class: "blank" }), h("b", { text: things[idx].name }),
				opts.paper ? h("span", { class: "tick" }) : null)));
	}
	const drawSeq = (things, sequence, opts = {}) =>
		opts.form && formOf(opts.form).family === "written" ? entriesList(things, sequence, opts) : stringSvg(things, sequence, opts);

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

	// ---- illustrations ---------------------------------------------------
	// Small drawings that show what each choice is: the modes, the forms, the
	// key as things or as a file. Line work in the page's ink and threads;
	// the pieces in the example beads' colours. Decorative to a screen reader:
	// the text next to each says the same.
	const ART_COLOURS = ["#d32f2f", "#1e4fd8", "#fbc02d", "#2e7d32", "#7b1fa2", "#f57c00", "#00897b", "#d81b60"];
	const artCol = (i) => ART_COLOURS[i % ART_COLOURS.length];
	function art(name) {
		const g = [];
		const S = (tag, a, ...c) => svg(tag, a, ...c);
		const beads = (y, n, x0, dx, r, cls) => { for (let i = 0; i < n; i++) g.push(S("circle", { cx: x0 + i * dx, cy: y, r, fill: artCol(i * 3 + (cls ? 1 : 0)), class: "art-piece" })); };
		const lock = (x, y) => g.push(S("rect", { x: x - 7, y: y - 2, width: 14, height: 11, rx: 2, class: "art-ink-fill" }),
			S("path", { d: `M${x - 4},${y - 2} v-4 a4,4 0 0 1 8,0 v4`, class: "art-ink" }));
		const key = (x, y) => g.push(S("circle", { cx: x - 6, cy: y, r: 5, class: "art-pad-line" }),
			S("path", { d: `M${x - 1},${y} h12 m-4,0 v4 m-4,-4 v3`, class: "art-pad-line" }));
		switch (name) {
			case "basic":
				g.push(S("path", { d: "M18,45 C50,20 110,20 142,45", class: "art-thread" }));
				for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7, x = 18 + t * 124, y = 45 - Math.sin(t * Math.PI) * 19; g.push(S("circle", { cx: x, cy: y, r: 7, fill: artCol(i), class: "art-piece" })); }
				lock(12, 50);
				g.push(S("text", { x: 80, y: 74, class: "art-label", "text-anchor": "middle" }, "= 🌱"));
				break;
			case "pad":
				g.push(S("path", { d: "M20,26 H128", class: "art-thread" }), S("path", { d: "M20,62 H128", class: "art-thread pad" }));
				beads(26, 7, 30, 15, 6, 0); beads(62, 7, 30, 15, 6, 1);
				lock(142, 22); key(146, 62);
				g.push(S("text", { x: 80, y: 49, class: "art-label", "text-anchor": "middle" }, "+"));
				break;
			case "book":
				g.push(S("path", { d: "M80,14 C66,8 40,8 22,12 V78 C40,74 66,74 80,80 C94,74 120,74 138,78 V12 C120,8 94,8 80,14 Z", class: "art-paper" }),
					S("path", { d: "M80,14 V80", class: "art-ink" }));
				for (let i = 0; i < 6; i++) g.push(S("path", { d: `M30,${24 + i * 9} H${70 - (i % 2) * 10}`, class: "art-line" }), S("path", { d: `M90,${24 + i * 9} H${130 - (i % 3) * 8}`, class: "art-line" }));
				g.push(S("rect", { x: 138, y: 18, width: 7, height: 10, rx: 2, fill: artCol(1) }), S("rect", { x: 138, y: 32, width: 7, height: 10, rx: 2, fill: artCol(2) }),
					S("path", { d: "M52,42 H70", class: "art-mark" }));
				break;
			case "stickers":
				g.push(S("rect", { x: 34, y: 8, width: 92, height: 76, rx: 4, class: "art-paper" }));
				for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.push(S("rect", { x: 42 + c * 20, y: 16 + r * 22, width: 15, height: 15, rx: 4, fill: artCol(r * 4 + c), class: "art-piece" }));
				break;
			case "necklace":
				g.push(S("path", { d: "M30,14 C30,90 130,90 130,14", class: "art-thread" }));
				for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, a = Math.PI * t, x = 80 - Math.cos(a) * 50, y = 14 + Math.sin(a) * 56; g.push(S("circle", { cx: x, cy: y, r: 6.5, fill: artCol(i), class: "art-piece" })); }
				lock(30, 12);
				break;
			case "gems":
				g.push(S("path", { d: "M14,46 H146", class: "art-thread" }));
				for (let i = 0; i < 7; i++) { const x = 24 + i * 19; g.push(S("path", { d: `M${x},36 l7,4 v12 l-7,4 l-7,-4 v-12 z`, fill: artCol(i + 2), class: "art-piece" }), S("path", { d: `M${x - 7},40 l7,4 l7,-4 M${x},44 v12`, class: "art-facet" })); }
				break;
			case "bricks":
				for (let r = 0; r < 4; r++) for (let c = 0; c < 3 - (r % 2); c++) {
					const x = 44 + c * 26 + (r % 2) * 13, y = 70 - r * 16;
					g.push(S("rect", { x, y, width: 24, height: 13, rx: 2, fill: artCol(r * 3 + c), class: "art-piece" }),
						S("rect", { x: x + 4, y: y - 3, width: 5, height: 3, fill: artCol(r * 3 + c) }), S("rect", { x: x + 15, y: y - 3, width: 5, height: 3, fill: artCol(r * 3 + c) }));
				}
				break;
			case "photos":
				g.push(S("rect", { x: 22, y: 8, width: 116, height: 76, rx: 4, class: "art-paper" }));
				for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
					const x = 30 + c * 36, y = 16 + r * 34;
					g.push(S("rect", { x, y, width: 30, height: 26, rx: 2, fill: artCol(r * 3 + c), opacity: ".22" }), S("rect", { x, y, width: 30, height: 26, rx: 2, class: "art-frame" }),
						S("path", { d: `M${x + 3},${y + 22} l8,-9 l6,6 l4,-4 l6,7`, class: "art-ink" }), S("circle", { cx: x + 22, cy: y + 7, r: 3, fill: artCol(r * 3 + c) }));
				}
				break;
			case "other":
				g.push(S("path", { d: "M14,46 H146", class: "art-thread" }),
					S("circle", { cx: 34, cy: 46, r: 9, fill: artCol(0), class: "art-piece" }), S("rect", { x: 52, y: 37, width: 18, height: 18, rx: 3, fill: artCol(1), class: "art-piece" }),
					S("path", { d: "M90,36 l10,19 h-20 z", fill: artCol(2), class: "art-piece" }), S("text", { x: 124, y: 54, class: "art-label", "text-anchor": "middle" }, "?"));
				break;
			case "books":
				g.push(S("path", { d: "M14,78 H146", class: "art-ink" }));
				[[24, 14, 0], [40, 10, 0], [52, 16, 0], [70, 12, 18], [92, 14, 0], [108, 10, -12], [124, 14, 0]].forEach(([x, w, rot], i) =>
					g.push(S("rect", { x, y: 26, width: w, height: 52, rx: 2, fill: artCol(i), class: "art-piece", transform: rot ? `rotate(${rot} ${x + w / 2} 78)` : null })));
				break;
			case "cards":
				[-24, -8, 8, 24].forEach((rot, i) => g.push(S("rect", { x: 66, y: 16, width: 30, height: 44, rx: 4, class: "art-card", transform: `rotate(${rot} 81 80)` }),
					S("text", { x: 72, y: 32, class: "art-suit", fill: i % 2 ? "#d32f2f" : "currentColor", transform: `rotate(${rot} 81 80)` }, ["♣", "♦", "♥", "♠"][i])));
				break;
			case "keyThings":
				g.push(S("path", { d: "M14,46 H130", class: "art-thread pad" }));
				beads(46, 7, 26, 15, 6.5, 1);
				key(144, 46);
				break;
			case "keyFile":
				g.push(S("path", { d: "M50,8 H100 L114,22 V84 H50 Z", class: "art-paper" }), S("path", { d: "M100,8 V22 H114", class: "art-ink" }));
				for (let i = 0; i < 5; i++) g.push(S("text", { x: 57, y: 34 + i * 11, class: "art-mono" }, ["3A37 DFE7 6", "A6C8 BBC2 2", "BBED 2CF3 2", "413D F4 5", ""][i]));
				key(130, 70);
				break;
		}
		return svg("svg", { class: "art", viewBox: "0 0 160 90", "aria-hidden": "true" }, ...g);
	}

	// ---- shell -------------------------------------------------------
	const TABS = [["intro", "tabIntro"], ["make", "tabMakeFlow"], ["read", "tabReadFlow"]];
	const TAB_OF = { intro: "intro", make: "make", print: "make", read: "read" };
	function shell() {
		const t = T();
		document.documentElement.lang = st.lang;
		$("draft").textContent = t.draft;
		$("draft").title = t.warnTest;
		$("tagline").textContent = t.subtitle;
		$("lang").textContent = t.langName;
		$("about").textContent = t.aboutTitle;
		$("donate").textContent = t.donateTitle;
		$("tabs").replaceChildren(...TABS.map(([name, label]) => h("button", { class: TAB_OF[st.screen] === name ? "on" : "", on: { click: () => go(name) } }, t[label])));
	}
	// the connection, always in sight; the warnings themselves appear next to a seed (seedAlert)
	const online = () => {
		const t = T(), on = navigator.onLine;
		$("net").className = "net " + (on ? "on" : "off");
		$("net").textContent = on ? t.netOn : t.netOff;
		$("net-why").replaceChildren(h("b", { text: on ? t.netOnTitle : t.netOffTitle }), h("div", { text: on ? t.netOnWhy : t.netOffWhy }));
	};
	const seedAlert = () => h("div", { class: "alert" }, navigator.onLine ? T().seedOnline : T().seedTest);
	// a seed's fingerprint (BIP-32, no passphrase), as wallets show it; worked out once per seed
	const fingerprints = new Map();
	function fingerprintLine(entropy) {
		const key = [...entropy].join();
		if (!fingerprints.has(key)) fingerprints.set(key, S.fingerprint(S.entropyToMnemonic(entropy)));
		return h("div", { class: "fingerprint" }, h("span", { text: T().fingerprint }), h("code", { text: fingerprints.get(key) }),
			h("span", { class: "hint", text: T().fingerprintHelp }));
	}
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
	let lastView = "";
	function render() {
		shell(); online(); links();
		// the journeys fill the window exactly on a computer (CSS): no page to scroll
		document.body.classList.toggle("in-flow", st.screen === "make" || st.screen === "read");
		// what scrolls inside the page (the map, the two columns) keeps its place across a redraw
		const SCROLLERS = ".map, .flow-body, .flow-body .tool > .panel";
		const view = [st.screen, st.step[st.screen], st.make.tab, st.make.padTab, st.plan.sub, st.edit && st.edit.kind].join();
		const kept = view === lastView ? [...$("app").querySelectorAll(SCROLLERS)].map((e) => e.scrollTop) : [];
		lastView = view;
		$("app").replaceChildren(({ intro, make: makeFlow, read: readFlow, print: printSheet, about, donate })[st.screen]());
		// on a narrow screen the journey scrolls: keep the current step in view
		const j = $("app").querySelector(".journey"), on = j && j.querySelector("li.on");
		if (on && j.scrollWidth > j.clientWidth) j.scrollLeft = on.offsetLeft + on.offsetWidth / 2 - j.clientWidth / 2;
		[...$("app").querySelectorAll(SCROLLERS)].forEach((e, i) => { if (kept[i] !== undefined) e.scrollTop = kept[i]; });
		// the step by step's drawing then glides from where it was to keep the current piece in the middle
		const map = $("app").querySelector(".map"), cur = map && map.querySelector(".ring-cur, li.on");
		if (cur) {
			const to = map.scrollTop + cur.getBoundingClientRect().top - map.getBoundingClientRect().top - map.clientHeight / 2 + cur.getBoundingClientRect().height / 2;
			map.scrollTo({ top: to, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
		}
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
		if (!d) return h("div", { class: "note" }, t.noDict, " ", h("button", { class: "btn small", on: { click: () => toStep(st.screen === "read" ? "read" : "make", st.screen === "read" ? "have" : "dict") } }, t.dictCard));
		return h("div", { class: "dictline" }, h("span", { class: "minis" }, d.things.map((x) => icon(x, 22))),
			h("span", {}, t.dictSummary(d.things.length, d.checked)));
	};
	// the two modes (SPEC §10, §11.1), chosen before making or reading: what
	// each one keeps safe, and what it doesn't. Changing it starts over.
	function setMode(mode) {
		st.mode = mode;
		st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "walk" };
		st.read = freshRead(st.plan.padAs);
		st.step.read = "have";
		render();
	}
	function modeChoice(then) {
		const t = T();
		const option = (mode, name, points) => h("button", { class: "mode" + (st.mode === mode ? " on" : ""), "aria-pressed": String(st.mode === mode),
			on: { click: () => { setMode(mode); if (then) then(); } } },
			art(mode), h("b", { text: name }), h("span", { class: "points" }, points.map((x) => h("span", { text: x }))));
		return panel(hint(t.modeHelp),
			h("div", { class: "modes" }, option("basic", t.modeBasic, t.modeBasicPoints), option("pad", t.modePad, t.modePadPoints)), hint(t.modeMore));
	}


	// ---- the two journeys ----------------------------------------------
	// Making a backup and reading one: each a sequence of steps along a thread,
	// a knot per step, filled once that step has done its job. The pad's step
	// is on its own thread colour, as the pad is drawn everywhere.
	const MAKE_STEPS = ["plan", "gather", "dict", "seq", "pad", "check", "store"];
	const READ_STEPS = ["have", "seq", "pad", "seed"];
	const stepsOf = (flow) => (flow === "make" ? MAKE_STEPS : READ_STEPS).filter((x) => x !== "pad" || st.mode === "pad");
	const stepName = (flow, step) => (flow === "make" ? T().makeSteps[MAKE_STEPS.indexOf(step)] : T().readSteps[READ_STEPS.indexOf(step)])[0];
	function toStep(flow, step) { st.step[flow] = step; st.edit = null; go(flow); }
	function stepDone(flow, step) {
		const m = st.make, rd = st.read;
		if (flow === "make") return ({ plan: !!st.mode, gather: !!st.gathered, dict: !!st.dict && st.dict.checked, seq: !!m.symbols,
			pad: !!m.symbols && !!m.padKept, check: !!m.checked, store: !!m.stored })[step];
		return ({ have: !!st.mode && !!st.dict, seq: rd.taps.length > 0 || !!rd.text.trim(),
			pad: rd.padIn.taps.length > 0 || !!rd.padIn.text.trim() || !!rd.padIn.file.trim(), seed: !!rd.out })[step];
	}
	function journey(flow) {
		const t = T(), steps = stepsOf(flow);
		return h("nav", { class: "journey" + (flow === "read" ? " short" : ""), "aria-label": flow === "make" ? t.tabMakeFlow : t.tabReadFlow },
			h("ol", {}, steps.map((step, i) => {
				const cur = st.step[flow] === step;
				return h("li", { class: [cur ? "on" : "", stepDone(flow, step) ? "done" : "", step === "pad" ? "pad" : ""].filter(Boolean).join(" ") },
					h("button", { "aria-current": cur ? "step" : null, on: { click: () => toStep(flow, step) } },
						h("span", { class: "knot", "aria-hidden": "true" }),
						h("span", { class: "step-name" }, h("small", { text: String(i + 1) }), stepName(flow, step))));
			})));
	}
	// Back and on along the journey, always in the same place: a bar at the
	// foot of the page. Each step says, while it is drawn, how the bar
	// behaves: setNav({ ready (false: next waits), onNext, prev / next:
	// [label, go] instead of the journey's own, hidden }).
	let navOpts = {};
	const setNav = (opts) => { navOpts = opts; return null; };
	function stepNav(flow, opts = {}) {
		if (opts.hidden) return null;
		const s = stepsOf(flow), i = s.indexOf(st.step[flow]), prev = s[i - 1], next = s[i + 1];
		const back = opts.prev !== undefined ? opts.prev : prev ? ["◀ " + stepName(flow, prev), () => toStep(flow, prev)] : null;
		const on = opts.next !== undefined ? opts.next : next ? [stepName(flow, next) + " ▶", () => { if (opts.onNext) opts.onNext(); toStep(flow, next); }] : null;
		return h("nav", { class: "flow-nav", "aria-label": T().stepsNav }, h("div", { class: "flow-nav-in" },
			back ? h("button", { class: "btn ghost", on: { click: back[1] } }, back[0]) : h("span"),
			on ? h("button", { class: "btn", disabled: opts.ready === false ? "" : undefined, on: { click: on[1] } }, on[0]) : h("span")));
	}
	// a step that cannot start yet says which one comes first
	function needFirst(flow, step) {
		let need = null;
		if (flow === "make") {
			if (step !== "plan" && step !== "store" && !st.mode) need = "plan";
			else if (["seq", "pad", "check"].includes(step) && !st.dict) need = "dict";
			else if (["pad", "check"].includes(step) && !st.make.symbols) need = "seq";
		} else if (step !== "have" && (!st.mode || !st.dict)) need = "have";
		if (!need) return null;
		setNav({ hidden: true });
		return h("div", { class: "narrow" }, panel(title(stepName(flow, step)), h("p", { text: T().needFirst(stepName(flow, need)) }),
			h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => toStep(flow, need) } }, stepName(flow, need) + " ▶"))));
	}
	function makeFlow() {
		if (!stepsOf("make").includes(st.step.make)) st.step.make = "plan";
		const step = st.step.make;
		navOpts = {};
		const body = needFirst("make", step) || ({ plan: planStep, gather: gatherStep, dict: dictStep, seq: seqStep, pad: padStep,
			check: checkStep, store: storeStep })[step]();
		return h("div", { class: "flow" }, journey("make"), h("div", { class: "flow-body" }, body), stepNav("make", navOpts));
	}
	function readFlow() {
		if (!stepsOf("read").includes(st.step.read)) st.step.read = "have";
		const step = st.step.read;
		navOpts = {};
		const body = needFirst("read", step) || (step === "have" ? haveStep() : readPanel(st.read, { step }));
		return h("div", { class: "flow" }, journey("read"), h("div", { class: "flow-body" }, body), stepNav("read", navOpts));
	}

	// ---- make, 1: the plan, one question at a time --------------------------
	// Which mode, which form, how big: three little steps on their own short
	// thread. A form whose order can be undone (books, cards) is not offered:
	// it shows up only as what to avoid, under "something else".
	function setForm(id) { st.plan.form = id; if (!st.dict) st.plan.n = formOf(id).n; }
	const PLAN_SUBS = ["mode", "form", "size"];
	// a row of the form's example pieces (or beads), with a count under each
	// (own: the dictionary to show, if it is already made)
	function kindsRow(formId, n, count, own) {
		// the form's own example; if it has fewer kinds than N, plain numbered pieces rather than another material
		const own_ = formOf(formId).set, set = SETS.find((x) => x.id === own_ && x.things.length >= n) || (own_ ? null : SETS.find((x) => x.things.length >= n));
		const things = own && own.length === n ? own : set ? thingsOf(set, n) : Array.from({ length: n }, (_, i) => ({ name: String(i), emoji: String(i) })), shown = things.slice(0, 8);
		return h("div", { class: "kinds" }, shown.map((x) => h("span", {}, icon(x, 38), count ? h("small", { text: "×" + count }) : null)),
			things.length > shown.length ? h("span", { class: "more-kinds", text: "+" + (things.length - shown.length) }) : null);
	}
	// Choosing a form: a compact selector on the left (drawing and name),
	// what the chosen one is on the right; it is accepted with the bar, after
	// reading, not by the click itself.
	function formPicker(forms, pick) {
		const t = T();
		return h("div", { class: "forms two compact", role: "group", "aria-label": t.formTitle }, forms.map((f) => {
			const on = st.plan.form === f.id;
			return h("button", { class: "form" + (on ? " on" : "") + (f.keeps ? "" : " loose"), "aria-pressed": String(on), on: { click: () => pick(f.id) } },
				art(f.id), h("b", { text: t.forms[f.id].name }));
		}));
	}
	// for "something else": what not to do, the forms that lose their order among it (SPEC §11.5)
	function avoidBlock() {
		const t = T();
		const bad = (x) => h("div", { class: "form bad" }, art(x.id), h("b", { text: t.forms[x.id].name }),
			h("span", { class: "facts" }, h("span", {}, h("i", { text: t.formOrder }), t.forms[x.id].order)));
		return {
			forms: [h("h3", { class: "avoid-title", text: t.formAvoidTitle }), hint(t.formAvoidHelp), h("div", { class: "forms two compact" }, FORMS.filter((x) => !x.keeps).map(bad))],
			list: h("ul", { class: "list avoid" }, t.formAvoid.map((x) => h("li", { text: x }))),
		};
	}
	// what a form is: its drawing, what it keeps, whether it blends in and keeps its order, its note
	function formDetail(id, ...more) {
		const t = T(), f = formOf(id), w = t.forms[id];
		return panel(h("div", { class: "form-detail" }, art(id),
			h("div", { class: "stack tight" }, title(w.name), h("p", { class: "what", text: w.what }),
				h("dl", { class: "facts" }, h("dt", { text: t.formBlends }), h("dd", { text: w.blends }), h("dt", { text: t.formOrder }), h("dd", { text: w.order })))),
			h("div", { class: "note" + (f.keeps ? "" : " warn"), text: w.note }), ...more);
	}

	// a step's own little steps, on a short thread: keys, their names, the current one, which are done, go(key)
	const subSteps = (keys, names, current, done, go) => h("ol", { class: "substeps" }, keys.map((x, i) =>
		h("li", { class: [x === current ? "on" : "", done[x] ? "done" : ""].filter(Boolean).join(" ") },
			h("button", { disabled: x !== keys[0] && !st.mode ? "" : undefined, "aria-current": x === current ? "step" : null, on: { click: () => go(x) } },
				h("span", { class: "knot", "aria-hidden": "true" }), names[i]))));
	function planStep() {
		const t = T(), p = st.plan, d = st.dict;
		if (!PLAN_SUBS.includes(p.sub) || (!st.mode && p.sub !== "mode")) p.sub = "mode";
		const goSub = (x) => { p.sub = x; render(); scrollTo(0, 0); };
		const subDone = { mode: !!st.mode, form: !!st.mode && p.formChosen, size: !!st.mode && p.formChosen && p.sizeSeen };
		const subs = subSteps(PLAN_SUBS, t.planSubs, p.sub, subDone, goSub);
		const back = (x) => ["◀ " + t.planSubs[PLAN_SUBS.indexOf(x)], () => goSub(x)];
		const on = (x) => [t.planSubs[PLAN_SUBS.indexOf(x)] + " ▶", () => goSub(x)];
		let body;
		if (p.sub === "mode") { body = [modeChoice(() => goSub("form"))]; setNav({ prev: null, next: on("form"), ready: !!st.mode }); }
		else if (p.sub === "form") {
			if (!formOf(p.form).keeps) p.form = "other";
			const avoid = p.form === "other" ? avoidBlock() : null;
			body = [tool(panel(hint(t.formHelp), formPicker(FORMS.filter((x) => x.keeps), (id) => { setForm(id); p.formChosen = true; render(); }),
				avoid ? avoid.forms : null), formDetail(p.form, avoid ? avoid.list : null))];
			setNav({ prev: back("mode"), next: [on("size")[0], () => { p.formChosen = true; goSub("size"); }] });
		} else {
			const n = d ? d.things.length : p.n, L = symbolsFor(p.words, n), two = st.mode === "pad" && p.padAs === "string", same = two && !p.padForm;
			const written = formOf(p.form).family === "written", each = buyFor(p.words, n, st.mode, same ? "string" : "file");
			p.sizeSeen = true;
			const choice = (value, picture, label, help) => h("button", { class: "choice" + (p.padAs === value ? " on" : ""), "aria-pressed": String(p.padAs === value),
				on: { click: () => { p.padAs = value; render(); } } }, art(picture), h("b", { text: label }), h("span", { text: help }));
			body = [tool(
				panel(
					field(t.seedWords, seg([[12, "12"], [24, "24"]], p.words, (v) => { p.words = v; render(); }), hint(t.planWordsHelp)),
					field(t.howMany, d ? h("div", { class: "meta", text: t.planNFixed(n) })
						: seg(SIZES.map((v) => [v, String(v), v === formOf(p.form).n ? "★" : ""]), p.n, (v) => { p.n = v; render(); }),
						d ? null : hint(`★ ${t.recommended} (${t.forms[p.form].name})`), kindsRow(p.form, n, 0, d && d.things), hint(t.planKindsHelp(n))),
					null),
				panel(h("div", { class: "big-total", text: t.planSummary(st.mode, p.padAs, L) }),
					written ? h("p", { text: t.planWrite(L) }) : [h("p", { text: t.planEach(each, n) }), kindsRow(p.form, n, each, d && d.things)],
					st.mode === "pad" ? field(t.planPadAs, h("div", { class: "choices" },
						choice("string", "keyThings", t.padAsString, t.planPadString), choice("file", "keyFile", t.padAsFile, t.planPadFile))) : null,
					two ? field(t.formPadForm, seg([["same", t.formPadSame], ["other", t.formPadOther]], p.padForm ? "other" : "same",
						(v) => { p.padForm = v === "other" ? FORMS.find((f) => f.id !== p.form && f.keeps).id : null; st.padDict = null; render(); }),
						p.padForm ? h("select", { class: "input", "aria-label": t.formPadForm, on: { change: (e) => { p.padForm = e.target.value; st.padDict = null; render(); } } },
							FORMS.filter((f) => f.id !== p.form && f.keeps).map((f) => h("option", { value: f.id, selected: f.id === p.padForm ? "" : null }, t.forms[f.id].name))) : null) : null,
					two && p.padForm ? hint(t.planPadOther(t.forms[p.padForm].name)) : null,
					hint(t.planLater)))];
			setNav({ prev: back("form") });
		}
		return h("div", { class: "stack" }, subs, ...body.flat().filter(Boolean));
	}

	// ---- make, 2: what you need -----------------------------------------------
	// Two things to gather. The pieces: how many of each kind in all, and what
	// that number is made of (the sequence, and the key if it has the same
	// kinds; one of each per copy of the dictionary). What holds them: for the
	// sequence, its dictionary, and in pad mode the key and its dictionary (or
	// the key's file). A key in another collection has pieces of its own.
	function gatherStep() {
		const t = T(), p = st.plan, n = st.dict ? st.dict.things.length : p.n, L = symbolsFor(p.words, n);
		const pad = st.mode === "pad", things = pad && p.padAs === "string", same = things && !p.padForm, keyForm = things ? p.padForm || p.form : null;
		const written = (id) => formOf(id).family === "written";
		// an address book's conventional order needs no dictionary of pieces (SPEC §11.3)
		const dictPieces = (id) => id === "book" && n === 8 ? 0 : 1;
		// for: what the pieces are for ("seq", "both" halves, or the "key" alone)
		const pieces = (id, label, each, forWhat, copies, own) => written(id) ? null : h("div", { class: "need-block" },
			label ? h("div", { class: "label" + (label === t.stringPad ? " pad-label" : ""), text: label }) : null,
			kindsRow(id, n, each + copies, own),
			h("p", { class: "need-total", text: t.gatherPiecesTotal(each + copies, n) }),
			hint(t.gatherPiecesSplit(each, copies, forWhat)));
		const blocks = same
			? [pieces(p.form, null, buyFor(p.words, n, "pad", "string"), "both", 2 * dictPieces(p.form), st.dict && st.dict.things)]
			: [pieces(p.form, things ? t.stringSeq : null, buyFor(p.words, n, st.mode, "file"), "seq", (pad && !things ? 2 : 1) * dictPieces(p.form), st.dict && st.dict.things),
				things ? pieces(keyForm, t.stringPad, buyFor(p.words, n, "pad", "file"), "key", dictPieces(keyForm), st.padDict && st.padDict.things) : null];
		const support = (picture, label, text, key) => h("div", { class: "need" + (key ? " key" : "") },
			h("div", { class: "need-art" }, picture), h("div", { class: "stack tight" }, h("b", { text: label }), text ? h("p", { text }) : null));
		const supports = [
			support(art(p.form), t.gatherForSeq(L), materialsOf(p.form, L, n)),
			support(art(p.form), t.gatherForDict(dictPieces(p.form) && n), t.forms[p.form].dictSupport(n)),
			things ? support(art(keyForm === p.form && !p.padForm ? "keyThings" : keyForm), t.gatherForKey(L), materialsOf(keyForm, L, n), true) : null,
			things ? support(art(keyForm), t.gatherForKeyDict(dictPieces(keyForm) && n), t.forms[keyForm].dictSupport(n), true) : null,
			pad && !things ? support(art("keyFile"), t.gatherForKeyFile, t.gatherFile, true) : null,
			pad && !things ? support(art(p.form), t.gatherForKeyDict(dictPieces(p.form) && n), t.forms[p.form].dictSupport(n), true) : null];
		setNav({ onNext: () => { st.gathered = true; } });
		return tool(
			panel(title(t.gatherPiecesTitle), hint(t.gatherLead),
				...(blocks.some(Boolean) ? blocks : [h("p", { text: t.gatherNoPieces })]),
				hint(t.buyExact)),
			panel(title(t.gatherSupportsTitle), ...supports));
	}


	// ---- make, 3 (and read, 1): the dictionary ------------------------------
	// naming or checking has its own way on, piece by piece: the bar waits
	const dictStep = () => st.edit && st.edit.kind === "name" ? (setNav({ hidden: true }), nameScreen())
		: st.edit && st.edit.kind === "check" ? (setNav({ hidden: true }), checkScreen()) : dictScreen();
	function editDict(edit) { st.edit = edit; render(); scrollTo(0, 0); }

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
	// The ready-made dictionaries that fit N kinds, this form's first. pick(things, conventional):
	// for an address book with street types, the conventional order (SPEC §11.3), nothing to check.
	const thingsOf = (set, n) => set.things.slice(0, n).map((x) => ({ name: x[st.lang], emoji: x.emoji || "", colour: x.colour || "",
		symbol: x.symbol || "", brick: !!x.brick, photo: "" }));
	function readyDicts(n, formId, pick) {
		const f = formOf(formId);
		const sets = SETS.filter((set) => set.things.length >= n).sort((a, b) => (b.id === f.set) - (a.id === f.set));
		return h("div", { class: "row" }, sets.map((set) => h("button", { class: set.id === f.set ? "btn small" : "btn ghost small",
			on: { click: () => pick(thingsOf(set, n), set.id === "streets" && f.id === "book") } }, set.icon + " " + set[st.lang])));
	}
	const conventional = (n, formId, pick) => formId === "book" && n === 8
		? field(T().dictConventional, hint(T().dictConventionalHelp), h("div", { class: "row" },
			h("button", { class: "btn", on: { click: () => pick(thingsOf(SETS.find((x) => x.id === "streets"), 8), true) } }, "📒 " + T().dictConventional)))
		: null;
	function dictScreen() {
		const t = T(), d = st.dict, form = formOf(st.plan.form);
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
			let n = st.plan.n;
			const sizes = h("div");
			const pick = (things, checked) => { setDict({ things, checked }); render(); };
			// three ways to get it, side by side and alike: name the pieces, take an
			// example (this form's own; for an address book, the conventional order),
			// or open a saved one. Where the example is the natural choice, it comes first.
			const options = h("div", { class: "dict-ways" });
			const drawOptions = () => {
				const set = SETS.find((x) => x.id === form.set && x.things.length >= n), conv = form.id === "book" && n === 8;
				const way = (icon_, label, help, click, extra) => h("div", { class: "way" },
					h("button", { class: "btn way-btn", on: { click } }, h("span", { class: "way-icon", text: icon_ }), label), hint(help), extra || null);
				const name = way("✏️", t.dictName, t.dictNameWay, () => editDict({ kind: "name", things: Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" })), i: 0 }));
				const example = set ? way(set.icon, conv ? t.dictConventional : t.dictExampleOf(set[st.lang]), conv ? t.dictConventionalHelp : t.dictExampleWay,
					() => pick(thingsOf(set, n), conv),
					h("details", { class: "more" }, h("summary", { text: t.dictOtherExamples }), readyDicts(n, "other", pick)))
					: way("🎨", t.dictExample, t.dictExampleWay, () => {}, readyDicts(n, form.id, pick));
				const saved = way("📂", t.dictOpen, t.dictOpenWay, () => open.click());
				options.replaceChildren(...(form.exampleFirst ? [example, name, saved] : [name, example, saved]));
			};
			const drawSizes = () => {
				sizes.replaceChildren(seg(SIZES.map((v) => [v, String(v), v === form.n ? "★" : ""]), n, (v) => { n = st.plan.n = v; drawSizes(); }));
				drawOptions();
			};
			drawSizes();
			return h("div", { class: "stack" },
				panel(title(t.dictCard), hint(t.dictIntroShort),
					field(t.howMany, sizes, hint(`★ ${t.recommended} (${t.forms[form.id].name})`)),
					options, open, err),
				h("details", { class: "panel more-panel" }, h("summary", { text: t.dictBeforeTitle }),
					h("p", { text: t.dictIntro }), h("ol", { class: "how-to" }, t.dictChecks.map((x) => h("li", { text: x })))));
		}
		const json = () => JSON.stringify({ format: "seedcraft-dictionary", version: 0,
			things: d.things.map((x) => Object.fromEntries(Object.entries({ name: x.name, emoji: x.emoji, colour: x.colour, photo: x.photo }).filter(([, v]) => v))) }, null, 1);
		return tool(
			panel(title(t.dictHave(d.things.length)),
				h("div", { class: "dict-grid" }, d.things.map((x, i) => h("div", { class: "piece" }, h("span", { class: "num", text: String(i) }), icon(x, 34), h("span", { text: x.name }))))),
			panel(
				d.checked ? h("div", { class: "note ok" }, "✓ " + t.dictChecked) : h("div", { class: "note warn", text: t.dictNotChecked }),
				h("div", { class: "row" },
					h("button", { class: d.checked ? "btn ghost" : "btn", on: { click: () => editDict({ kind: "check", i: 0 }) } }, t.dictCheck),
					h("button", { class: "btn ghost", on: { click: () => editDict({ kind: "name", things: d.things.map((x) => ({ ...x, symbolTyped: !!x.emoji && x.emoji !== initialsOf(x.name) })), i: 0 }) } }, t.dictEdit)),
				field(t.dictSave, hint(t.dictSaveHelp),
					h("div", { class: "row" },
						h("button", { class: "btn ghost small", on: { click: () => download(json(), "dictionary.json", "application/json") } }, t.dictSaveJson),
						h("button", { class: "btn ghost small", on: { click: () => download(d.things.map((x) => x.name).join("\n") + "\n", "dictionary.txt", "text/plain") } }, t.dictSaveTxt))),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.dictForgetAsk)) { setDict(null); render(); } } } }, t.dictForget),
					null)));
	}

	// naming the pieces one by one
	function nameScreen() {
		const t = T(), ed = st.edit, n = ed.things.length, x = ed.things[ed.i];
		const form = ed.target === "pad" ? st.plan.padForm || st.plan.form : st.plan.form;
		const err = h("div");
		// the symbol follows the name (its initials) until it is typed by hand
		const nameIn = h("input", { type: "text", class: "big-input", value: x.name, placeholder: t.forms[form].namePh, autocomplete: "off", "aria-label": t.thingName,
			on: { input: (e) => {
				x.name = e.target.value;
				if (!x.symbolTyped && !x.symbol) { x.emoji = initialsOf(x.name); symbolIn.value = x.emoji; }
				drawStrip(); preview.replaceChildren(icon(x, 96));
			}, keydown: (e) => { if (e.key === "Enter") next(); } } });
		const symbolIn = h("input", { type: "text", class: "emoji", value: x.emoji || x.symbol || "", placeholder: "AB", "aria-label": t.thingSymbol, title: t.thingSymbolHelp, maxlength: 8,
			on: { input: (e) => { x.emoji = e.target.value.trim(); x.symbolTyped = !!x.emoji; if (!x.emoji && !x.symbol) x.emoji = initialsOf(x.name); drawStrip(); preview.replaceChildren(icon(x, 96)); } } });
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
			const things = ed.things.map(({ symbolTyped, ...y }) => ({ ...y, name: y.name.trim() }));
			if (ed.target === "pad") { st.padDict = { things, checked: false }; st.make.check = null; }
			else setDict({ things, checked: false });
			editDict({ kind: "check", i: 0, target: ed.target });
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
				h("div", { class: "name-row" }, field(t.thingName, nameIn), field(t.thingSymbol, symbolIn)),
				hint(t.thingSymbolHelp),
				field(t.thingColour, colours),
				h("div", { class: "row end" },
					h("button", { class: "btn ghost small", on: { click: () => photoIn.click() } }, x.photo ? t.photoAgain : t.photoTake),
					x.photo ? h("button", { class: "btn ghost small", on: { click: () => { x.photo = ""; render(); } } }, t.photoRemove) : null, photoIn),
				err,
				h("div", { class: "row" },
					h("button", { class: "btn ghost", on: { click: () => { if (ed.i > 0) { ed.i--; render(); } else editDict(null); } } }, "◀ " + (ed.i > 0 ? t.back : t.tabDict)),
					h("button", { class: "btn push", on: { click: next } }, ed.i < n - 1 ? t.next + " ▶" : "✓ " + t.dictDone))),
			panel(field(t.wholeDict, strip)));
	}

	// a round of checking against the real thing
	function checkScreen() {
		const t = T(), ed = st.edit, d = ed.target === "pad" ? st.padDict : st.dict, n = d.things.length, x = d.things[ed.i];
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
				h("button", { class: "btn ghost", on: { click: () => editDict({ kind: "name", target: ed.target, things: d.things.map((y) => ({ ...y, symbolTyped: !!y.emoji && y.emoji !== initialsOf(y.name) })), i: ed.i }) } }, "✗ " + t.checkNo),
				h("button", { class: "btn push", on: { click: () => {
					if (ed.i < n - 1) { ed.i++; render(); return; }
					d.checked = true; editDict(null);
				} } }, "✓ " + t.checkYes))));
	}

	// ---- make --------------------------------------------------------

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
			(i <= 0 || !move) && !done ? h("details", { class: "more mask-why" },
				h("summary", { text: qr ? t.handMaskShortKnown(size, qr.mask) : t.handMaskShort(expected - Math.floor(ndata / k)) }),
				hint(qr ? t.handMaskKnown(expected - Math.floor(ndata / k), size, qr.mask) : t.handMaskWhere(expected - Math.floor(ndata / k), size))) : null,
			h("div", { class: "row between" }, h("span", { class: "label", text: i < 0 ? t.handNone : i < L ? t.handStep(i + 1, qr ? L : expected) : t.handStep(L, L) }),
				h("span", { class: "meta", text: t.handTemplate(size, mask) })),
			...info,
			move ? h("div", { class: "row" },
				h("button", { class: "btn ghost", disabled: i === 0 ? "" : undefined, "aria-label": t.prevPiece, on: { click: () => move(i - 1) } }, "◀"),
				h("button", { class: "btn", disabled: i >= L ? "" : undefined, on: { click: () => move(i + 1) } }, t.nextPiece + " ▶"),
				h("button", { class: "btn ghost small push", on: { click: () => move(i >= L ? 0 : L) } }, i >= L ? t.handRestart : t.handAll)) : null,
			grid, move ? hint(t.handClick) : null, legend];
	}

	// One sequence to make, piece by piece, in two columns: on the left the
	// piece in hand and the controls, on the right the whole of it (the
	// drawing as a map that follows the piece, or the QR code by hand, or the
	// list), always in view. opts: posKey (where it is), tabKey (which view),
	// listName (its file), help (a note above the piece), hand (the QR code
	// by hand, basic mode only), things (its dictionary, if not the
	// sequence's), form, pad. Returns { tabs, left, right }.
	function stringViews(string, opts) {
		const t = T(), m = st.make, things = opts.things || st.dict.things, L = string.length, form = opts.form || st.plan.form;
		const views = [["walk", t.tabWalk], opts.hand ? ["hand", t.tabHand] : null, ["list", t.tabList]].filter(Boolean);
		if (!views.some(([v]) => v === m[opts.tabKey])) m[opts.tabKey] = "walk";
		const tab = m[opts.tabKey], left = [], right = [];
		if (tab === "walk") {
			const thing = (i) => things[string[i]];
			const pos = Math.min(m[opts.posKey] || 0, L - 1);
			const move = (to) => { m[opts.posKey] = Math.max(0, Math.min(L - 1, to)); render(); };
			const side = (i, label) => h("div", { class: "side" }, i >= 0 && i < L ? [hint(`${label} ${i + 1}`), icon(thing(i), 44), h("div", { class: "small-name", text: thing(i).name })] : null);
			if (opts.help) left.push(h("div", { class: "note" + (opts.pad ? " pad" : ""), text: opts.help }));
			left.push(
				h("div", { class: "row between" }, h("span", { class: "label", text: t.walkOf(pos + 1, L) }), hint(t.walkHelp)),
				h("div", { class: "wizard" }, side(pos - 1, t.prevPiece), h("div", { class: "centre" }, icon(thing(pos), 104), h("div", { class: "name", text: thing(pos).name })), side(pos + 1, t.nextPiece)),
				bar((pos + 1) / L),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", disabled: pos === 0 ? "" : undefined, on: { click: () => move(pos - 1) } }, "◀ " + t.prevPiece),
					h("button", { class: "btn push", on: { click: () => pos < L - 1 ? move(pos + 1) : null } }, pos < L - 1 ? t.nextPiece + " ▶" : "✓ " + t.done)));
			right.push(hint(t.forms[form].drawing), h("div", { class: "map tall" }, drawSeq(things, string, { current: pos, onPick: (i) => move(i), pad: opts.pad, form })));
		}
		if (tab === "hand") {
			const parts = opts.hand().filter(Boolean), grid = parts.find((e) => e.classList && e.classList.contains("hand-qr"));
			left.push(...parts.filter((e) => e !== grid));
			right.push(grid);
		}
		if (tab === "list") {
			const text = string.map((s, i) => `${i + 1}. ${things[s].name}`).join("\n");
			left.push(hint(t.listHelp), h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(text + "\n", opts.listName, "text/plain") } }, t.saveList)));
			right.push(h("pre", { class: "code", text }));
		}
		return { tabs: seg(views, tab, (v) => { m[opts.tabKey] = v; render(); }), left, right };
	}

	// ---- make, 4: the sequence ----------------------------------------------
	function seqStep() {
		const t = T(), m = st.make, d = st.dict;
		const n = d.things.length, k = Math.log2(n), padMode = st.mode === "pad";
		if (!m.symbols) {
			const area = h("textarea", { class: "input mono", rows: 3, spellcheck: "false", autocomplete: "off", placeholder: "height demise useless trap grow lion found off key clown transfer enroll" });
			area.value = m.seed;
			const status = h("div", { class: "status" }), err = h("div"), print = h("div");
			let timer = 0;
			const check = () => {
				m.seed = area.value;
				const words = m.seed.trim().split(/\s+/).filter(Boolean).length;
				clearTimeout(timer);
				print.replaceChildren();
				try {
					const entropy = S.mnemonicToEntropy(m.seed);
					if (words !== st.plan.words) { status.className = "status bad"; status.textContent = t.seedNotPlanned(words, st.plan.words); return false; }
					status.className = "status ok"; status.textContent = t.seedOk(words);
					// the fingerprint takes a moment: once typing stops
					timer = setTimeout(() => print.replaceChildren(fingerprintLine(entropy)), 300);
					return true;
				}
				catch (e) { status.className = "status bad"; status.textContent = words ? e.message : t.seedEmpty; return false; }
			};
			area.addEventListener("input", check);
			const test = (bytes) => { const e = new Uint8Array(bytes); crypto.getRandomValues(e); area.value = S.entropyToMnemonic(e); check(); };
			check();
			setNav({ ready: false });
			return tool(
				panel(title(t.makeCard), seedAlert(),
					field(t.seedTitle, hint(t.seedHelpPlanned(st.plan.words)),
						h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => test(st.plan.words === 12 ? 16 : 32) } }, st.plan.words === 12 ? t.seedTest12 : t.seedTest24)),
						area, status, print),
					err,
					h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => {
						if (!check()) { err.replaceChildren(errorBox(t.errWordsPlanned(st.plan.words))); return; }
						m.entropy = S.mnemonicToEntropy(m.seed);
						if (padMode) {
							// the basic sequence plus a pad drawn here (SPEC §10.9)
							m.basic = S.encode(m.entropy, k);
							m.devicePad = S.newPad(m.basic.length, n);
							m.handPad = null; m.handText = "";
							m.pad = m.devicePad;
							m.symbols = S.encrypt(m.basic, m.pad, n);
						} else m.symbols = S.encode(m.entropy, k);
						m.pos = 0; m.padPos = 0; m.hand = 0; m.tab = "walk"; m.padTab = "walk";
						m.padKept = m.checked = m.stored = false; m.check = null;
						render();
					} } }, t.makeIt))),
				panel(field(t.tabDict, dictLine()), hint(padMode ? t.seqPadIntro : t.seqIntro)));
		}
		const L = m.symbols.length, each = S.piecesToBuy(m.symbols, n), written = formOf(st.plan.form).family === "written";
		// the QR code by hand starts from the basic sequence: in pad mode, only after subtracting the pad
		const hand = padMode ? null : () => handView(d, m.symbols, S.compactSeedQR(m.entropy), m.hand || 0, (to) => { m.hand = Math.max(0, Math.min(L, to)); render(); });
		const v = stringViews(m.symbols, { posKey: "pos", tabKey: "tab", listName: padMode ? "list-a.txt" : "sequence.txt",
			help: padMode ? t.seqStringHelp : t.forms[st.plan.form].make, hand });
		return tool(
			panel(h("div", { class: "row between" }, title(padMode ? t.seqTitlePad : t.makeCard), h("span", { class: "meta", text: t.total(L) })),
				h("div", { class: "alert", text: padMode ? t.padMakeWarn : t.makeWarn }),
				v.tabs, ...v.left,
				h("details", { class: "more" }, h("summary", { text: t.seqAbout }),
					fingerprintLine(m.entropy), dictLine(),
					written ? null : h("p", { text: t.shop(each, n) }),
					h("p", { text: materialsOf(st.plan.form, L, n) }),
					h("div", { class: "row" },
						h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.otherSeedAsk(st.mode))) { m.symbols = null; m.entropy = null; render(); } } } }, "◀ " + t.otherSeed))),
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => go("print") } }, "🖨 " + t.printIt))),
			panel(...v.right));
	}

	// ---- make, 5: the pad (pad mode) ------------------------------------------
	// Drawn here (for learning only), a pad made by hand added to it if you
	// like (SPEC §10.2), then kept as a second string or as a file (§10.6, §10.7).
	function padStep() {
		if (st.edit && st.edit.target === "pad") { setNav({ hidden: true }); return st.edit.kind === "name" ? nameScreen() : checkScreen(); }
		const t = T(), m = st.make, n = st.dict.things.length, L = m.symbols.length, asString = st.plan.padAs === "string";
		const remake = () => {
			m.pad = m.handPad ? S.addPads(m.devicePad, m.handPad, n) : m.devicePad;
			m.symbols = S.encrypt(m.basic, m.pad, n);
			m.pos = 0; m.padPos = 0; m.checked = false; m.check = null;
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
		const save = h("button", { class: asString ? "btn ghost small" : "btn", on: { click: () => { download(file, "numbers.txt", "text/plain"); m.padKept = true; } } }, t.padFileSave);
		// another collection for the pad: its own dictionary, ready-made or from a file (SPEC §11.4)
		const padForm = asString ? st.plan.padForm : null, needDict = !!padForm && !st.padDict;
		const pickPadDict = (things) => { st.padDict = { things }; m.check = null; render(); };
		const padDictPanel = () => {
			const err = h("div");
			const open = h("input", { type: "file", accept: ".json,.txt,application/json,text/plain", class: "hidden", on: { change: async (e) => {
				const f = e.target.files[0];
				if (!f) return;
				try {
					const own = dictFromFile(await f.text(), f.name), problem = dictProblem(own);
					if (problem) { err.replaceChildren(errorBox(problem)); return; }
					if (own.length !== n) { err.replaceChildren(errorBox(t.errPadDictSize(own.length, n))); return; }
					pickPadDict(own);
				} catch (x) { err.replaceChildren(errorBox(t.errDictFile)); }
			} } });
			return panel(h("div", { class: "label pad-label", text: t.padDictTitle + ": " + t.forms[padForm].name }), hint(t.padDictHelp),
				h("div", { class: "row" }, h("button", { class: "btn", on: { click: () => editDict({ kind: "name", target: "pad",
					things: Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" })), i: 0 }) } }, t.dictName)),
				conventional(n, padForm, pickPadDict),
				field(t.padDictReady, readyDicts(n, padForm, pickPadDict)),
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => open.click() } }, t.dictOpen), open), err);
		};
		// as things: the same two columns as the sequence (the piece on the left, the map on the right)
		const v = asString && !needDict ? stringViews(m.pad, { posKey: "padPos", tabKey: "padTab", listName: "list-b.txt", help: t.padStringHelp, pad: true,
			things: padForm ? st.padDict.things : null, form: padForm || st.plan.form }) : null;
		setNav({ ready: !needDict, onNext: () => { m.padKept = true; } });
		return tool(
			panel(title(t.padTitle),
				h("div", { class: "note warn", text: t.padLearnOnly }),
				field(t.planPadAs, seg([["string", t.padAsString], ["file", t.padAsFile]], st.plan.padAs, (x) => { st.plan.padAs = x; render(); })),
				hand,
				padForm && st.padDict ? h("div", { class: "dictline" }, h("span", { class: "pad-label", text: t.padDictTitle }),
					h("span", { class: "minis" }, st.padDict.things.map((x) => icon(x, 22))),
					h("button", { class: "btn ghost small", on: { click: () => { st.padDict = null; m.check = null; render(); } } }, t.dictEdit)) : null,
				v ? [v.tabs, ...v.left] : null,
				asString ? null : [hint(t.padFileHelp), h("div", { class: "row" }, save)]),
			needDict ? padDictPanel()
			: v ? panel(...v.right)
			: panel(h("div", { class: "label pad-label", text: t.padFileTitle }), art("keyFile"), h("pre", { class: "code pad-file", text: file }), h("div", { class: "row" }, save)));
	}

	// ---- make, 6: read it back --------------------------------------------------
	function checkStep() {
		const m = st.make;
		if (!m.check) {
			m.check = freshRead(st.plan.padAs);
			if (st.plan.padForm && st.padDict) m.check.padIn.dict = st.padDict.things;
		}
		return readPanel(m.check, { expect: m.entropy });
	}

	// ---- make, 7: store it ------------------------------------------------------
	function storeStep() {
		const t = T(), m = st.make, padMode = st.mode === "pad";
		const items = padMode ? t.storePad : t.storeBasic;
		return tool(
			panel(title(t.storeTitle), hint(t.storeHelp),
				h("ul", { class: "checks" }, items.map((x) => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", { text: x })))))),
			panel(h("p", { text: t.storeForgetWhy }),
				h("div", { class: "row" }, h("button", { class: "btn", on: { click: () => {
					if (!confirm(t.storeForgetAsk(st.mode))) return;
					st.make = { seed: "", entropy: null, symbols: null, pos: 0, tab: "walk" };
					st.read = freshRead(); st.gathered = false; fingerprints.clear();
					st.step.make = "plan";
					go("intro");
				} } }, t.storeForget))));
	}

	// keyboard for the step-by-step view
	addEventListener("keydown", (e) => {
		if (/input|textarea/i.test(e.target.tagName)) return;
		const rd = st.read, m = st.make;
		const step = (obj, key, max) => {
			if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); obj[key] = Math.min(max, (obj[key] || 0) + 1); render(); }
			if (e.key === "ArrowLeft") { obj[key] = Math.max(0, (obj[key] || 0) - 1); render(); }
		};
		if (st.screen === "read" && st.step.read === "seed" && rd.out && rd.view === "hand") return step(rd, "hand", rd.symbols.length);
		if (st.screen !== "make" || !m.symbols) return;
		if (st.step.make === "seq" && m.tab === "hand") return step(m, "hand", m.symbols.length);
		if (st.step.make === "seq" && m.tab === "walk") return step(m, "pos", m.symbols.length - 1);
		if (st.step.make === "pad" && st.plan.padAs === "string" && m.padTab === "walk") return step(m, "padPos", m.pad.length - 1);
	});

	// ---- read ------------------------------------------------------------
	// read, 1: what you have — the mode it was made in, and its dictionary
	function haveStep() {
		const t = T();
		if (st.edit) return dictStep();
		const r = st.have || (st.have = { sub: "mode" });
		if (!st.mode && r.sub !== "mode") r.sub = "mode";
		const goSub = (x) => { r.sub = x; render(); scrollTo(0, 0); };
		const KEYS = ["mode", "form", "dict"], names = [t.planSubs[0], t.planSubs[1], t.haveDictSub];
		const subs = subSteps(KEYS, names, r.sub, { mode: !!st.mode, form: !!r.formChosen, dict: !!st.dict }, goSub);
		const back = (x) => ["◀ " + names[KEYS.indexOf(x)], () => goSub(x)], on = (x) => [names[KEYS.indexOf(x)] + " ▶", () => goSub(x)];
		let body;
		if (r.sub === "mode") { body = modeChoice(() => goSub("form")); setNav({ prev: null, next: on("form"), ready: !!st.mode }); }
		else if (r.sub === "form") {
			// any form: a backup to read back may have been made in one that is not recommended
			body = tool(panel(hint(t.haveFormHelp), formPicker(FORMS, (id) => { st.plan.form = id; r.formChosen = true; render(); })),
				formDetail(st.plan.form));
			setNav({ prev: back("mode"), next: [on("dict")[0], () => { r.formChosen = true; goSub("dict"); }] });
		} else {
			body = h("div", { class: "stack" }, dictScreen(),
				st.dict ? h("div", { class: "note ok" }, "✓ " + t.haveSummary(st.mode, st.dict.things.length) + ". " + t.forms[st.plan.form].read) : null);
			setNav({ prev: back("form"), ready: !!st.dict });
		}
		return h("div", { class: "stack" }, subs, body);
	}


	// Reading: the sequence, tapped or typed, and in pad mode the pad, as a
	// second string of things (with the same dictionary or its own) or as a
	// pad file, typed, pasted or opened. The same reader serves the journey
	// "Recover a seed" (opts.step: one step at a time) and the step "Check" of
	// making one (no opts.step: both strings side by side; opts.expect: the
	// seed it should give).
	function readPanel(rd, opts) {
		const t = T(), d = st.dict, inJourney = !!opts.step;
		const n = d.things.length, k = Math.log2(n), len12 = symbolsFor(12, n), len24 = symbolsFor(24, n);
		const padMode = st.mode === "pad", pin = rd.padIn, padThings = pin.dict || d.things;
		if (inJourney && opts.step !== "seed") rd.which = opts.step;
		// what is tapped or typed now: the sequence, or the pad's string
		const onPad = padMode && rd.which === "pad", slot = onPad ? pin : rd, things = onPad ? padThings : d.things;
		const namesOf = (th) => th.map((x) => x.name.toLowerCase());
		const objectsOf = (sl, th) => sl.typing
			? sl.text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim().toLowerCase()).filter(Boolean)
			: sl.taps.map((i) => th[i].name.toLowerCase());
		const padGiven = () => pin.source === "file" ? !!pin.file.trim() : objectsOf(pin, padThings).length > 0;
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
		const done = () => { if (inJourney) toStep("read", "seed"); else { if (opts.expect && sameSeed()) st.make.checked = true; render(); } };
		const sameSeed = () => rd.out && opts.expect && [...rd.out.entropy].join() === [...opts.expect].join();
		const readIt = () => {
			const objects = objectsOf(rd, d.things);
			rd.error = "";
			rd.out = null;
			if (!objects.length) rd.error = t.errEmpty;
			else if (padMode && !padGiven()) rd.error = t.errPadEmpty;
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
			if (rd.out) done(); else render();
		};
		// a whole string tapped: read the seed if it gives one, else go on to the pad
		const whole = () => {
			try { decodeNow(); readIt(); return; } catch (e) { /* not yet */ }
			if (padMode && !onPad && !padGiven()) {
				if (inJourney) { toStep("read", "pad"); return; }
				rd.which = "pad";
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
			return [hint(onPad ? (pin.dict && st.plan.padForm ? t.forms[st.plan.padForm].read : t.tapPadHelp) : t.forms[st.plan.form].read),
				h("div", { class: "keypad" }, things.map((x, i) =>
					tint(h("button", { class: "key" + (x.colour ? " tinted" : ""), "aria-label": x.name, on: { click: () => {
						slot.taps.push(i);
						if (slot.taps.length === len12 || slot.taps.length === len24) whole(); else render();
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
				pin.dict ? null : h("details", { class: "more" }, h("summary", { text: t.padDictReady }),
					st.plan.padForm ? conventional(n, st.plan.padForm, (things) => { pin.dict = things; pin.taps = []; render(); }) : null,
					readyDicts(n, st.plan.padForm || "other", (things) => { pin.dict = things; pin.taps = []; render(); })),
				err);
		};
		const result = () => {
			const words = S.entropyToMnemonic(rd.out.entropy).split(" ");
			const same = sameSeed();
			return h("div", { class: "result" + (opts.expect && !same ? " wrong" : "") },
				h("div", { class: "result-title", text: opts.expect ? (same ? "✓ " + t.checkMatch : "✗ " + t.checkMismatch) : "✓ " + t.seedFound }), seedAlert(),
				h("div", { class: "words" }, words.map((w, i) => h("div", {}, h("span", {}, i + 1), w))),
				fingerprintLine(rd.out.entropy),
				rd.out.fixed ? h("div", { class: "note" }, t.repaired(rd.out.fixed)) : null,
				rd.out.reversed ? h("div", { class: "note" }, t.reversed) : null,
				rd.out.swapped ? h("div", { class: "note" }, t.padSwapped) : null,
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => {
					Object.assign(rd, freshRead(pin.source));
					if (inJourney) toStep("read", "seq"); else render();
				} } }, inJourney ? t.readAgain : t.clear)));
		};

		// the step "The seed" of the journey: what was read gives it, or says why not
		if (opts.step === "seed") {
			const left = panel(title(t.readSeedTitle), dictLine(),
				h("p", { text: t.readGiven(objectsOf(rd, d.things).length, padMode ? (pin.source === "file" ? (padFileState().pad || []).length : objectsOf(pin, padThings).length) : null) }),
				rd.out ? null : h("div", { class: "row" }, h("button", { class: "btn push", on: { click: readIt } }, t.readIt)),
				errorBox(rd.error));
			const view = rd.view || "string";
			const right = [];
			if (rd.out && !padMode) right.push(seg([["string", t.seedFound], ["hand", t.tabHand]], view, (v) => { rd.view = v; render(); }));
			if (rd.out && !padMode && view === "hand") {
				const L = rd.symbols.length;
				const move = (to) => { rd.hand = Math.max(0, Math.min(L, to)); render(); };
				right.push(...handView(d, rd.symbols, S.compactSeedQR(rd.out.entropy), rd.hand || 0, move).filter(Boolean));
			} else if (rd.out) right.push(result());
			else right.push(h("div", { class: "empty", text: t.readSeedEmpty }));
			return tool(left, panel(...right));
		}

		const restart = h("button", { class: "btn ghost small", on: { click: () => {
			if (!confirm(t.readRestartAsk)) return;
			if (inJourney) { st.read = freshRead(pin.source); toStep("read", "seq"); } else { st.make.check = null; render(); }
		} } }, "↺ " + t.readRestart);
		const left = [h("div", { class: "row between" }, title(inJourney ? stepName("read", opts.step) : t.checkTitle), restart), dictLine()];
		if (!inJourney) left.push(hint(padMode ? t.checkHelpPad : t.checkReadHelp));
		if (padMode && !inJourney) {
			const padCount = pin.source === "file" ? (padFileState().pad || []).length : objectsOf(pin, padThings).length;
			left.push(seg([["seq", `${t.stringSeq} · ${objectsOf(rd, d.things).length}`], ["pad", `${t.stringPad} · ${padCount}`]], rd.which, (v) => { rd.which = v; render(); }));
		}
		if (onPad) {
			left.push(seg([["string", t.padAsString], ["file", t.padAsFile]], pin.source, (v) => { pin.source = v; render(); }));
			if (pin.source === "file") left.push(...padFileInput());
			else left.push(padDictInput(), ...piecesInput());
		} else left.push(...piecesInput());
		if (inJourney) setNav(opts.step === "pad" || !padMode ? { onNext: readIt } : {});

		const last = slot.taps.slice(-5);
		const right = [];
		// while reading: the string so far (or, in the basic mode, the QR code by
		// hand, live, to draw it as you go); once read, the seed
		const view = padMode ? "string" : rd.view || "string";
		if (!padMode && !rd.out && !rd.typing)
			right.push(seg([["string", t.readViewString], ["hand", t.tabHand]], view, (v) => { rd.view = v; render(); }));
		if (rd.out && !inJourney) right.push(result());
		else if (view === "hand" && !rd.typing) right.push(h("div", { class: "big-total", text: t.tapped(rd.taps.length, len12, len24) }),
			...handView(d, rd.taps, null, rd.taps.length - 1, null).filter(Boolean));
		else if (!slot.typing && !(onPad && pin.source === "file")) right.push(
			padMode ? h("div", { class: "label" + (onPad ? " pad-label" : ""), text: onPad ? t.stringPad : t.stringSeq }) : null,
			h("div", { class: "big-total", text: t.tapped(slot.taps.length, len12, len24) }),
			h("div", { class: "lasttaps" }, last.map((i, j) => h("span", { class: j === last.length - 1 ? "newest" : "" },
				icon(things[i], j === last.length - 1 ? 48 : 32), h("small", { text: `${slot.taps.length - last.length + j + 1}` })))),
			drawSeq(things, slot.taps, { pad: onPad, form: onPad && pin.dict ? st.plan.padForm || "other" : st.plan.form }));
		else if (onPad && pin.source === "file") right.push(h("div", { class: "label pad-label", text: t.stringPad }), hint(t.padFileReadHelp));
		if (!rd.out && !inJourney) right.push(errorBox(rd.error), h("div", { class: "row" }, h("button", { class: "btn push", on: { click: readIt } }, t.readIt)));

		return tool(panel(...left), panel(...right));
	}

	// ---- printable sheet ----------------------------------------------
	// For whoever makes the string: what to buy and the order, with nothing
	// about what it is for, and nothing about the dictionary's order (the
	// shopping list is in alphabetical order, without numbers).
	function printSheet() {
		const t = T(), m = st.make, d = st.dict;
		if (!d || !m.symbols) { st.screen = "make"; st.step.make = "seq"; return makeFlow(); }
		const form = formOf(st.plan.form), w = t.forms[form.id], L = m.symbols.length;
		const n = d.things.length, each = S.piecesToBuy(m.symbols, n), materials = materialsOf(form.id, L, n);
		const shop = [...d.things].sort((a, b) => a.name.localeCompare(b.name, st.lang));
		return h("div", {},
			h("div", { class: "noprint panel print-bar" },
				h("div", { class: "alert" }, st.mode === "pad" ? t.printWarnPad : t.printWarn),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", on: { click: () => toStep("make", "seq") } }, "◀ " + t.back),
					h("button", { class: "btn push", on: { click: () => print() } }, t.printBtn))),
			h("div", { class: "card sheet" },
				h("h2", { text: w.sheetTitle }), h("p", { class: "help", text: w.sheetSub }),
				h("h3", { text: form.family === "written" ? t.sheetNeed : t.sheetShop }),
				form.family === "written" ? null : h("p", { text: t.sheetEach(each) }),
				form.family === "written" ? null : h("div", { class: "legend shop" }, shop.map((x) => h("span", { class: "item" }, icon(x, 34, true), x.name))),
				materials ? h("p", { text: materials }) : null,
				h("h3", { text: t.sheetHow }),
				h("ol", { class: "how-to" }, w.sheetSteps.map((x) => h("li", { text: x }))),
				// the magic is for the forms a child can make, whose order stays
				form.family !== "written" && form.keeps ? h("div", { class: "magic" }, h("div", { class: "magic-title", text: t.sheetMagicTitle }), h("p", { text: t.sheetMagic })) : null,
				h("div", { class: "drawing-page" },
					h("h3", { text: t.sheetDrawing }),
					drawSeq(d.things, m.symbols, { paper: true, perRow: L > 80 ? 10 : 8, form: form.id }))));
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
			setDict({ things: set.things.slice(0, st.plan.n).map((x) => ({ name: x[st.lang], emoji: x.emoji || "", colour: x.colour || "", symbol: x.symbol || "", brick: !!x.brick, photo: "" })), checked: false });
			toStep("make", "plan");
		};
		// the two journeys, as they will go: one door each
		const journeyList = (flow, steps) => h("div", { class: "door-steps" },
			h("h3", { text: flow === "make" ? t.tabMakeFlow : t.tabReadFlow }),
			h("ol", {}, steps.map(([a, b], i) => h("li", { class: (flow === "make" ? MAKE_STEPS : READ_STEPS)[i] === "pad" ? "pad" : null },
				h("b", { text: a }), h("span", { text: b })))));
		return h("div", { class: "intro" },
			h("section", { class: "hero" },
				h("div", { class: "hero-text" }, h("h1", { text: t.introTitle }), h("p", { class: "lead", text: t.introLead }),
					h("div", { class: "row doors" },
						h("button", { class: "btn big", on: { click: () => go("make") } }, t.tabMakeFlow),
						h("button", { class: "btn ghost big", on: { click: () => go("read") } }, t.tabReadFlow)),
					h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: tryExample } }, t.startTry))),
				heroString()),
			h("section", { class: "panel" }, h("h2", { class: "panel-title", text: t.stepsTitle }),
				h("div", { class: "doors-steps" }, journeyList("make", t.makeSteps), journeyList("read", t.readSteps))),
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
