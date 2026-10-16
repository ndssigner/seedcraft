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
		make: { seed: "", entropy: null, symbols: null, pos: 0, tab: "turn" },
		read: freshRead(),
		seen: {},  // the one-line explanations already shown once: keyWhy, reroll, keyPart, rowCheck, howTo, whyPad, whyBasic, readTap
		wholeTable: false,  // making a sequence in pad mode: the whole collection table open, from turn to turn (else only the piece's row)
	};
	// What is being read, turn by turn (turnReader): the turn shown (L: the
	// end), each turn's piece of the sequence (taps) and, in pad mode, of the
	// key (keyTaps, or keyFile: the key file's numbers, from fileText, checked
	// in "What you have"); last, the turn a tap just completed; typing, text,
	// keyText: everything typed at once; out, error: what decodeTurns made of
	// it, for sig (the pieces it was worked out from). What it is read as is
	// its own, apart from the backup being made (st.mode, st.plan, st.padDict):
	// mode, words, padAs, padForm and padDict (the key's own collection), kept from `keep`.
	function freshRead(keep) {
		return { turn: 0, taps: [], keyTaps: [], keyFile: null, fileText: "", last: null,
			typing: false, text: "", keyText: "", out: null, error: "", sig: "",
			words: keep ? keep.words : 12, padAs: keep ? keep.padAs : "string", padForm: keep ? keep.padForm : null, padDict: keep ? keep.padDict : null,
			mode: keep ? keep.mode : null };
	}
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// a dictionary of another size: what was made or read with the old one
	// goes (a renamed piece changes nothing: the sequence is numbers)
	function setDict(d) {
		const same = st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (d) st.plan.n = d.things.length;
		if (!same) {
			st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "turn" };
			st.read = { ...freshRead(st.read), padDict: null };
		}
	}

	// another number of words: what was made for the old length goes (the key, the sequence), as with a new N
	function setWords(words) {
		st.plan.words = words;
		st.make = { seed: st.make.seed, entropy: null, symbols: null, pos: 0, tab: "turn" };
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

	// ---- the start page's top bar and foot ------------------------------
	// (the slides have neither: the lectern's guide, «⋯» and foot instead)
	// each tab's label, and its short one for phones
	const TABS = [["intro", "tabIntro", "tabIntro"], ["make", "tabMakeFlow", "tabMakeShort"], ["read", "tabReadFlow", "tabReadShort"]];
	function topBar() {
		const t = T();
		return h("header", { class: "top" },
			h("div", { class: "brand", id: "logo", on: { click: () => go("intro") } }, h("b", {}, "Seed", h("span", { text: "craft" })),
				h("span", { class: "badge", id: "draft", title: t.warnTest }, h("span", { class: "long", text: t.draft + " " }), "v0"),
				h("small", { id: "tagline", text: t.subtitle })),
			h("nav", { class: "tabs", id: "tabs" }, TABS.map(([name, label, short]) => h("button", { class: name === "intro" ? "on" : "", on: { click: () => go(name) } },
				h("span", { class: "long", text: t[label] }), h("span", { class: "short", text: t[short] })))),
			h("div", { class: "net-wrap" },
				h("button", { class: "net", id: "net", "aria-describedby": "net-why", on: { click: (e) => { e.stopPropagation(); $("net-why").classList.toggle("open"); } } }),
				h("div", { class: "net-why", id: "net-why", role: "tooltip" })),
			h("a", { class: "pill", id: "gh", href: REPO_URL, title: t.repo, target: "_blank", rel: "noopener noreferrer" }, "GitHub ↗"),
			h("button", { class: "pill", id: "lang", on: { click: () => { st.lang = t.langSwitch; render(); } } }, t.langName));
	}
	function footBar() {
		const t = T();
		return h("footer", {}, h("div", {}, link(REPO_URL, t.repo),
			h("button", { id: "about", on: { click: () => go("about") } }, t.aboutTitle),
			h("button", { id: "donate", on: { click: () => go("donate") } }, t.donateTitle)));
	}
	// the connection, in sight on the start page; the warnings themselves appear next to a seed (seedAlert)
	const online = () => {
		const t = T(), on = navigator.onLine;
		if (!$("net")) return;
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
	// the explanation of the connection: on hover (CSS), or on a tap, for touch screens
	document.addEventListener("click", () => { if ($("net-why")) $("net-why").classList.remove("open"); });
	function go(screen) { st.screen = screen; render(); scrollTo(0, 0); }
	// the repository, and the sister projects (plain links: the page itself still connects nowhere)
	const REPO_URL = "https://github.com/ndssigner/seedcraft";
	const SIBLINGS = [["NDS-Signer", "https://github.com/ndssigner/nds-signer", "sibNds"], ["ur-tones", "https://github.com/ndssigner/ur-tones", "sibUrTones"]];
	const link = (href, text, tip) => h("a", { href, target: "_blank", rel: "noopener noreferrer", title: tip || null }, text);

	// ---- the lectern -----------------------------------------------------
	// Every screen is a slide (slides.js). Until each step is redone as its
	// own slides, the old step views are shown whole as one "legacy" slide
	// each (the only bodies allowed to scroll inside), with the guide made
	// from the old list of steps; the start page, about, donate and the
	// printable sheet stay as they are, fitted into the frame.
	const Slides = SeedcraftSlides;
	let mounted = false, lastView = "";
	function render() {
		document.documentElement.lang = st.lang;
		if (!mounted) {
			// another language from the «⋯» panel: the same slide, the same state, redrawn
			Slides.mount($("app"), { lang: st.lang, onLang: (l) => { st.lang = l; render(); } });
			mounted = true;
		}
		Slides.setLang(st.lang);
		// what scrolls inside a legacy slide (the map, the two columns) keeps its place across a redraw
		const SCROLLERS = ".slide-legacy, .map, .flow-body, .flow-body .tool > .panel";
		const view = [st.screen, st.step[st.screen], st.make.tab, st.make.key && st.make.key.by, st.plan.sub, st.edit && st.edit.kind].join();
		const kept = view === lastView ? [...$("app").querySelectorAll(SCROLLERS)].map((e) => e.scrollTop) : [];
		lastView = view;
		Slides.show(slideNow(view));
		online();
		[...$("app").querySelectorAll(SCROLLERS)].forEach((e, i) => { if (kept[i] !== undefined) e.scrollTop = kept[i]; });
		// the step by step's drawing then glides from where it was to keep the current piece in the middle
		const map = $("app").querySelector(".map"), cur = map && map.querySelector(".ring-cur, li.on");
		if (cur) {
			const to = map.scrollTop + cur.getBoundingClientRect().top - map.getBoundingClientRect().top - map.clientHeight / 2 + cur.getBoundingClientRect().height / 2;
			map.scrollTo({ top: to, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
		}
	}
	// the slide for what is on screen now
	function slideNow(view) {
		const t = T(), home = { icon: "⌂", label: t.slidesHome, go: () => go("intro") };
		const toStart = { label: "◀ " + t.tabIntro, go: () => go("intro") };
		const page = (body, prev) => ({ id: view, legacy: true, guide: [], question: null, steps: 1, body: () => body,
			prev, next: null, shortcuts: st.screen === "intro" ? [] : [home], help: null });
		if (st.screen === "print") {
			const sheet = printSheet();
			if (sheet) return page(h("div", { class: "wrap" }, sheet), { label: "◀ " + t.back, go: () => toStep("make", "seq") });
		}
		if (st.screen === "make" || st.screen === "read") return flowSlide(st.screen, view, home, toStart);
		if (st.screen === "about") return page(h("div", { class: "wrap" }, about()), toStart);
		if (st.screen === "donate") return page(h("div", { class: "wrap" }, donate()), toStart);
		return page(h("div", { class: "start" }, topBar(), h("div", { class: "wrap" }, intro()), footBar()), null);
	}
	// an old step view as one legacy slide: its guide, the old list of steps;
	// its foot, what the view asked for with setNav (or the journey's own)
	function flowSlide(flow, view, home, toStart) {
		const body = flow === "make" ? makeFlow() : readFlow(), o = navOpts;
		const steps = stepsOf(flow), i = steps.indexOf(st.step[flow]), before = steps[i - 1], after = steps[i + 1];
		const pair = (x, ready) => x ? { label: x[0], go: x[1], ready } : null;
		// the journey's very first view goes back to the start page (the top bar's tabs are only there now)
		const prev = o.hidden ? null : o.prev !== undefined ? pair(o.prev) || (i === 0 ? toStart : null)
			: before ? { label: "◀ " + stepName(flow, before), go: () => toStep(flow, before) } : toStart;
		const next = o.hidden ? null : o.next !== undefined ? pair(o.next, o.ready !== false)
			: after ? { label: stepName(flow, after) + " ▶", go: () => { if (o.onNext) o.onNext(); toStep(flow, after); }, ready: o.ready !== false } : null;
		return { id: view, legacy: true, question: null, steps: 1, body: () => body, prev, next, shortcuts: [home], help: null, onKey: legacyKey,
			guide: steps.map((step) => ({ name: stepName(flow, step), current: step === st.step[flow], count: null, go: () => toStep(flow, step) })) };
	}

	// ---- small building blocks ----------------------------------------
	const field = (label, ...children) => h("div", { class: "field" }, h("div", { class: "label", text: label }), ...children);
	const panel = (...children) => h("section", { class: "panel" }, ...children);
	const tool = (...panels) => h("div", { class: "tool" }, ...panels);
	const title = (text) => h("h2", { class: "panel-title", text });
	const hint = (text) => h("div", { class: "hint", text });
	const bar = (fraction) => { const b = h("div"); b.style.width = `${Math.round(100 * fraction)}%`; return h("div", { class: "bar-track" }, b); };
	// segmented control: [value, label, mark, what the mark means]
	const seg = (items, value, set) => h("div", { class: "seg" }, items.map(([v, label, mark, why]) =>
		h("button", { class: v === value ? "on" : "", title: mark && why ? why : null, on: { click: () => set(v) } }, label, mark ? h("small", { text: mark }) : null)));
	// an element edged in a piece's colour (CSS var --c)
	const tint = (e, colour) => { if (colour) e.style.setProperty("--c", colour); return e; };
	// the two modes (SPEC §10, §11.1), chosen before making or reading: what
	// each one keeps safe, and what it doesn't. Recovering, it is what is read's
	// (st.read.mode), apart from the backup being made (st.mode). Choosing the
	// same one again changes nothing; another starts over, and a backup's key
	// or sequence already made goes only once the person says so.
	const modeNow = () => st.screen === "read" ? st.read.mode : st.mode;
	function setMode(mode) {
		if (mode === modeNow()) return true;
		if (st.screen === "read") {
			st.read = { ...freshRead(st.read), mode };
			return true;
		}
		const m = st.make;
		if (((m.key && m.key.pieces.length) || m.symbols) && !confirm(T().modeChangeAsk)) return false;
		st.mode = mode;
		st.make = { seed: m.seed, entropy: null, symbols: null, pos: 0, tab: "turn" };
		return true;
	}
	function modeChoice(then) {
		const t = T();
		const option = (mode, name, points) => h("button", { class: "mode" + (modeNow() === mode ? " on" : ""), "aria-pressed": String(modeNow() === mode),
			on: { click: () => { if (!setMode(mode)) return; if (then) then(); else render(); } } },
			art(mode), h("b", { text: name }), h("span", { class: "points" }, points.map((x) => h("span", { text: x }))));
		return panel(h("p", { class: "lead", text: st.screen === "read" ? t.modeHelpRead : t.modeHelp }),
			h("div", { class: "modes" }, option("basic", t.modeBasic, t.modeBasicPoints), option("pad", t.modePad, t.modePadPoints)));
	}


	// ---- the two journeys ----------------------------------------------
	// Making a backup and reading one: each a sequence of steps along a thread,
	// a knot per step, filled once that step has done its job. The key's step
	// (the pad's) is on its own thread colour, as the pad is drawn everywhere.
	// Making one, the key comes first: the sequence is made with it. Reading
	// one, the key is given with the rest of what you have, and both strings
	// are read together, turn by turn.
	const MAKE_STEPS = ["plan", "gather", "dict", "key", "seq", "check", "store"];
	const READ_STEPS = ["have", "recover", "seed"];
	const keyThread = (step) => step === "key";
	const stepsOf = (flow) => (flow === "make" ? MAKE_STEPS : READ_STEPS).filter((x) => !keyThread(x) || st.mode === "pad");
	const stepName = (flow, step) => (flow === "make" ? T().makeSteps[MAKE_STEPS.indexOf(step)] : T().readSteps[READ_STEPS.indexOf(step)])[0];
	function toStep(flow, step) { st.step[flow] = step; st.edit = null; go(flow); }
	function stepDone(flow, step) {
		const m = st.make, rd = st.read;
		if (flow === "make") return ({ plan: !!st.mode, gather: !!st.gathered, dict: !!st.dict && st.dict.checked && (!keyDictNeeded() || !!st.padDict),
			key: keyReady() && (st.plan.padAs === "string" || !!m.padKept), seq: !!m.symbols, check: !!m.checked, store: !!m.stored })[step];
		return ({ have: !!rd.mode && !!st.dict && keyGiven(), recover: !!rd.out, seed: !!rd.out })[step];
	}
	function journey(flow) {
		const t = T(), steps = stepsOf(flow);
		return h("nav", { class: "journey" + (flow === "read" ? " short" : ""), "aria-label": flow === "make" ? t.tabMakeFlow : t.tabReadFlow },
			h("ol", {}, steps.map((step, i) => {
				const cur = st.step[flow] === step;
				return h("li", { class: [cur ? "on" : "", stepDone(flow, step) ? "done" : "", keyThread(step) ? "pad" : ""].filter(Boolean).join(" ") },
					h("button", { "aria-current": cur ? "step" : null, on: { click: () => toStep(flow, step) } },
						h("span", { class: "knot", "aria-hidden": "true" }),
						h("span", { class: "step-name" }, h("small", { text: String(i + 1) }), stepName(flow, step))));
			})),
			// on a phone, only the knots, and the current step's name under them
			h("div", { class: "journey-now", "aria-hidden": "true" }, h("small", { text: t.stepOf(steps.indexOf(st.step[flow]) + 1, steps.length) + " · " }), stepName(flow, st.step[flow])));
	}
	// every step opens the same way: its name, then one plain sentence (lead) and anything beside the name (aside)
	const stepHead = (flow, lead, aside) => [h("div", { class: "row between step-head" }, h("h2", { class: "step-title", text: stepName(flow, st.step[flow]) }), aside || null),
		lead ? h("p", { class: "lead", text: lead }) : null];
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
		// on a phone the buttons say only back and next: the step names would not fit
		const label = (long, short) => [h("span", { class: "long", text: long }), h("span", { class: "short", text: short })];
		return h("nav", { class: "flow-nav", "aria-label": T().stepsNav }, h("div", { class: "flow-nav-in" },
			back ? h("button", { class: "btn ghost", on: { click: back[1] } }, label(back[0], "◀ " + T().back)) : h("span"),
			on ? h("button", { class: "btn", id: "nav-next", disabled: opts.ready === false ? "" : undefined, on: { click: on[1] } }, label(on[0], T().next + " ▶")) : h("span")));
	}
	// a step that cannot start yet says which one comes first
	function needFirst(flow, step) {
		let need = null;
		if (flow === "make") {
			if (step !== "plan" && step !== "store" && !st.mode) need = "plan";
			else if (["key", "seq", "check"].includes(step) && !st.dict) need = "dict";
			else if (["key", "seq", "check"].includes(step) && keyDictNeeded() && !st.padDict) need = "dict";
			else if (["seq", "check"].includes(step) && st.mode === "pad" && !keyReady()) need = "key";
			// a key file is saved before a sequence is made with it, and before it is checked: this page forgets it
			else if ((step === "check" || (step === "seq" && !st.make.symbols)) && st.mode === "pad" && st.plan.padAs === "file" && !st.make.padKept) need = "key";
			else if (step === "check" && !st.make.symbols) need = "seq";
		} else if (step !== "have" && (!st.read.mode || !st.dict || !keyGiven())) need = "have";
		else if (step === "seed" && !st.read.out) need = "recover";
		if (!need) return null;
		setNav({ hidden: true });
		return h("div", { class: "narrow" }, panel(title(stepName(flow, step)), h("p", { text: T().needFirst(stepName(flow, need)) }),
			h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => toStep(flow, need) } }, stepName(flow, need) + " ▶"))));
	}
	function makeFlow() {
		if (!stepsOf("make").includes(st.step.make)) st.step.make = "plan";
		const step = st.step.make;
		navOpts = {};
		const body = needFirst("make", step) || ({ plan: planStep, gather: gatherStep, dict: dictStep, key: keyStep, seq: seqStep,
			check: checkStep, store: storeStep })[step]();
		return h("div", { class: "flow-body" }, body);
	}
	function readFlow() {
		if (!stepsOf("read").includes(st.step.read)) st.step.read = "have";
		const step = st.step.read;
		navOpts = {};
		if (st.read.mode && st.dict && keyGiven()) readOut(st.read);
		const body = needFirst("read", step) || ({ have: haveStep, recover: () => turnReader(st.read), seed: seedStep })[step]();
		return h("div", { class: "flow-body" }, body);
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
	// (the first one, the mode, opens the others)
	const subSteps = (keys, names, current, done, go) => h("ol", { class: "substeps" }, keys.map((x, i) =>
		h("li", { class: [x === current ? "on" : "", done[x] ? "done" : ""].filter(Boolean).join(" ") },
			h("button", { disabled: x !== keys[0] && !modeNow() ? "" : undefined, "aria-current": x === current ? "step" : null, on: { click: () => go(x) } },
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
			body = [tool(panel(h("p", { class: "lead", text: t.formHelp }), formPicker(FORMS.filter((x) => x.keeps), (id) => { setForm(id); p.formChosen = true; render(); }),
				avoid ? avoid.forms : null), formDetail(p.form, avoid ? avoid.list : null))];
			setNav({ prev: back("mode"), next: [on("size")[0], () => { p.formChosen = true; goSub("size"); }] });
		} else {
			const n = d ? d.things.length : p.n, L = symbolsFor(p.words, n);
			const written = formOf(p.form).family === "written";
			p.sizeSeen = true;
			// how many of each to get is the next step's: here only how long it is, and of which kinds
			body = [tool(
				panel(
					field(t.seedWords, seg([[12, "12"], [24, "24"]], p.words, (v) => { if (v !== p.words) setWords(v); render(); })),
					field(t.howMany, d ? h("div", { class: "meta", text: t.planNFixed(n) })
						: seg(SIZES.map((v) => [v, String(v), v === formOf(p.form).n ? "★" : "", t.recommended]), p.n, (v) => { p.n = v; render(); }),
						kindsRow(p.form, n, 0, d && d.things))),
				panel(h("div", { class: "big-total", text: t.planSummary(st.mode, p.padAs, L) }),
					written ? h("p", { text: t.planWrite(L) }) : null,
					st.mode === "pad" ? keyAsFields(p, () => { st.padDict = null; }) : null))];
			setNav({ prev: back("form") });
		}
		return h("div", { class: "stack" }, subs, ...body.flat().filter(Boolean));
	}

	// pad mode: the key as things or as a file and, as things, in the same
	// collection as the sequence or in another one: p is the plan's choice, or
	// what is being read's; forget() drops the key's own dictionary
	function keyAsFields(p, forget) {
		const t = T(), form = st.plan.form;
		const choice = (value, picture, label, help) => h("button", { class: "choice" + (p.padAs === value ? " on" : ""), "aria-pressed": String(p.padAs === value),
			on: { click: () => { p.padAs = value; render(); } } }, art(picture), h("b", { text: label }), h("span", { text: help }));
		return [field(t.planPadAs, h("div", { class: "choices" },
				choice("string", "keyThings", t.padAsString, t.planPadString), choice("file", "keyFile", t.padAsFile, t.planPadFile))),
			p.padAs === "string" ? field(t.formPadForm, seg([["same", t.formPadSame], ["other", t.formPadOther]], p.padForm ? "other" : "same",
				(v) => { p.padForm = v === "other" ? FORMS.find((f) => f.id !== form && f.keeps).id : null; forget(); render(); }),
				p.padForm ? h("select", { class: "input", "aria-label": t.formPadForm, on: { change: (e) => { p.padForm = e.target.value; forget(); render(); } } },
					FORMS.filter((f) => f.id !== form && f.keeps).map((f) => h("option", { value: f.id, selected: f.id === p.padForm ? "" : null }, t.forms[f.id].name))) : null) : null];
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
			h("p", { class: "meta", text: t.gatherPiecesSplit(each, copies, forWhat) }));
		const blocks = same
			? [pieces(p.form, null, buyFor(p.words, n, "pad", "string"), "both", 2 * dictPieces(p.form), st.dict && st.dict.things)]
			: [pieces(p.form, things ? t.stringSeq : null, buyFor(p.words, n, st.mode, "file"), "seq", (pad && !things ? 2 : 1) * dictPieces(p.form), st.dict && st.dict.things),
				things ? pieces(keyForm, t.stringPad, buyFor(p.words, n, "pad", "file"), "key", dictPieces(keyForm), st.padDict && st.padDict.things) : null];
		const support = (picture, label, text, key) => h("div", { class: "need" + (key ? " need-key" : "") },
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
			panel(title(t.gatherPiecesTitle), h("p", { class: "lead", text: t.gatherLead }),
				...(blocks.some(Boolean) ? blocks : [h("p", { text: t.gatherNoPieces })])),
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
					h("button", { class: "btn way-btn", on: { click } }, h("span", { class: "way-icon", text: icon_ }), label), h("p", { class: "meta", text: help }), extra || null);
				const name = way("✏️", t.dictName, t.dictNameWay, () => editDict({ kind: "name", things: Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" })), i: 0 }));
				const example = set ? way(set.icon, conv ? t.dictConventional : t.dictExampleOf(set[st.lang]), conv ? t.dictConventionalHelp : t.dictExampleWay,
					() => pick(thingsOf(set, n), conv),
					h("details", { class: "more" }, h("summary", { text: t.dictOtherExamples }), readyDicts(n, "other", pick)))
					: way("🎨", t.dictExample, t.dictExampleWay, () => {}, readyDicts(n, form.id, pick));
				const saved = way("📂", t.dictOpen, t.dictOpenWay, () => open.click());
				options.replaceChildren(...(form.exampleFirst ? [example, name, saved] : [name, example, saved]));
			};
			const drawSizes = () => {
				sizes.replaceChildren(seg(SIZES.map((v) => [v, String(v), v === form.n ? "★" : "", t.recommended]), n, (v) => { n = st.plan.n = v; drawSizes(); }));
				drawOptions();
			};
			drawSizes();
			// when making, N was chosen in the plan; when recovering, it is asked here
			const reading = st.screen === "read";
			return h("div", { class: "stack" },
				panel(...(reading ? [h("p", { class: "lead", text: t.dictIntroShort })] : stepHead("make", t.dictIntroShort)),
					reading ? field(t.howMany, sizes) : null,
					options, open, err),
				h("details", { class: "panel more-panel" }, h("summary", { text: t.dictBeforeTitle }),
					h("p", { text: t.dictIntro }), h("ol", { class: "how-to" }, t.dictChecks.map((x) => h("li", { text: x })))));
		}
		const json = () => JSON.stringify({ format: "seedcraft-dictionary", version: 0,
			things: d.things.map((x) => Object.fromEntries(Object.entries({ name: x.name, emoji: x.emoji, colour: x.colour, photo: x.photo }).filter(([, v]) => v))) }, null, 1);
		// recovering, the dictionary is only used: no warning, no saving, another one instead of forgetting
		const reading = st.screen === "read";
		const count = h("span", { class: "meta", text: t.dictCount(d.things.length) });
		return tool(
			panel(...(reading ? [h("div", { class: "row between" }, h("span", { class: "label", text: t.tabDict }), count)] : stepHead("make", null, count)),
				h("div", { class: "dict-grid" }, d.things.map((x, i) => h("div", { class: "piece" }, h("span", { class: "num", text: String(i) }), icon(x, 34), h("span", { text: x.name }))))),
			panel(
				d.checked ? h("div", { class: "note ok" }, "✓ " + t.dictChecked) : reading ? null : h("div", { class: "note warn", text: t.dictNotChecked }),
				h("div", { class: "row" },
					h("button", { class: d.checked || reading ? "btn ghost" : "btn", on: { click: () => editDict({ kind: "check", i: 0 }) } }, t.dictCheck),
					h("button", { class: "btn ghost", on: { click: () => editDict({ kind: "name", things: d.things.map((x) => ({ ...x, symbolTyped: !!x.emoji && x.emoji !== initialsOf(x.name) })), i: 0 }) } }, t.dictEdit),
					reading ? h("button", { class: "btn ghost", on: { click: () => { setDict(null); render(); } } }, t.dictOther) : null),
				reading ? null : field(t.dictSave, h("p", { class: "meta", text: t.dictSaveHelp }),
					h("div", { class: "row" },
						h("button", { class: "btn ghost small", on: { click: () => download(json(), "dictionary.json", "application/json") } }, t.dictSaveJson),
						h("button", { class: "btn ghost small", on: { click: () => download(d.things.map((x) => x.name).join("\n") + "\n", "dictionary.txt", "text/plain") } }, t.dictSaveTxt))),
				reading ? null : h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.dictForgetAsk)) { setDict(null); render(); } } } }, t.dictForget)),
				!reading && keyDictNeeded() ? keyDictBlock() : null));
	}
	// pad mode, the key as things of another collection: its own dictionary (SPEC §11.4)
	function keyDictNeeded() { return st.mode === "pad" && st.plan.padAs === "string" && !!st.plan.padForm; }
	// The key's own collection: the backup's (st.plan, st.padDict) or, recovering,
	// the one being read's (st.read), which leaves the backup alone
	const keyColl = () => st.screen === "read"
		? { form: st.read.padForm, dict: st.read.padDict, set: (d) => { st.read.padDict = d; } }
		: { form: st.plan.padForm, dict: st.padDict, set: (d) => { st.padDict = d; st.make.check = null; } };
	// that dictionary, below the sequence's: made, ready-made or from a file; then checked like the other
	function keyDictBlock() {
		const t = T(), n = st.dict.things.length, kc = keyColl(), padForm = kc.form, pd = kc.dict;
		const label = h("div", { class: "label pad-label", text: t.padDictTitle + ": " + t.forms[padForm].name });
		const pick = (things, checked) => { kc.set({ things, checked: !!checked }); render(); };
		const name = (things) => editDict({ kind: "name", target: "pad", things, i: 0 });
		if (pd) return h("div", { class: "field key-dict" }, label,
			h("div", { class: "dictline" }, h("span", { class: "minis" }, pd.things.map((x) => icon(x, 22)))),
			pd.checked ? h("div", { class: "note ok" }, "✓ " + t.dictChecked) : h("div", { class: "note warn", text: t.dictNotChecked }),
			h("div", { class: "row" },
				h("button", { class: pd.checked ? "btn ghost small" : "btn small", on: { click: () => editDict({ kind: "check", target: "pad", i: 0 }) } }, t.dictCheck),
				h("button", { class: "btn ghost small", on: { click: () => name(pd.things.map((x) => ({ ...x, symbolTyped: !!x.emoji && x.emoji !== initialsOf(x.name) }))) } }, t.dictEdit),
				h("button", { class: "btn ghost small", on: { click: () => { kc.set(null); render(); } } }, t.dictOther)));
		const err = h("div");
		const open = h("input", { type: "file", accept: ".json,.txt,application/json,text/plain", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			try {
				const own = dictFromFile(await f.text(), f.name), problem = dictProblem(own);
				if (problem) { err.replaceChildren(errorBox(problem)); return; }
				if (own.length !== n) { err.replaceChildren(errorBox(t.errPadDictSize(own.length, n))); return; }
				pick(own);
			} catch (x) { err.replaceChildren(errorBox(t.errDictFile)); }
		} } });
		return h("div", { class: "field key-dict" }, label, h("p", { class: "meta", text: t.padDictHelp(n) }),
			h("div", { class: "row" }, h("button", { class: "btn small", on: { click: () => name(Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" }))) } }, t.dictName),
				h("button", { class: "btn ghost small", on: { click: () => open.click() } }, t.dictOpen), open),
			conventional(n, padForm, pick),
			field(t.padDictReady, readyDicts(n, padForm, pick)), err);
	}

	// naming the pieces one by one
	function nameScreen() {
		const t = T(), ed = st.edit, n = ed.things.length, x = ed.things[ed.i];
		const form = ed.target === "pad" ? keyColl().form || st.plan.form : st.plan.form;
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
			if (ed.target === "pad") keyColl().set({ things, checked: false });
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
				h("p", { class: "lead", text: t.nameHelp }),
				h("div", { class: "wizard" }, side(ed.i - 1), h("div", { class: "centre" }, preview), side(ed.i + 1)),
				h("div", { class: "name-row" }, field(t.thingName, nameIn), field(t.thingSymbol, symbolIn)),
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
		const t = T(), ed = st.edit, d = ed.target === "pad" ? keyColl().dict : st.dict, n = d.things.length, x = d.things[ed.i];
		return h("div", { class: "narrow" }, panel(
			h("div", { class: "row between" }, title(t.dictCheck), h("span", { class: "meta", text: t.pieceOf(ed.i, n) })),
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
	// The template drawn as squares. dark(r, c, bit): a square's colour (the QR
	// code's, or the bits read so far); fixedDark(r, c): a fixed square's (null:
	// not known yet); known(bit): whether a data square is filled in yet.
	function handGrid(size, dark, fixedDark, cells, known, current, onPick, done) {
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
				else if (known(bit)) cls = on ? "dark" : "light";
				else cls = "empty";
			}
			const rect = svg("rect", { x: m + c * cs, y: m + r * cs, width: cs, height: cs, class: "cell " + cls });
			if (!fn.has(key) && onPick) rect.addEventListener("click", () => onPick(owner.get(key)));
			g.append(rect);
		}
		return g;
	}

	// ---- one turn, piece by piece: the drawings both journeys share ---------------
	// A turn's k squares in a row, then their bits and their number. A bit of
	// the header or of the padding has no square in the QR code: its box is dashed.
	const squaresOf = (bits, roles) => h("span", { class: "squares", "aria-hidden": "true" },
		bits.map((b, j) => h("span", { class: "sq" + (b ? " on" : "") + (roles[j] !== "data" ? " " + roles[j] : "") })));
	function bitsStrip(bits, roles) {
		return h("div", { class: "bits-strip" }, squaresOf(bits, roles),
			h("span", { class: "arrow", text: "→" }), h("code", { text: bits.join("") }),
			h("span", { class: "arrow", text: "→" }), h("b", { class: "bits-num", text: String(parseInt(bits.join(""), 2)) }));
	}
	// The clock of N: the numbers 0 to n − 1 on a ring, and the arc from `from`
	// on by `by` steps, forwards (sign +1, making a copy) or backwards (−1,
	// recovering), going round past n − 1 or below 0. With n = 32 only every
	// fourth number is written, and the ones in the sum: from, the result, and
	// by in the middle.
	function clockSvg(n, from, by, sign) {
		const step = S.clockStep(from, by, n, sign), to = step.value, R = 72, c = 100;
		const angle = (v) => 2 * Math.PI * v / n - Math.PI / 2;
		const at = (v, r = R) => [c + r * Math.cos(angle(v)), c + r * Math.sin(angle(v))];
		const g = svg("svg", { class: "clock", viewBox: "0 0 200 200", role: "img",
			"aria-label": `${from} ${sign > 0 ? "+" : "−"} ${by} → ${to} (${n})` }, svg("circle", { cx: c, cy: c, r: R, class: "clock-ring" }));
		if (by % n) {
			const [x0, y0] = at(from), [x1, y1] = at(to), a = angle(to);
			// the arrow's head points along the ring, the way it goes
			const dx = -Math.sin(a) * sign, dy = Math.cos(a) * sign, px = Math.cos(a), py = Math.sin(a);
			const head = [[x1, y1], [x1 - 11 * dx + 6 * px, y1 - 11 * dy + 6 * py], [x1 - 11 * dx - 6 * px, y1 - 11 * dy - 6 * py]];
			g.append(svg("path", { class: "clock-arc", d: `M${x0},${y0} A${R},${R} 0 ${by / n > 0.5 ? 1 : 0} ${sign > 0 ? 1 : 0} ${x1},${y1}` }),
				svg("polygon", { class: "clock-head", points: head.map((p) => p.join(",")).join(" ") }));
		}
		for (let v = 0; v < n; v++) {
			const [x, y] = at(v), role = v === to ? " to" : v === from ? " from" : v === 0 && step.wrapped ? " wrap" : "";
			g.append(svg("circle", { cx: x, cy: y, r: n > 16 ? 2.5 : 3.5, class: "tick" + role }));
			if (n <= 16 || v % 4 === 0 || v === from || v === to) {
				const [lx, ly] = at(v, R + 16);
				g.append(svg("text", { x: lx, y: ly + 4, "text-anchor": "middle", class: "clock-n" + role }, String(v)));
			}
		}
		g.append(svg("text", { x: c, y: c + 10, "text-anchor": "middle", class: "clock-by" }, (sign > 0 ? "+" : "−") + by));
		return g;
	}
	// The collection as a table to translate with: every piece with its number
	// and its bits, the row of `value` marked.
	// onPick(v): the table is the palette to tap a piece in (reading one back).
	// only: just the row of `value`.
	const collectionRow = (things, value, k, onPick, only) => h("div", { class: "collection" + (onPick ? " pick" : "") }, things.map((x, v) => only && v !== value ? null :
		h(onPick ? "button" : "div", { class: "crow" + (v === value ? " on" : ""), title: x.name, "aria-label": onPick ? x.name : null,
			"aria-pressed": onPick ? String(v === value) : null, on: onPick ? { click: () => onPick(v) } : null },
			h("span", { class: "num", text: String(v) }), h("code", { text: v.toString(2).padStart(k, "0") }), icon(x, 24, false, v === value))));
	// The QR code's template for a turn: the squares of `turn` (S.turnBits)
	// marked with their row and column; those in `painted` (bit → 0 or 1)
	// filled in. qr: the seed's QR code, if known (its format squares; once
	// every square is painted and no turn is open, a QR code to scan).
	// onPick(bit): a square clicked.
	function turnGrid(size, qr, painted, turn, onPick) {
		const cells = S.dataModulesRowMajor(size), current = { bits: new Set(), rows: new Set(), cols: new Set() };
		for (const b of turn) if (b.cell) { current.bits.add(b.bit); current.rows.add(b.cell[0]); current.cols.add(b.cell[1]); }
		const done = !!qr && !turn.length && cells.every((_, b) => painted.has(b));
		const fixed = qr ? (r, c) => qr.getModule(c, r) : (r, c) => S.templateModule(size, r, c);
		return handGrid(size, (r, c, bit) => painted.get(bit) === 1, fixed, cells, (bit) => painted.has(bit), current, onPick || null, done);
	}

	// A turn's controls: back, where it is, on (and the rest), in one row at the
	// top of the column, stuck there while what is under it scrolls: never
	// below the fold, and never mistaken for the journey's own back and on.
	const turnNav = (...controls) => h("div", { class: "row turn-nav" }, ...controls);

	// One sequence to make, piece by piece, in two columns: on the left the
	// piece in hand and the controls, on the right the whole of it (the
	// drawing as a map that follows the piece, or the list), always in view.
	// opts: posKey (where it is), tabKey (which view), listName (its file),
	// help (a note above the piece), turns (offer the turn by turn view
	// first: the caller draws it), things (its dictionary, if not the
	// sequence's), form, pad. Returns { tabs, left, right }.
	function stringViews(string, opts) {
		const t = T(), m = st.make, things = opts.things || st.dict.things, L = string.length, form = opts.form || st.plan.form;
		const views = [opts.turns ? ["turn", t.tabTurns] : null, ["walk", t.tabWalk], ["list", t.tabList]].filter(Boolean);
		if (!views.some(([v]) => v === m[opts.tabKey])) m[opts.tabKey] = views[0][0];
		const tab = m[opts.tabKey], left = [], right = [];
		if (tab === "walk") {
			const thing = (i) => things[string[i]];
			const pos = Math.min(m[opts.posKey] || 0, L - 1);
			const move = (to) => { m[opts.posKey] = Math.max(0, Math.min(L - 1, to)); render(); };
			const side = (i, label) => h("div", { class: "side" }, i >= 0 && i < L ? [hint(`${label} ${i + 1}`), icon(thing(i), 44), h("div", { class: "small-name", text: thing(i).name })] : null);
			if (opts.help) left.push(h("div", { class: "note" + (opts.pad ? " pad" : ""), text: opts.help }));
			left.push(
				h("div", { class: "label", text: t.walkOf(pos + 1, L) }),
				h("div", { class: "wizard" }, side(pos - 1, t.prevPiece), h("div", { class: "centre" }, icon(thing(pos), 104), h("div", { class: "name", text: thing(pos).name })), side(pos + 1, t.nextPiece)),
				bar((pos + 1) / L),
				h("div", { class: "row" },
					h("button", { class: "btn ghost", title: t.walkHelp, disabled: pos === 0 ? "" : undefined, on: { click: () => move(pos - 1) } }, "◀ " + t.prevPiece),
					h("button", { class: "btn push", title: t.walkHelp, on: { click: () => pos < L - 1 ? move(pos + 1) : null } }, pos < L - 1 ? t.nextPiece + " ▶" : "✓ " + t.done)));
			right.push(hint(t.forms[form].drawing), h("div", { class: "map tall" }, drawSeq(things, string, { current: pos, onPick: (i) => move(i), pad: opts.pad, form })));
		}
		if (tab === "list") {
			const text = string.map((s, i) => `${i + 1}. ${things[s].name}`).join("\n");
			left.push(hint(t.listHelp), h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(text + "\n", opts.listName, "text/plain") } }, t.saveList)));
			right.push(h("pre", { class: "code", text }));
		}
		return { tabs: seg(views, tab, (v) => { m[opts.tabKey] = v; render(); }), left, right };
	}

	// ---- make, 4: the key (pad mode) ----------------------------------------------
	// The key comes first: L numbers, each pure chance, drawn one piece at a time
	// by the person (a bag, coins, a die) or by the device (SPEC §10.2). Its
	// state is st.make.key (see S.keyMove); st.make.pad, its numbers once all L
	// are there. A piece once drawn stays: moving only shows it again, and only
	// the first missing one is drawn. One set by hand can be marked again
	// ("Fix"), never thrown again.
	const KEY_ROW = 16;  // numbers per row of the key file, each row closed by its check character
	const keyLength = () => symbolsFor(st.plan.words, st.dict.things.length);
	// a coin is a die of 2 sides; the bag and the device throw nothing
	const sidesOf = (by) => by === "coin" ? 2 : /^d\d+$/.test(by || "") ? Number(by.slice(1)) : 0;
	const hasReroll = (throws, by) => sidesOf(by) > 0 && throws.some((f) => f >= S.diceBits(sidesOf(by)).keep);
	const closesRow = (i, L) => (i + 1) % KEY_ROW === 0 || i === L - 1;
	// the key is complete, and as long as the seed planned
	const keyReady = () => !!st.make.pad && !!st.dict && st.make.pad.length === keyLength();
	// the key as it now is and, once complete, its numbers. A sequence already
	// made with it follows a fixed piece: the pieces of it that changed are
	// kept in m.keyChanged, to be told and fixed on the string, and it is
	// checked again.
	function setKey(key) {
		const m = st.make, n = st.dict.things.length, L = keyLength(), was = m.pad;
		m.key = key;
		m.pad = key.pieces.length === L ? key.pieces.map((p) => p.value) : null;
		if (String(was) === String(m.pad)) return;
		m.padKept = false;
		if (m.basic && m.pad) {
			const before = m.symbols;
			m.symbols = S.encrypt(m.basic, m.pad, n); m.checked = false; m.check = null;
			if (before) m.keyChanged = [...new Set([...(m.keyChanged || []), ...S.changedPieces(before, m.symbols)])].sort((a, b) => a - b);
		}
	}
	// the pieces of the sequence changed by a key corrected after it was made, each a way to its turn
	function keyChangedNote() {
		const t = T(), m = st.make, changed = m.symbols && m.keyChanged || [];
		if (!changed.length) return null;
		const toTurn = (j) => { st.seen.howTo = true; m.tab = "turn"; m.turn = j; toStep("make", "seq"); };
		return h("div", { class: "note warn" }, t.keyChanged(changed.length), " ",
			...changed.slice(0, 6).map((j) => h("button", { class: "btn ghost small", on: { click: () => toTurn(j) } }, t.readPiece(j + 1))));
	}
	// to another piece; the lines explained on the one left are not shown again
	function keyGo(to) {
		if (keyRolling) return;
		const key = st.make.key, p = key.pieces[key.pos], L = keyLength();
		st.seen.keyWhy = true;
		if (p && hasReroll(p.throws, p.by)) st.seen.reroll = true;
		if (p && lastPart(p.throws, sidesOf(p.by), Math.log2(st.dict.things.length))) st.seen.keyPart = true;
		if (p && st.plan.padAs === "file" && closesRow(key.pos, L)) st.seen.rowCheck = true;
		setKey(S.keyMove(key, to, L));
		render();
	}
	// a die with a number on it; rolling, it spins (CSS, unless reduced motion)
	const diceSvg = (face, rolling) => svg("svg", { class: "die" + (rolling ? " rolling" : ""), viewBox: "0 0 100 100", "aria-hidden": "true" },
		svg("rect", { x: 10, y: 10, width: 80, height: 80, rx: 18, class: "die-body" }),
		svg("text", { x: 50, y: 64, "text-anchor": "middle", class: "die-face" }, face === null ? "?" : String(face)));
	let keyRolling = false;
	// The throw that closes a piece giving more bits than it still needs (a
	// d20 for N = 32: 4 bits, then 4 again, but only 1 left): { at, part }, the
	// throw and how many of its first bits count; null if every bit counts.
	// Which throws count is throwsToNumber's (used); only its bits are split here
	function lastPart(throws, sides, k) {
		const r = sides && throws.length ? S.throwsToNumber(throws, sides, k) : null;
		if (!r) return null;
		const b = S.diceBits(sides).b, part = r.bits.length - b * (r.used.length - 1);
		return part < b ? { at: r.used[r.used.length - 1], part } : null;
	}
	// one throw as it is read: the face marked, its number from 0, its bits or
	// "again"; part: only its first bits count, the rest struck out
	function throwText(f, sides, part) {
		const t = T(), { b, keep } = S.diceBits(sides), bits = f.toString(2).padStart(b, "0");
		const out = f >= keep ? t.keyAgain : part ? [h("b", { text: bits.slice(0, part) }), h("s", { text: bits.slice(part) })] : bits;
		if (sides === 2) return [`${f ? t.coinHeads : t.coinTails} → `, out];
		if (sides === 10) return [`${t.keyFace} ${f} → `, out];  // a d10 is marked 0–9: already from 0
		return [`${t.keyFace} ${f + 1} → ${f} → `, out];
	}
	// the throws of a piece, and once it is complete its bits and number
	function throwTrail(throws, sides, k) {
		const r = throws.length ? S.throwsToNumber(throws, sides, k) : null, keep = S.diceBits(sides).keep, cut = lastPart(throws, sides, k);
		return h("ol", { class: "trail" }, throws.map((f, j) => h("li", { class: f >= keep ? "again" : null }, ...throwText(f, sides, cut && cut.at === j ? cut.part : 0))),
			r ? h("li", { class: "total", text: `${r.bits.join("")} → ${r.value}` }) : null);
	}
	function keyStep() {
		const t = T(), m = st.make, n = st.dict.things.length, k = Math.log2(n), L = keyLength();
		const asString = st.plan.padAs === "string", own = asString && !!st.plan.padForm;
		const form = own ? st.plan.padForm : st.plan.form, things = own ? st.padDict.things : st.dict.things;
		setKey(m.key || { by: null, pieces: [], pos: 0, draft: [], fix: null });
		const key = m.key, have = key.pieces.length, values = key.pieces.map((p) => p.value);
		const update = (next) => { setKey(next); render(); };
		// a key file goes on only once saved: Check reads it, and Store forgets it here
		setNav({ ready: have === L && (asString || !!m.padKept) });

		// on the right, the key as it grows: its map or its list, or its file
		const right = [];
		if (asString) {
			const tab = have && m.keyTab === "list" ? "list" : "map";
			right.push(h("div", { class: "note pad", text: t.padStringHelp }));
			if (have) right.push(seg([["map", t.tabWalk], ["list", t.tabList]], tab, (v) => { m.keyTab = v; render(); }));
			if (!have) right.push(h("div", { class: "key-empty" }, art("keyThings"), hint(t.keyEmpty)));
			else if (tab === "map") right.push(hint(t.forms[form].drawing),
				h("div", { class: "map tall" }, drawSeq(things, values, { current: key.pos, onPick: (i) => keyGo(i), pad: true, form })));
			else {
				// the same key as names, one per line; saved only once it is whole
				const text = values.map((v, i) => `${i + 1}. ${things[v].name}`).join("\n");
				right.push(hint(t.listHelp), h("pre", { class: "code" }, text),
					have === L ? h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => download(text + "\n", "list-b.txt", "text/plain") } }, t.saveList)) : null);
			}
		} else {
			const lines = have ? S.writePadFile(values, n).trimEnd().split("\n") : [""];
			lines[0] = `${L} ${n}`;
			// a row still open has no check character yet
			if (have < L && have % KEY_ROW) lines[lines.length - 1] = lines[lines.length - 1].replace(/ \S$/, "");
			const row = 1 + Math.floor(key.pos / KEY_ROW);
			right.push(h("div", { class: "label pad-label", text: t.padFileTitle }), hint(t.padFileHelp),
				h("pre", { class: "code pad-file" }, lines.map((x, i) => h("span", { class: i === row ? "on" : null, text: x + "\n" }))));
			if (key.pieces[key.pos] && !key.fix && closesRow(key.pos, L) && !st.seen.rowCheck) right.push(h("div", { class: "note pad", text: t.keyRowCheck }));
			if (have === L) right.push(m.padKept ? null : h("div", { class: "note warn", text: t.keySaveFirst }), h("div", { class: "row" }, h("button", { class: m.padKept ? "btn ghost" : "btn",
				on: { click: () => { download(S.writePadFile(m.pad, n), "numbers.txt", "text/plain"); m.padKept = true; render(); } } }, t.padFileSave)));
		}

		// who draws: the person, with what; or the device
		if (!key.by) {
			const who = m.keyWho;
			const option = (value, glyph, label, help) => h("button", { class: "choice" + (who === value ? " on" : ""), "aria-pressed": String(who === value),
				on: { click: () => { m.keyWho = value; if (value === "device") update({ ...key, by: "device", draft: [] }); else render(); } } },
				h("span", { class: "glyph", "aria-hidden": "true", text: glyph }), h("b", { text: label }), h("span", { text: help }));
			// a bag only of pieces you can hold
			const tools = [formOf(form).family !== "written" ? ["bag", t.toolBag] : null, ["coin", t.toolCoin],
				...S.DICE.filter((s) => s !== 2).map((s) => ["d" + s, "🎲 d" + s])].filter(Boolean);
			return tool(panel(...stepHead("make", t.keyLead), keyChangedNote(),
				h("div", { class: "choices" }, option("me", "✋", t.keyMe, t.keyMeHelp), option("device", "🖥️", t.keyDevice, t.keyDeviceHelp)),
				who === "me" ? field(t.keyTools, h("div", { class: "row" }, tools.map(([by, label]) =>
					h("button", { class: "btn ghost", on: { click: () => update({ ...key, by, draft: [] }) } }, label)))) : null,
				h("div", { class: "note warn", text: t.keyOffline })),
			panel(...right));
		}

		// piece by piece: the piece at pos, drawn or to draw (or being marked again)
		const pos = key.pos, piece = key.fix ? null : key.pieces[pos];
		const markBy = key.fix ? key.pieces[key.fix.at].by : key.by, sides = sidesOf(markBy);
		const throws = piece ? piece.throws : key.draft, throwsBy = piece ? piece.by : markBy;
		const die = h("div", { class: "die-box" }, diceSvg(null, false));
		const busy = [], waits = (b) => { busy.push(b); return b; };  // the buttons that wait while the die rolls
		const draw = () => {
			if (keyRolling) return;
			const value = S.newPad(1, n)[0];
			const put = () => {
				keyRolling = false;
				const x = m.key;
				if (st.screen === "make" && st.step.make === "key" && x && x.by === "device" && !x.fix && x.pieces.length < keyLength()) update(S.keyAddPiece(x, value, "device", [], keyLength()));
				else render();
			};
			keyRolling = true;
			busy.forEach((b) => { b.disabled = true; });
			// it spins (~600 ms) and stops on the number, which stays a moment; with reduced motion, the number at once
			const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
			die.replaceChildren(diceSvg(value, !still));
			setTimeout(() => { die.replaceChildren(diceSvg(value, false)); setTimeout(put, 500); }, still ? 0 : 600);
		};
		const all = () => {
			if (keyRolling) return;
			let x = S.keyMove(m.key, m.key.pos, L);
			for (const v of S.newPad(L - x.pieces.length, n)) x = S.keyAddPiece(x, v, "device", [], L);
			st.seen.keyWhy = true;
			update(S.keyMove(x, L - 1, L));
		};
		// a throw marked by hand: the piece's own coin or die when marking it again
		const mark = (f) => update({ ...S.keyAddThrow({ ...m.key, by: markBy }, f, sides, k, L), by: key.by });
		const side = (i) => h("div", { class: "side" }, i >= 0 && i < have && i !== pos
			? [hint(`${i < pos ? t.prevPiece : t.nextPiece} ${i + 1}`), icon(things[values[i]], 44), h("div", { class: "small-name", text: things[values[i]].name })] : null);
		const centre = piece
			? h("div", { class: "centre" }, icon(things[piece.value], 104), h("div", { class: "name", text: things[piece.value].name }),
				h("div", { class: "meta", text: t.keyNumber(piece.value, piece.value.toString(2).padStart(k, "0")) }))
			: h("div", { class: "centre" }, markBy === "device" ? die : icon({}, 104));
		const controls = [];
		if (key.fix) controls.push(h("div", { class: "row between" }, h("span", { class: "label pad-label", text: t.keyFixing(pos + 1) }),
			h("button", { class: "btn ghost small", on: { click: () => keyGo(pos) } }, t.keyFixCancel)));
		if (piece) {
			if (piece.by === "device") controls.push(h("div", { class: "row key-by" }, diceSvg(piece.value, false), hint(t.keyByDevice)));
			else controls.push(piece.by === "bag" ? hint(t.keyByBag) : throwTrail(piece.throws, sidesOf(piece.by), k),
				h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => update(S.keyFix(key)) } }, t.keyFix)));
		} else if (markBy === "device") controls.push(h("div", { class: "row" }, waits(h("button", { class: "btn", on: { click: draw } }, "🎲 " + t.keyRoll))));
		else if (markBy === "bag") controls.push(hint(t.keyBagHow), h("div", { class: "palette" }, things.map((x, i) =>
			h("button", { class: "pal", title: x.name, "aria-label": x.name, on: { click: () => update(S.keyAddPiece(m.key, i, "bag", [], L)) } }, icon(x, 40)))));
		else {
			const faces = sides === 2 ? [[1, t.coinHeads], [0, t.coinTails]] : Array.from({ length: sides }, (_, f) => [f, String(sides === 10 ? f : f + 1)]);
			controls.push(hint(sides === 2 ? t.keyThrowCoin : t.keyThrowDie),
				h("div", { class: "faces" }, faces.map(([f, label]) => h("button", { class: "btn ghost face", on: { click: () => mark(f) } }, label))),
				throws.length ? throwTrail(throws, sides, k) : null,
				// a face tapped by mistake: take it back (not a throw made again)
				throws.length ? h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => update(S.keyUndoThrow(m.key)) } }, "↶ " + t.keyUndo),
					h("span", { class: "meta", text: t.keyUndoHelp })) : null);
		}
		// Next on the first missing piece draws it (device) or waits for the throws
		const onNext = !piece && !key.fix ? (key.by === "device" ? draw : null) : pos < L - 1 ? () => keyGo(pos + 1) : null;
		const aside = h("div", { class: "row key-method" },
			h("span", { class: "meta", text: key.by === "device" ? t.keyDevice : key.by === "bag" ? t.toolBag : key.by === "coin" ? t.toolCoin : "🎲 " + key.by }),
			key.draft.length || key.fix ? null : h("button", { class: "btn ghost small", on: { click: () => { m.keyWho = null; update({ ...key, by: null }); } } }, t.keyChange));
		return tool(
			panel(...stepHead("make", null, aside), keyChangedNote(),
				h("div", { class: "label", text: t.walkOf(pos + 1, L) }),
				h("div", { class: "wizard" }, side(pos - 1), centre, side(pos + 1)),
				st.seen.keyWhy ? null : hint(t.keyWhy),
				...controls,
				hasReroll(throws, throwsBy) && !st.seen.reroll ? h("div", { class: "note pad", text: t.keyRerollWhy }) : null,
				lastPart(throws, sidesOf(throwsBy), k) && !st.seen.keyPart ? h("div", { class: "note pad", text: t.keyPartUsed(k) }) : null,
				h("div", { class: "row" },
					h("button", { class: "btn ghost", disabled: pos === 0 ? "" : undefined, on: { click: () => keyGo(pos - 1) } }, "◀ " + t.prevPiece),
					key.by === "device" && have < L ? waits(h("button", { class: "btn ghost small", on: { click: all } }, t.seeAll)) : null,
					piece && pos === L - 1 ? null : waits(h("button", { class: "btn push", disabled: onNext ? undefined : "", on: { click: () => { if (onNext) onNext(); } } },
						t.nextPiece + " ▶"))),
				bar(have / L)),
			panel(...right));
	}

	// ---- make, 5: the sequence ----------------------------------------------
	// another seed: its words go, and in pad mode the key too: it starts again from the key (one key, one seed: SPEC §10.8)
	function otherSeed() {
		const m = st.make;
		m.seed = ""; m.symbols = m.entropy = m.basic = m.check = m.keyChanged = null;
		m.checked = m.stored = false;
		if (st.mode !== "pad") { render(); return; }
		m.key = m.pad = null; m.keyWho = null; m.padKept = false;
		toStep("make", "key");
	}
	function seqStep() {
		const t = T(), m = st.make, d = st.dict;
		const n = d.things.length, k = Math.log2(n), padMode = st.mode === "pad";
		if (!m.symbols) {
			const area = h("textarea", { class: "input mono", rows: 3, spellcheck: "false", autocomplete: "off", "aria-label": t.seedTitle, placeholder: "height demise useless trap grow lion found off key clown transfer enroll" });
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
				panel(...stepHead("make", t.seedHelpPlanned(st.plan.words)), seedAlert(),
					h("div", { class: "field" }, area, status, print,
						h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => test(st.plan.words === 12 ? 16 : 32) } }, st.plan.words === 12 ? t.seedTest12 : t.seedTest24))),
					err,
					h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => {
						if (!check()) { err.replaceChildren(errorBox(t.errWordsPlanned(st.plan.words))); return; }
						m.entropy = S.mnemonicToEntropy(m.seed);
						if (padMode) {
							// the basic sequence plus the key of the step before, mod N (SPEC §10.3)
							m.basic = S.encode(m.entropy, k);
							m.symbols = S.encrypt(m.basic, m.pad, n);
						} else m.symbols = S.encode(m.entropy, k);
						m.pos = m.turn = 0; m.tab = "turn";
						m.checked = m.stored = false; m.check = null; m.keyChanged = null;
						render();
					} } }, t.makeIt))),
				panel(h("p", { class: "lead", text: padMode ? t.seqPadIntro : t.seqIntro }), kindsRow(st.plan.form, n, 0, d.things)));
		}
		return composeStep();
	}
	// to another turn of the sequence (L: all of it); the first turn's why is then not shown again
	function turnGo(to) {
		const m = st.make;
		if (!(m.turn > 0) && to > 0) st.seen[st.mode === "pad" ? "whyPad" : "whyBasic"] = true;
		m.turn = Math.max(0, Math.min(m.symbols.length, to));
		render();
	}
	// The sequence made, turn by turn (SPEC §3, §10.3): each turn takes the
	// next k squares of the seed's QR code, reads them as bits and a number,
	// in pad mode adds the key's piece on the clock of N, and gives the piece
	// to put on the string. Before the first turn, once, how it goes. The map
	// and the list stay as views, for whoever already knows.
	function composeStep() {
		const t = T(), m = st.make, things = st.dict.things, n = things.length, k = Math.log2(n), padMode = st.mode === "pad";
		const L = m.symbols.length, each = S.piecesToBuy(m.symbols, n), form = st.plan.form, written = formOf(form).family === "written";
		const head = (aside) => stepHead("make", null, h("span", { class: "meta", text: aside }));
		if (!st.seen.howTo) {
			// four boxes in a row, drawn the same for every seed (none of it is the seed's own)
			const ex = "10110".slice(0, k).split("").map(Number);
			const words = svg("svg", { class: "howto-pic", viewBox: "0 0 60 40", "aria-hidden": "true" },
				[0, 1, 2].map((r) => svg("path", { d: `M6,${8 + r * 12} h${18 - r * 3} M30,${8 + r * 12} h${22 - r * 4}` })));
			const qrPic = svg("svg", { class: "howto-pic", viewBox: "0 0 21 21", "aria-hidden": "true" }, svg("rect", { width: 21, height: 21, fill: "#ffffff" }),
				[[0, 0], [0, 14], [14, 0]].flatMap(([r, c]) => [svg("rect", { x: c + 0.5, y: r + 0.5, width: 6, height: 6, fill: "none", stroke: "#1c2826" }),
					svg("rect", { x: c + 2, y: r + 2, width: 3, height: 3, fill: "#1c2826" })]),
				[[9, 9], [9, 11], [10, 10], [11, 8], [12, 12], [14, 15], [15, 10], [16, 13], [17, 17], [18, 11], [9, 16], [12, 18], [19, 19], [8, 3], [10, 5]]
					.map(([r, c]) => svg("rect", { x: c, y: r, width: 1, height: 1, fill: "#1c2826" })));
			const box = (pic, text) => h("div", { class: "howto-box" }, pic, h("p", { text }));
			return h("div", { class: "narrow howto" }, panel(...head(t.total(L)), h("p", { class: "lead", text: t.howToLead }),
				h("div", { class: "howto-row" }, box(words, t.howToWords(st.plan.words)), box(qrPic, t.howToQr),
					box(squaresOf(ex, ex.map(() => "data")), t.howToBits), box(h("b", { class: "bits-num", text: String(parseInt(ex.join(""), 2)) }), t.howToNums(k, n))),
				h("p", { class: "howto-scanner", text: t.howToScanner }),
				h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => { st.seen.howTo = true; m.turn = 0; m.tab = "turn"; render(); } } }, t.howToGo + " ▶"))));
		}
		const v = stringViews(m.symbols, { posKey: "pos", tabKey: "tab", listName: padMode ? "list-a.txt" : "sequence.txt",
			help: padMode ? t.seqStringHelp : t.forms[form].make, turns: true });
		// the safety alert right under the step's name
		const alert = h("div", { class: "alert", text: padMode ? t.padMakeWarn : t.makeWarn });
		const rest = [h("details", { class: "more" }, h("summary", { text: t.seqAbout }),
				fingerprintLine(m.entropy),
				written ? null : h("p", { text: t.shop(each, n) }),
				h("p", { text: materialsOf(form, L, n) }),
				h("div", { class: "row" },
					h("button", { class: "btn ghost small", on: { click: () => { if (confirm(t.otherSeedAsk(st.mode))) otherSeed(); } } }, "◀ " + t.otherSeed))),
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => go("print") } }, "🖨 " + t.printIt))];
		if (m.tab !== "turn") return tool(panel(...head(t.total(L)), alert, ...v.left, v.tabs, ...rest), panel(...v.right));

		// the seed's own sequence (in pad mode, before the key), and its bits
		const plain = padMode ? m.basic : m.symbols, bits = S.symbolsToBits(plain, k);
		const qr = S.compactSeedQR(m.entropy), size = qr.size, ndata = S.dataModulesRowMajor(size).length;
		const i = Math.max(0, Math.min(L, m.turn || 0)), done = i === L, turn = done ? [] : S.turnBits(size, i, k);
		const painted = new Map();
		for (let b = 0; b < Math.min(ndata, (i + 1) * k); b++) painted.set(b, bits[b]);
		const left = [];
		if (!done) {
			const P = plain[i], C = m.symbols[i], roles = turn.map((b) => b.role), byRow = new Map();
			for (const { cell } of turn) if (cell) { if (!byRow.has(cell[0])) byRow.set(cell[0], []); byRow.get(cell[0]).push(cell[1] + 1); }
			if (i === 0 && !st.seen[padMode ? "whyPad" : "whyBasic"]) left.push(h("div", { class: "note" + (padMode ? " pad" : ""), text: padMode ? t.whyPad : t.whyBasic(n, k) }));
			left.push(h("div", { class: "turn-part" }, hint(t.turnSquares), bitsStrip(turn.map((b) => bits[b.bit]), roles),
				byRow.size ? hint(t.handCells([...byRow].map(([r, cs]) => [r + 1, cs]))) : null));
			if (padMode) {
				// + the key's piece, on the clock of N
				const K = m.pad[i], sum = S.clockStep(P, K, n, 1), raw = P + K, keyThings = st.plan.padAs === "string" ? (!st.plan.padForm ? things : st.padDict ? st.padDict.things : null) : null;
				left.push(h("div", { class: "turn-key" }, clockSvg(n, P, K, 1), h("div", { class: "stack tight" },
					h("div", { class: "row key-line" }, h("span", { class: "pad-label", text: t.turnKey(i + 1) }), keyThings ? icon(keyThings[K], 30) : null, h("b", { class: "bits-num", text: String(K) })),
					h("code", { class: "turn-sum", text: `${P} + ${K} = ${raw}` + (sum.wrapped ? ` → ${raw} − ${n} = ${sum.value}` : "") }),
					hint(t.turnClock(P, K, n, sum.wrapped)))));
			}
			// in pad mode only the piece's row, unless the whole table is asked for (and then from turn to turn)
			const whole = !padMode || st.wholeTable;
			left.push(h("div", { class: "turn-part" }, collectionRow(things, C, k, null, !whole), hint(t.turnCollection(C)),
					padMode ? h("div", { class: "row" }, h("button", { class: "btn ghost small", "aria-expanded": String(whole),
						on: { click: () => { st.wholeTable = !whole; render(); } } }, whole ? t.tableOne : t.tableAll)) : null),
				h("div", { class: "turn-piece" }, icon(things[C], 64), h("div", { class: "stack tight" }, h("b", { class: "name", text: things[C].name }), h("span", { text: t.turnPut }))),
				(m.keyChanged || []).includes(i) ? h("div", { class: "note warn", text: t.seqKeyChanged }) : null);
			// the last turns are the header (version and mask) and the padding: no squares of the QR code
			if (roles.includes("header")) left.push(h("div", { class: "note" }, t.handHeader, " ", h("b", { text: t.handTemplate(size, qr.mask) })));
			if (roles.includes("padding")) left.push(h("div", { class: "note", text: t.handPadding }));
		} else left.push(h("div", { class: "note ok", text: "✓ " + t.handDone }), hint(t.handTemplate(size, qr.mask)),
			h("div", { class: "note" + (padMode ? " pad" : ""), text: padMode ? t.endPad : t.endBasic }));
		const nav = turnNav(
			h("button", { class: "btn ghost", disabled: i === 0 ? "" : undefined, on: { click: () => turnGo(i - 1) } }, "◀ " + t.prevPiece),
			h("span", { class: "meta", text: t.handStep(Math.min(i + 1, L), L) }),
			done ? null : h("button", { class: "btn", on: { click: () => turnGo(i + 1) } }, t.nextPiece + " ▶"),
			h("button", { class: "btn ghost small push", on: { click: () => turnGo(done ? 0 : L) } }, done ? t.handRestart : t.seeAll));
		// on the right, the QR code with this turn's squares, and the string so far
		return tool(panel(...stepHead("make"), alert, nav, ...left, v.tabs, ...rest),
			panel(turnGrid(size, qr, painted, turn, (bit) => turnGo(Math.floor(bit / k))),
				h("div", { class: "map turn-map" }, drawSeq(things, done ? m.symbols : m.symbols.slice(0, i + 1), { current: done ? -1 : i, onPick: turnGo, form }))));
	}

	// ---- make, 6: read it back --------------------------------------------------
	function checkStep() {
		const m = st.make;
		if (!m.check) m.check = freshRead();
		// read as it was made; a key file made here is read as it is (the key as things is read back like the sequence)
		Object.assign(m.check, { mode: st.mode, words: st.plan.words, padAs: st.plan.padAs, padForm: st.plan.padForm, padDict: st.padDict });
		if (st.mode === "pad" && st.plan.padAs === "file") m.check.keyFile = m.pad;
		return turnReader(m.check, { expect: m.entropy });
	}

	// ---- make, 7: store it ------------------------------------------------------
	function storeStep() {
		const t = T(), m = st.make, padMode = st.mode === "pad";
		const items = padMode ? t.storePad : t.storeBasic;
		// a key file made here and never saved: forgetting would lose the seed, so it is saved first
		const unsaved = padMode && st.plan.padAs === "file" && !!m.pad && !m.padKept;
		// one column: what to do, then forgetting the seed here
		return h("div", { class: "narrow" }, panel(...stepHead("make"),
				h("ul", { class: "checks" }, items.map((x) => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", { text: x }))))),
				unsaved ? h("div", { class: "note warn" }, t.storeKeyUnsaved, " ", h("button", { class: "btn small",
					on: { click: () => { download(S.writePadFile(m.pad, st.dict.things.length), "numbers.txt", "text/plain"); m.padKept = true; render(); } } }, t.padFileSave)) : null,
				h("div", { class: "row forget" }, h("button", { class: "btn", disabled: unsaved ? "" : undefined, on: { click: () => {
					if (!confirm(t.storeForgetAsk(st.mode))) return;
					st.make = { seed: "", entropy: null, symbols: null, pos: 0, tab: "turn" };
					st.read = freshRead(); st.gathered = false; fingerprints.clear();
					st.step.make = "plan";
					go("intro");
				} } }, t.storeForget), h("span", { class: "meta", text: t.storeForgetWhy }))));
	}

	// keyboard for the old step-by-step views (a legacy slide's onKey): the
	// arrows (and the space bar) are theirs where they move among turns or
	// pieces, which they say by returning true; anywhere else the lectern's
	// own keys go to the next or previous slide
	function legacyKey(e) {
		if (/input|textarea|select/i.test(e.target.tagName)) return false;
		const m = st.make, navKey = e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === " ";
		const step = (obj, key, max) => {
			if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); obj[key] = Math.min(max, (obj[key] || 0) + 1); render(); }
			if (e.key === "ArrowLeft") { e.preventDefault(); obj[key] = Math.max(0, (obj[key] || 0) - 1); render(); }
			return navKey;
		};
		// reading turn by turn: the arrows move among the turns read (the space bar is left to the buttons)
		const rd = st.edit || !st.dict ? null : st.screen === "read" && st.step.read === "recover" && st.read.mode && keyGiven() ? st.read
			: st.screen === "make" && st.step.make === "check" && m.symbols ? m.check : null;
		if (rd && !rd.typing) {
			if (e.key === "ArrowRight") { e.preventDefault(); readGo(rd, rd.turn + 1); }
			if (e.key === "ArrowLeft") { e.preventDefault(); readGo(rd, rd.turn - 1); }
			return navKey;
		}
		// the key: only moves among the pieces drawn, never draws (the space bar is left to the buttons)
		if (st.screen === "make" && st.step.make === "key" && m.key && m.key.by && !st.edit) {
			if (e.key === "ArrowRight") { e.preventDefault(); keyGo(m.key.pos + 1); }
			if (e.key === "ArrowLeft") { e.preventDefault(); keyGo(m.key.pos - 1); }
			return navKey;
		}
		if (st.screen !== "make" || !m.symbols) return false;
		if (st.step.make === "seq" && m.tab === "turn") {
			if (!st.seen.howTo) return navKey;
			if (e.key === "ArrowRight") { e.preventDefault(); turnGo((m.turn || 0) + 1); }
			if (e.key === "ArrowLeft") { e.preventDefault(); turnGo((m.turn || 0) - 1); }
			return navKey;
		}
		if (st.step.make === "seq" && m.tab === "walk") return step(m, "pos", m.symbols.length - 1);
		return false;
	}

	// ---- read ------------------------------------------------------------
	// read, 1: what you have — the mode it was made in, its dictionary and, with a key, the key
	function haveStep() {
		const t = T(), rd = st.read, padMode = rd.mode === "pad";
		if (st.edit) return dictStep();
		const r = st.have || (st.have = { sub: "mode" });
		if (!rd.mode && r.sub !== "mode") r.sub = "mode";
		if (!padMode && r.sub === "key") r.sub = "dict";
		const goSub = (x) => { r.sub = x; render(); scrollTo(0, 0); };
		const KEYS = ["mode", "form", "dict", padMode ? "key" : null].filter(Boolean), names = [t.planSubs[0], t.planSubs[1], t.haveDictSub, t.haveKeySub];
		const subs = subSteps(KEYS, names, r.sub, { mode: !!rd.mode, form: !!r.formChosen, dict: !!st.dict, key: !!st.dict && keyGiven() }, goSub);
		const back = (x) => ["◀ " + names[KEYS.indexOf(x)], () => goSub(x)], on = (x) => [names[KEYS.indexOf(x)] + " ▶", () => goSub(x)];
		let body;
		if (r.sub === "mode") { body = modeChoice(() => goSub("form")); setNav({ prev: null, next: on("form"), ready: !!rd.mode }); }
		else if (r.sub === "form") {
			// any form: a backup to read back may have been made in one that is not recommended
			body = tool(panel(h("p", { class: "lead", text: t.haveFormHelp }), formPicker(FORMS, (id) => { st.plan.form = id; r.formChosen = true; render(); })),
				formDetail(st.plan.form));
			setNav({ prev: back("mode"), next: [on("dict")[0], () => { r.formChosen = true; goSub("dict"); }] });
		} else if (r.sub === "dict" || !st.dict) {
			body = dictScreen();
			setNav(padMode ? { prev: back("form"), next: on("key"), ready: !!st.dict } : { prev: back("form"), ready: !!st.dict });
		} else {
			// the key: as things (the same collection, or another with its own
			// dictionary), or as a file, checked whole here before the first turn
			const file = rd.padAs === "file";
			body = tool(panel(h("p", { class: "lead", text: t.haveKeyHelp }), ...keyAsFields(rd, () => { rd.padDict = null; })),
				panel(...(file ? keyFileInput(rd) : rd.padForm ? [keyDictBlock()]
					: [h("div", { class: "key-empty" }, art("keyThings"), hint(t.haveKeySame))])));
			setNav({ prev: back("dict"), ready: keyGiven() });
		}
		return h("div", { class: "stack" }, subs, body);
	}
	// the key file, typed, pasted or opened (it stays on this computer), checked
	// whole: its rows, its N and its length; a mistake says its line
	function keyFileInput(rd) {
		const t = T(), status = h("div", { class: "status" });
		const show = (live) => {
			const problem = checkKeyFile(rd);
			status.className = "status" + (rd.keyFile ? " ok" : problem ? " bad" : "");
			status.textContent = rd.keyFile ? t.padFileOk(rd.keyFile.length) : problem;
			if (live) Slides.setReady(!!rd.keyFile);
		};
		const area = h("textarea", { class: "input mono", spellcheck: "false", rows: 8, "aria-label": t.padFileTitle, placeholder: "54 16\n3A37 DFE7 0239 3E0F 6\n…",
			on: { input: (e) => { rd.fileText = e.target.value; show(true); } } });
		area.value = rd.fileText;
		show();
		const open = h("input", { type: "file", accept: ".txt,text/plain", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			rd.fileText = await f.text();
			render();
		} } });
		return [h("div", { class: "label pad-label", text: t.padFileTitle }), hint(t.padFileReadHelp), area, status,
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => open.click() } }, t.padFileOpen), open)];
	}
	// rd.keyFile from rd.fileText, or why not (a PadFileError's code and line,
	// in words). Its length tells the seed's number of words.
	function checkKeyFile(rd) {
		const n = st.dict.things.length;
		rd.keyFile = null;
		if (!rd.fileText.trim()) return "";
		try {
			const f = S.readPadFile(rd.fileText);
			if (f.n !== n) throw new S.PadFileError("dictn", "N does not match the dictionary", null, [f.n, n]);
			const words = [12, 24].find((w) => symbolsFor(w, n) === f.pad.length);
			if (!words) throw new S.PadFileError("words", "not the length of a seed", null, [f.pad.length, symbolsFor(12, n), symbolsFor(24, n)]);
			if (words !== rd.words) readWords(rd, words);
			rd.keyFile = f.pad;
			return "";
		} catch (e) {
			if (!(e instanceof S.PadFileError)) throw e;
			return T().errPadFile(e.code, e.line, e.detail);
		}
	}
	// another number of words while reading: the pieces past the new length go
	function readWords(rd, words) {
		const L = symbolsFor(words, st.dict.things.length);
		Object.assign(rd, { words, taps: rd.taps.slice(0, L), keyTaps: rd.keyTaps.slice(0, L) });
	}
	// the key is given: in pad mode, its file checked, or its collection known
	function keyGiven() {
		const rd = st.read;
		if (rd.mode !== "pad") return true;
		return rd.padAs === "file" ? !!rd.keyFile : !rd.padForm || !!rd.padDict;
	}

	// ---- read, 2 (and make, 6): turn by turn --------------------------------------
	// The key's numbers so far (null in the basic mode): its file's, or its pieces tapped
	const readKey = (rd) => rd.mode !== "pad" ? null : rd.padAs === "file" ? rd.keyFile || [] : rd.keyTaps;
	// a key as things: its own collection, or the sequence's
	const keyThingsOf = (rd) => rd.padForm && rd.padDict ? rd.padDict.things : st.dict.things;
	const readLength = (rd) => symbolsFor(rd.words, st.dict.things.length);
	const bitsOf = (v, k) => v.toString(2).padStart(k, "0").split("").map(Number);
	// the first turn not read yet (L: all of them are)
	function readFrontier(rd) {
		const L = readLength(rd), key = readKey(rd);
		let f = 0;
		while (f < L && rd.taps[f] !== undefined && (!key || key[f] !== undefined)) f++;
		return f;
	}
	// to another turn: any one already read, or the first one not read yet
	function readGo(rd, to) { rd.turn = Math.max(0, Math.min(readFrontier(rd), to)); rd.last = null; seenWhy(rd); render(); }
	// past the first turn, the basic mode's why (shared with making one) is not shown again
	function seenWhy(rd) { if (rd.turn > 0 && rd.mode !== "pad") st.seen.whyBasic = true; }
	// What the L turns give, worked out again only when a piece changes:
	// decodeTurns (both directions, both roles) or, if nothing decodes, "nofit".
	function readOut(rd) {
		const n = st.dict.things.length, L = readLength(rd), key = readKey(rd);
		const taps = rd.taps.slice(0, L), keys = key && key.slice(0, L), sig = JSON.stringify([n, taps, keys]);
		if (sig === rd.sig) return;
		Object.assign(rd, { sig, out: null, error: "" });
		if (readFrontier(rd) < L) return;
		try { rd.out = S.decodeTurns(taps, keys, Math.log2(n)); }
		catch (e) { if (!(e instanceof S.DecodeError)) throw e; rd.error = "nofit"; }
	}
	// every data square of a QR code, as painted squares (turnGrid)
	const qrPainted = (qr) => new Map(S.dataModulesRowMajor(qr.size).map(([r, c], b) => [b, qr.getModule(c, r) ? 1 : 0]));
	// The turns whose piece (of the sequence, or of the key) seems wrong: their
	// bits differ from the QR code the seed gives (its data squares and its
	// header). Only when the good reading is the order the pieces were read in
	// (or, with no key, that order backwards); otherwise null.
	function wrongTurns(out, L, k, padMode) {
		const reading = !out.reversed ? (j) => j : !padMode ? (j) => L - 1 - j : null;
		if (!reading) return null;
		const qr = S.compactSeedQR(out.entropy), cells = S.dataModulesRowMajor(qr.size), ndata = cells.length;
		const want = cells.map(([r, c]) => qr.getModule(c, r) ? 1 : 0).concat([0, 0], bitsOf(qr.mask, 3));
		const bits = S.symbolsToBits(out.plain, k), wrong = [];
		for (let j = 0; j < L; j++) for (let b = j * k; b < (j + 1) * k && b < ndata + 5; b++) if (bits[b] !== want[b]) { wrong.push(reading(j)); break; }
		return wrong.sort((a, b) => a - b);
	}
	// the seed read: its words and fingerprint; checking a copy, whether it is the one made,
	// exactly (with no piece the QR code had to put right)
	function seedResult(out, expect) {
		const t = T(), same = !!expect && [...out.entropy].join() === [...expect].join(), exact = same && !out.fixed;
		return h("div", { class: "result" + (expect && !exact ? " wrong" : "") },
			h("div", { class: "result-title", text: expect ? (exact ? "✓ " + t.checkMatch : same ? "⚠ " + t.checkFixed : "✗ " + t.checkMismatch) : "✓ " + t.seedFound }), seedAlert(),
			h("div", { class: "words" }, S.entropyToMnemonic(out.entropy).split(" ").map((w, i) => h("div", {}, h("span", {}, i + 1), w))),
			fingerprintLine(out.entropy));
	}
	// how it was read, when not as given: backwards, or the two strings swapped
	const readNotes = (out) => [out.reversed ? h("div", { class: "note", text: T().reversed }) : null,
		out.swapped ? h("div", { class: "note pad", text: T().padSwapped }) : null];

	// Reading a sequence back, turn by turn (SPEC §4, §10.9): each turn, piece
	// i of the sequence tapped in its collection gives a number; in pad mode,
	// minus piece i of the key (tapped, or the file's character i) on the
	// clock of N; that number's k bits are painted on the QR code's template.
	// A turn just read moves on to the next, and what it gave stays in sight.
	// After the last turn, decodeTurns: the QR code to scan, the words and the
	// fingerprint, or what to look at again. The same reader recovers a seed
	// and checks a copy just made (opts.expect: the seed it should give).
	function turnReader(rd, opts = {}) {
		const t = T(), things = st.dict.things, n = things.length, k = Math.log2(n), padMode = rd.mode === "pad";
		const checking = !!opts.expect, flow = checking ? "make" : "read", m = st.make;
		const L = readLength(rd), size = S.sizeFor(L, k), ndata = S.dataModulesRowMajor(size).length;
		const keyThings = padMode && rd.padAs === "string" ? keyThingsOf(rd) : null;
		readOut(rd);
		const key = readKey(rd), frontier = readFrontier(rd);
		const i = rd.turn = Math.max(0, Math.min(frontier, rd.turn || 0));
		const plainOf = (j) => key ? S.clockStep(rd.taps[j], key[j], n, -1).value : rd.taps[j];
		const out = i === L ? rd.out : null, qr = out && S.compactSeedQR(out.entropy);
		// checking: the copy reads back only while every piece read gives the seed made, exactly:
		// a piece the QR code's error correction had to put right is still wrong on the string
		if (checking) {
			m.checked = !!rd.out && !rd.out.fixed && [...rd.out.entropy].join() === [...opts.expect].join();
			if (m.checked) m.keyChanged = null;
		}
		// the squares painted: the turns read, as read; at the end, the seed's own QR code
		const painted = qr ? qrPainted(qr) : new Map(), read = [];
		if (!qr) for (let j = 0; j < frontier; j++) read.push(...bitsOf(plainOf(j), k));
		read.forEach((bit, b) => { if (b < ndata) painted.set(b, bit); });
		const mask = qr ? qr.mask : read.length >= ndata + 5 ? parseInt(read.slice(ndata + 2, ndata + 5).join(""), 2) : "?";

		// typing everything at once instead: names, one per line or separated by commas
		if (rd.typing) {
			const err = h("div");
			const area = (prop, label) => {
				const a = h("textarea", { class: "input", spellcheck: "false", rows: keyThings ? 6 : 10, "aria-label": label, on: { input: (e) => { rd[prop] = e.target.value; } } });
				a.value = rd[prop];
				return field(label, a);
			};
			const parse = (text, th) => S.readSequence(text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim().toLowerCase()).filter(Boolean),
				th.map((x) => x.name.toLowerCase()));
			const apply = () => {
				try {
					// the text is what was read (typeAll starts it from the pieces tapped)
					const taps = parse(rd.text, things), keyTaps = keyThings ? parse(rd.keyText, keyThings) : rd.keyTaps;
					if (taps.length > L || (keyThings && keyTaps.length > L)) { err.replaceChildren(errorBox(t.errTyped(Math.max(taps.length, keyTaps.length), L))); return; }
					Object.assign(rd, { taps, keyTaps, typing: false, text: "", keyText: "" });
					readGo(rd, L);
				} catch (e) {
					if (!(e instanceof S.DecodeError)) throw e;
					err.replaceChildren(errorBox(t.errUnknown(e.message.match(/"(.*)"/)?.[1] || "")));
				}
			};
			return tool(panel(...stepHead(flow, t.typeHelp),
				area("text", t.stringSeq), keyThings ? area("keyText", t.stringPad) : null, err,
				h("div", { class: "row" }, h("button", { class: "btn push", on: { click: apply } }, t.typeRead),
					h("button", { class: "btn ghost small", on: { click: () => { Object.assign(rd, { typing: false, text: "", keyText: "" }); render(); } } }, t.tapInstead))),
				panel(turnGrid(size, null, painted, [], null)));
		}

		// a piece tapped for this turn: a turn read for the first time moves on to the next
		const tap = (which, v) => {
			(which === "key" ? rd.keyTaps : rd.taps)[i] = v;
			st.seen.readTap = true;
			if (i === frontier && readFrontier(rd) > i) { rd.turn = i + 1; rd.last = i; seenWhy(rd); } else rd.last = null;
			render();
		};
		// what a turn gives: (the key's piece taken away on the clock), the number, its bits and squares
		const turnMath = (j) => {
			const C = rd.taps[j], K = key ? key[j] : 0, parts = [];
			if (C === undefined || K === undefined) return parts;
			const P = plainOf(j), turn = S.turnBits(size, j, k), roles = turn.map((b) => b.role), byRow = new Map();
			if (key) {
				const back = S.clockStep(C, K, n, -1), raw = C - K;
				parts.push(h("div", { class: "turn-key" }, clockSvg(n, C, K, -1), h("div", { class: "stack tight" },
					h("code", { class: "turn-sum", text: `${C} − ${K} = ${raw}` + (back.wrapped ? ` → ${raw} + ${n} = ${P}` : "") }),
					hint(t.turnClockBack(C, K, n, back.wrapped)))));
			}
			for (const { cell } of turn) if (cell) { if (!byRow.has(cell[0])) byRow.set(cell[0], []); byRow.get(cell[0]).push(cell[1] + 1); }
			parts.push(h("div", { class: "turn-part" }, hint(t.readSquares(P)), bitsStrip(bitsOf(P, k), roles),
				byRow.size ? hint(t.handCells([...byRow].map(([r, cs]) => [r + 1, cs]))) : null));
			// the last turns are the header (version and mask) and the padding: no squares of the QR code
			if (roles.includes("header")) parts.push(h("div", { class: "note" }, t.handHeader, " ", h("b", { text: t.handTemplate(size, mask) })));
			if (roles.includes("padding")) parts.push(h("div", { class: "note", text: t.handPadding }));
			return parts;
		};
		const restart = () => {
			if (!confirm(t.readRestartAsk)) return;
			Object.assign(rd, freshRead(rd), { keyFile: rd.keyFile, fileText: rd.fileText });
			render();
		};
		const typeAll = () => {
			// always the pieces as they now are
			const names = (taps, th) => taps.filter((v) => v !== undefined).map((v) => th[v].name).join("\n");
			Object.assign(rd, { typing: true, text: names(rd.taps, things), keyText: keyThings ? names(rd.keyTaps, keyThings) : "" });
			render();
		};
		const nav = turnNav(
			h("button", { class: "btn ghost", disabled: i === 0 ? "" : undefined, on: { click: () => readGo(rd, i - 1) } }, "◀ " + t.prevPiece),
			h("span", { class: "meta", text: t.handStep(Math.min(i + 1, L), L) }),
			i < L ? h("button", { class: "btn", disabled: i < frontier ? undefined : "", on: { click: () => readGo(rd, i + 1) } }, t.nextPiece + " ▶") : null);
		// the other ways, at the foot of the column
		const tools = h("div", { class: "row" },
			h("button", { class: "btn ghost small push", on: { click: typeAll } }, t.typeInstead),
			rd.taps.length || rd.keyTaps.length ? h("button", { class: "btn ghost small", on: { click: restart } }, "↺ " + t.readRestart) : null);

		// on the left, the count; at the top, how long the seed is (a key file says it)
		const words = checking || (padMode && rd.padAs === "file") ? null
			: seg([12, 24].map((w) => [w, t.wordsPieces(w, symbolsFor(w, n))]), rd.words, (w) => { if (w !== rd.words) readWords(rd, w); render(); });
		const left = [...stepHead(flow, checking ? (padMode ? t.checkHelpPad : t.checkReadHelp) : null, words ? h("div", { class: "row key-method" }, words) : null), nav];
		if (i < L) {
			const C = rd.taps[i], K = key ? key[i] : undefined;
			if (i === 0 && !padMode && !st.seen.whyBasic) left.push(h("div", { class: "note", text: t.whyBasic(n, k) }));
			if (i === 0 && !st.seen.readTap) left.push(h("div", { class: "note", text: t.forms[st.plan.form].read }), keyThings ? hint(t.tapPadHelp) : null);
			left.push(h("div", { class: "turn-part" }, h("div", { class: "label", text: t.readSeqPiece(i + 1) }), collectionRow(things, C, k, (v) => tap("seq", v))));
			if (keyThings) left.push(h("div", { class: "turn-part turn-keypick" }, h("div", { class: "label pad-label", text: t.readKeyPiece(i + 1) }),
				collectionRow(keyThings, K, k, (v) => tap("key", v))));
			else if (key) left.push(h("div", { class: "row key-line" }, h("span", { class: "pad-label", text: t.readKeyPiece(i + 1) }),
				h("span", { class: "meta", text: t.readKeyChar(i + 1) }), h("code", { class: "turn-sum", text: S.PAD_DIGITS[K] }),
				S.PAD_DIGITS[K] !== String(K) ? h("b", { class: "bits-num", text: "= " + K }) : null));
			const now = turnMath(i);
			if (now.length) left.push(...now);
			else if (rd.last === i - 1 && i > 0) left.push(h("div", { class: "turn-last" }, h("div", { class: "label", text: t.readLast(i) }), ...turnMath(i - 1)));
			left.push(tools);
		} else if (out) {
			const wrong = wrongTurns(out, L, k, padMode);
			left.push(...readNotes(out),
				wrong && wrong.length ? h("div", { class: "note warn" }, t.readWrong(wrong.length), " ",
					...wrong.slice(0, 6).map((j) => h("button", { class: "btn ghost small", on: { click: () => readGo(rd, j) } }, t.readPiece(j + 1))))
				: out.fixed ? h("div", { class: "note warn", text: t.readFixed }) : null,
				seedResult(out, opts.expect), tools);
		} else left.push(errorBox(rd.error === "nofit" ? t.readNoFit : ""), hint(t.readJump), tools);
		if (!checking) setNav({ ready: !!rd.out });

		// on the right, the QR code with this turn's squares, and the sequence read so far
		const turn = i < L ? S.turnBits(size, i, k) : [];
		const sofar = rd.taps.slice(0, frontier);
		return tool(panel(...left),
			panel(hint(t.handTemplate(size, mask)), turnGrid(size, qr, painted, turn, (bit) => readGo(rd, Math.floor(bit / k))),
				sofar.length ? h("div", { class: "map turn-map" }, drawSeq(things, sofar, { current: i < L ? i : -1, onPick: (j) => readGo(rd, j), form: st.plan.form })) : null));
	}

	// read, 3: the seed — its QR code to scan, its words and its fingerprint
	function seedStep() {
		const t = T(), rd = st.read, qr = S.compactSeedQR(rd.out.entropy);
		setNav({});
		return tool(panel(...stepHead("read"), ...readNotes(rd.out), seedResult(rd.out),
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { st.read = { ...freshRead(), mode: st.read.mode }; toStep("read", "have"); } } }, t.readAgain))),
			panel(turnGrid(qr.size, qr, qrPainted(qr), [], null), hint(t.handTemplate(qr.size, qr.mask))));
	}

	// ---- printable sheet ----------------------------------------------
	// For whoever makes the string: what to buy and the order, with nothing
	// about what it is for, and nothing about the dictionary's order (the
	// shopping list is in alphabetical order, without numbers).
	function printSheet() {
		const t = T(), m = st.make, d = st.dict;
		if (!d || !m.symbols) { st.screen = "make"; st.step.make = "seq"; return null; }
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
			h("ol", {}, steps.map(([a, b], i) => h("li", { class: keyThread((flow === "make" ? MAKE_STEPS : READ_STEPS)[i]) ? "pad" : null },
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
