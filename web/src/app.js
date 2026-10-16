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
	// how long a seed is, what to buy, and the journeys as lists of slides (journeys.js)
	const J = SeedcraftJourneys;
	const { symbolsFor } = J;
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
		// the slide each journey is at (journeys.js's ids); step above is its step in the guide
		at: { make: "mode", read: "mode" },
		// what was picked on a slide before it has any other trace: the dictionary to be named (dict, keyDict: "name")
		ways: { make: {}, read: {} },
		gathered: {},  // the pieces slide's «I have them», per group
		// padForm: the pad's own form, if another; chosen: which of these the person has chosen (a card is marked only then)
		plan: { words: 12, n: 16, padAs: "string", form: "necklace", padForm: null, chosen: {} },
		padDict: null,  // the pad's own dictionary, when it is another collection (SPEC §11.4)
		dict: null,  // { things: [{ name, emoji, photo, colour, symbol }], checked }
		edit: null,  // the dictionary being named: { kind: "name", things, i }, or checked: { kind: "check", i }
		mode: null,  // "basic" or "pad" (SPEC §10), chosen before making or reading
		make: { seed: "", entropy: null, symbols: null, turn: 0 },
		read: freshRead(),
		seen: {},  // the one-line explanations already shown once: keyWhy, reroll, keyPart, rowCheck, whyBasic, readTap
	};
	// What is being read, turn by turn (turnReader): the turn shown (L: the
	// end), each turn's piece of the sequence (taps) and, in pad mode, of the
	// key (keyTaps, or keyFile: the key file's numbers, from fileText, checked
	// in "What you have"); last, the turn a tap just completed; typing, text,
	// keyText: everything typed at once; out, error: what decodeTurns made of
	// it, for sig (the pieces it was worked out from). What it is read as is
	// its own, apart from the backup being made (st.mode, st.plan, st.padDict):
	// mode, words, padAs, padForm and padDict (the key's own collection), form,
	// n (until there is a dictionary), chosen (as the plan's) and dict, its own
	// dictionary, kept from `keep`.
	function freshRead(keep) {
		return { turn: 0, taps: [], keyTaps: [], keyFile: null, fileText: "", last: null,
			typing: false, text: "", keyText: "", out: null, error: "", sig: "",
			words: keep ? keep.words : 12, padAs: keep ? keep.padAs : "string", padForm: keep ? keep.padForm : null, padDict: keep ? keep.padDict : null,
			mode: keep ? keep.mode : null, form: keep ? keep.form : "necklace", n: keep ? keep.n : 16, chosen: keep ? keep.chosen : {}, dict: keep ? keep.dict : null };
	}
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// a dictionary of another size: what was made with the old one goes (a
	// renamed piece changes nothing: the sequence is numbers). Recovering has
	// its own (st.read.dict, setReadDict): reading never touches the backup.
	function setDict(d) {
		const same = st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (d) st.plan.n = d.things.length;
		if (!same) st.make = { seed: st.make.seed, entropy: null, symbols: null, turn: 0 };
	}
	// the same for what is being read: another size, what was read with the old one goes
	function setReadDict(d) {
		const rd = st.read, same = rd.dict && d && rd.dict.things.length === d.things.length;
		if (!same) st.read = { ...freshRead(rd), padDict: null };
		st.read.dict = d;
		if (d) st.read.n = d.things.length;
	}
	// the dictionary of the journey on screen, and how to replace it
	const seedColl = () => st.screen === "read" ? { dict: st.read.dict, set: setReadDict } : { dict: st.dict, set: setDict };
	// the dictionary something is read with: recovering, the reading's own; checking a copy, the backup's
	const dictFor = (rd) => rd === st.read ? st.read.dict : st.dict;

	// another number of words: what was made for the old length goes (the key, the sequence), as with a new N
	function setWords(words) {
		st.plan.words = words;
		st.make = { seed: st.make.seed, entropy: null, symbols: null, turn: 0 };
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
	// (a dictionary being named or checked is left behind: it belongs to the journey it was in)
	function go(screen) { if (screen !== st.screen) st.edit = null; st.screen = screen; render(); scrollTo(0, 0); }
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
		turnRun++;
		document.documentElement.lang = st.lang;
		if (!mounted) {
			// another language from the «⋯» panel: the same slide, the same state, redrawn
			Slides.mount($("app"), { lang: st.lang, onLang: (l) => { st.lang = l; render(); } });
			mounted = true;
		}
		Slides.setLang(st.lang);
		// what scrolls inside a legacy slide (the map, the two columns) keeps its place across a redraw
		const SCROLLERS = ".slide-legacy, .map, .flow-body, .flow-body .tool > .panel";
		const view = [st.screen, st.at[st.screen], st.at[st.screen] === "seq" ? st.make.turn : "", st.make.explain ? st.make.explain.run : "", st.make.key && st.make.key.by, st.make.key && st.make.key.pos, st.make.key && !!st.make.key.fix, st.edit && st.edit.kind, st.edit && st.edit.target, st.edit && st.edit.i].join();
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
			if (sheet) return page(h("div", { class: "wrap" }, sheet), { label: "◀ " + t.back, go: () => goSlide("make", "seq") });
		}
		if (st.screen === "make" || st.screen === "read") return journeySlide(st.screen, view, home, toStart);
		if (st.screen === "about") return page(h("div", { class: "wrap" }, about()), toStart);
		if (st.screen === "donate") return page(h("div", { class: "wrap" }, donate()), toStart);
		return page(h("div", { class: "start" }, topBar(), h("div", { class: "wrap" }, intro()), footBar()), null);
	}
	// ---- the journeys, slide by slide ----------------------------------------
	// Each journey is a list of slides (journeys.js: which there are now, in
	// order, each under its step of the guide); st.at[flow] says which one is
	// shown. A slide is drawn by SLIDES[flow][id](): a decision (cards), the
	// pieces, or, until it is redone, an old step view (legacy). Back and Next
	// go to the slides before and after it; a step of the guide goes to its
	// first slide, or to the first one before it that is not done yet.
	const journeyState = (flow) => flow === "make"
		? { mode: st.mode, padAs: st.plan.padAs, padForm: st.plan.padForm, dict: !!st.dict, padDict: !!st.padDict, keyWho: st.make.keyWho, keyBy: st.make.key && st.make.key.by, made: !!st.make.symbols }
		: { mode: st.read.mode, padAs: st.read.padAs, padForm: st.read.padForm, dict: !!st.read.dict, padDict: !!st.read.padDict };
	const journeyOf = (flow) => J.slides(flow, journeyState(flow));
	function goSlide(flow, id) { if (id) st.at[flow] = id; st.edit = null; go(flow); }
	// the slide after (or before) this one, as the journey is once its choice is made
	function along(flow, id, by) {
		const list = journeyOf(flow), i = list.findIndex((x) => x.id === id);
		return list[i + by] ? list[i + by].id : null;
	}
	// whether a slide has done its job: what a later one needs first
	function slideDone(flow, id) {
		const p = st.plan, rd = st.read, m = st.make;
		if (flow === "make") return ({ mode: !!st.mode, form: !!p.chosen.form, words: !!p.chosen.words, size: !!st.dict || !!p.chosen.size,
			keyAs: !!p.chosen.padAs, keyColl: !!p.chosen.padColl, keyForm: !!p.chosen.padForm, dict: !!st.dict, keyDict: !!st.padDict, keyWho: !!m.keyWho,
			keyTool: !!(m.key && m.key.by), keyThrow: stepDone("make", "key"), seed: !!m.symbols, seq: !!m.symbols })[id] !== false;
		return ({ mode: !!rd.mode, form: !!rd.chosen.form, size: !!rd.dict || !!rd.chosen.size, dict: !!rd.dict, keyAs: !!rd.chosen.padAs,
			keyColl: !!rd.chosen.padColl, keyForm: !!rd.chosen.padForm, keyDict: !!rd.padDict, keyFile: !!rd.keyFile, recover: !!rd.out })[id] !== false;
	}
	function journeySlide(flow, view, home, toStart) {
		const list = journeyOf(flow), at = st.at[flow] = J.resolve(flow, list, st.at[flow]);
		const cur = list.find((x) => x.id === at), group = list.filter((x) => x.step === cur.step);
		st.step[flow] = cur.step;
		// naming or checking a dictionary: a slide per piece, with its own way on
		const d = st.edit ? (st.edit.kind === "name" ? nameSlide(flow) : checkSlide(flow)) : SLIDES[flow][at]();
		// naming or checking a dictionary, or throwing the key, the count is the piece's
		const ed = st.edit, count = ed ? `${ed.i + 1}/${ed.kind === "name" ? ed.things.length : ed.order.length}` : d.count ? d.count
			: group.length > 1 ? `${group.indexOf(cur) + 1}/${group.length}` : null;
		const guide = stepsOf(flow).map((step) => ({ name: stepName(flow, step), current: step === cur.step,
			count: step === cur.step ? count : null,
			go: () => goSlide(flow, J.jump(journeyOf(flow), step, (id) => slideDone(flow, id))) }));
		const before = along(flow, at, -1);
		const prev = d.hidden ? null : d.prev !== undefined ? d.prev || (before ? null : toStart)
			: before ? { label: d.legacy ? "◀ " + stepName(flow, journeyOf(flow).find((x) => x.id === before).step) : undefined, go: () => goSlide(flow, along(flow, at, -1)) } : toStart;
		const after = along(flow, at, 1);
		const forward = () => { if (d.onNext) d.onNext(); goSlide(flow, along(flow, at, 1)); };
		const next = d.hidden ? null : d.next !== undefined ? d.next
			: after ? { label: d.legacy ? stepName(flow, journeyOf(flow).find((x) => x.id === after).step) + " ▶" : undefined, go: forward, ready: d.ready !== false } : null;
		return { id: view, legacy: !!d.legacy, guide, question: d.question || null, steps: d.steps || 1, startStep: d.startStep || 0, body: d.body, caption: d.caption || null,
			prev, next, shortcuts: [...(d.shortcuts || []), home], help: d.help || null, onKey: d.legacy ? legacyKey : null };
	}
	// an old step view as a slide (R3): what it asked for with setNav (or the journey's own Back and Next)
	function legacy(body) {
		const o = navOpts, pair = (x, ready) => x ? { label: x[0], go: x[1], ready } : null;
		return { legacy: true, body: () => h("div", { class: "flow-body" }, body), hidden: !!o.hidden, ready: o.ready !== false, onNext: o.onNext,
			prev: o.prev !== undefined ? pair(o.prev) : undefined, next: o.next !== undefined ? pair(o.next, o.ready !== false) : undefined };
	}

	// ---- small building blocks ----------------------------------------
	const field = (label, ...children) => h("div", { class: "field" }, h("div", { class: "label", text: label }), ...children);
	const panel = (...children) => h("section", { class: "panel" }, ...children);
	const tool = (...panels) => h("div", { class: "tool" }, ...panels);
	const title = (text) => h("h2", { class: "panel-title", text });
	const hint = (text) => h("div", { class: "hint", text });
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
			// what was read so far goes: asked first
			if ((st.read.taps.length || st.read.keyTaps.length) && !confirm(T().modeChangeAskRead)) return false;
			st.read = { ...freshRead(st.read), mode };
			return true;
		}
		const m = st.make;
		if (((m.key && m.key.pieces.length) || m.symbols) && !confirm(T().modeChangeAsk)) return false;
		st.mode = mode;
		st.make = { seed: m.seed, entropy: null, symbols: null, turn: 0 };
		return true;
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
	// to a step: its first slide
	function toStep(flow, step) { const x = journeyOf(flow).find((y) => y.step === step); goSlide(flow, x && x.id); }
	function stepDone(flow, step) {
		const m = st.make, rd = st.read;
		if (flow === "make") return ({ plan: !!st.mode, gather: Object.values(st.gathered).some(Boolean), dict: !!st.dict && st.dict.checked && (!keyDictNeeded() || !!st.padDict),
			key: keyReady() && (st.plan.padAs === "string" || !!m.padKept), seq: !!m.symbols, check: !!m.checked, store: !!m.stored })[step];
		return ({ have: !!rd.mode && !!rd.dict && keyGiven(), recover: !!rd.out, seed: !!rd.out })[step];
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
		} else if (step !== "have" && (!st.read.mode || !st.read.dict || !keyGiven())) need = "have";
		else if (step === "seed" && !st.read.out) need = "recover";
		if (!need) return null;
		setNav({ hidden: true });
		return h("div", { class: "narrow" }, panel(title(stepName(flow, step)), h("p", { text: T().needFirst(stepName(flow, need)) }),
			h("div", { class: "row" }, h("button", { class: "btn push", on: { click: () => toStep(flow, need) } }, stepName(flow, need) + " ▶"))));
	}
	// the old views of the steps not redone yet, each after what it needs first
	function makeFlow(view) {
		navOpts = {};
		return legacy(needFirst("make", st.step.make) || view());
	}
	function readFlow(view) {
		navOpts = {};
		if (st.read.mode && st.read.dict && keyGiven()) readOut(st.read);
		return legacy(needFirst("read", st.step.read) || view());
	}

	// ---- the decisions: a question, and a card per option -------------------------
	// Every choice looks the same (vocab.js's cards): each card's drawing in
	// the one visual vocabulary, its name, at most two ✓ and two ✕ (SPEC §11,
	// RISK-AUDIT.md). A tap chooses, and the chosen card has the accent; Next
	// waits until one is chosen. A choice that would undo work asks first.
	const V = SeedcraftVocab(svg, h);
	function decide({ question, options, chosen, choose, ready, help, shortcuts, next, caption, extra }) {
		return { question, help, shortcuts, next, caption, ready: ready !== undefined ? ready : chosen !== null && chosen !== undefined,
			body: () => h("div", { class: "decision" + (options.length > 5 ? " lots" : options.length > 4 ? " many" : "") },
				V.cards({ options, chosen, onChoose: (id) => {
					// a card chosen from the keyboard keeps the focus on the chosen one, drawn anew
					const keyed = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("v-card");
					choose(id); render();
					const on = keyed && $("app").querySelector(".v-card.on");
					if (on) on.focus();
				} }), extra ? extra() : null) };
	}
	// «?»: a few lines on what to think of, over the slide
	const helpOf = (title, lead, items) => () => Slides.popup(h("div", { class: "slide-help" }, h("h2", { text: title }),
		lead ? h("p", { text: lead }) : null, h("ul", {}, items.map((x) => h("li", { text: x })))), { label: title });

	// the kinds of a form, as its example shows them (own: the dictionary, if it
	// is made); a form whose example has fewer kinds than N: numbered pieces
	function kindThings(formId, n, own) {
		if (own && own.length === n) return own;
		const own_ = formOf(formId).set, set = SETS.find((x) => x.id === own_ && x.things.length >= n) || (own_ ? null : SETS.find((x) => x.things.length >= n));
		return set ? thingsOf(set, n) : Array.from({ length: n }, (_, i) => ({ name: String(i), emoji: String(i) }));
	}
	// the ready-made dictionary offered for N kinds: the form's own example, else the first that has N
	const readySet = (n, formId) => SETS.find((x) => x.id === formOf(formId).set && x.things.length >= n) || SETS.find((x) => x.things.length >= n);
	// another form than this one, for the key's own collection (keeps: only those that keep their order)
	const otherForm = (form, keeps) => FORMS.find((f) => f.id !== form && (!keeps || f.keeps)).id;

	// ---- the cards' drawings: the same strings, dictionaries and dice as everywhere ----
	const ART_W = 160, ART_H = 56;
	const artOf = (...kids) => svg("svg", { class: "card-art", viewBox: `0 0 ${ART_W} ${ART_H}`, "aria-hidden": "true" }, ...kids);
	// a few pieces of these kinds (indices into things, any size) on a thread: the seed's, or the key's (thin, dotted)
	const artString = (things, items, kind = "seed", box = { x: 0, y: 4, w: ART_W, h: ART_H - 8 }) =>
		V.string({ box, orientation: "h", role: kind === "key" ? "reference" : "read", kind, things, items: items.map((i) => i === null ? null : i % things.length), showValues: false, room: 20 });
	const seedAndKey = (seed, key) => artOf(artString(seed, [3, 0, 2, 1], "seed", { x: 0, y: 0, w: ART_W, h: 28 }), artString(key, [1, 3, 0, 2], "key", { x: 0, y: 28, w: ART_W, h: 28 }));
	const dictArt = (things, icon, extra) => artOf(extra || null, V.dictionary({ box: { x: 34, y: 2, w: 92, h: 52 }, things, icon }));
	const keyFileArt = () => artOf(svg("text", { x: 22, y: 34, "font-size": 14, "text-anchor": "middle", class: "v-t v-icon" }, "⚿"),
		svg("rect", { x: 40, y: 3, width: 84, height: 50, rx: 4, class: "card-file" }),
		...["54 16", "3A37 DFE7 6", "A6C8 BBC2 2", "413D F4 5"].map((x, i) => svg("text", { x: 46, y: 15 + i * 11, "font-size": 8.5, class: "v-t v-mono v-c-key" }, x)));
	const dieArt = (opts) => V.die({ size: 56, ...opts });
	function deviceArt() {
		const die = V.die({ sides: 6, face: null, size: 34 });
		die.setAttribute("x", 63); die.setAttribute("y", 6);
		return artOf(svg("rect", { x: 48, y: 2, width: 64, height: 42, rx: 4, class: "card-device" }), svg("rect", { x: 70, y: 46, width: 20, height: 6, rx: 2, class: "card-device" }), die);
	}
	const bagArt = () => artOf(svg("path", { d: "M54 22 Q80 12 106 22 L114 50 Q80 57 46 50 Z", class: "card-bag" }), svg("path", { d: "M66 20 Q80 2 94 20", class: "card-bag-tie" }));

	// the options of each decision
	function modeOptions() {
		const c = T().cards, beads = kindThings("necklace", 16);
		return [{ id: "basic", art: artOf(artString(beads, [3, 0, 2, 1])), ...c.basic }, { id: "pad", art: seedAndKey(beads, beads), ...c.pad }];
	}
	const formOptions = (forms, kind = "seed") => forms.map((f) => ({ id: f.id, art: artOf(artString(kindThings(f.id, f.n), [0, 1, 2, 3], kind)),
		title: T().forms[f.id].name, pros: T().forms[f.id].pros, cons: T().forms[f.id].cons }));
	const wordsOptions = (n) => [12, 24].map((w) => {
		const L = symbolsFor(w, n);
		return { id: w, title: T().cards.wordsTitle(w), pros: [], cons: [],
			// the string's last positions: how long it is
			art: artOf(V.string({ box: { x: 0, y: 4, w: ART_W, h: ART_H - 8 }, orientation: "h", role: "read", kind: "seed", items: [null, null, null, null], firstPosition: L - 3, showValues: false, room: 20 })) };
	});
	// words: the seed's; null (recovering: it is not asked) gives both lengths, 12 and 24 words
	function sizeOptions(formId, words) {
		const c = T().cards, rec = formOf(formId).n;
		return SIZES.map((n) => {
			const L = symbolsFor(words || 12, n), L2 = words ? undefined : symbolsFor(24, n);
			return { id: n, title: c.sizeTitle(n), art: artOf(artString(kindThings(formId, n), [0, n - 1, 1, n - 2])),
				pros: [n <= 8 ? c.sizeEasy : c.sizeShort(L, L2), n === rec ? c.sizeRecommended : null].filter(Boolean),
				cons: [n <= 8 ? c.sizeLong(L, L2) : c.sizeKinds(n)] };
		});
	}
	const keyAsOptions = (things) => [{ id: "string", art: artOf(artString(things, [1, 3, 0, 2], "key")), ...T().cards.keyString },
		{ id: "file", art: keyFileArt(), ...T().cards.keyFile }];
	const keyCollOptions = (form, other) => {
		const seed = kindThings(form, formOf(form).n);
		return [{ id: "same", art: seedAndKey(seed, seed), ...T().cards.same }, { id: "other", art: seedAndKey(seed, kindThings(other, formOf(other).n)), ...T().cards.other }];
	};
	function dictOptions(n, formId, icon) {
		const c = T().cards, set = readySet(n, formId), conv = formId === "book" && n === 8 && set.id === "streets";
		const blank = Array.from({ length: n }, () => ({ name: "" }));
		const ready = { id: "ready", art: dictArt(thingsOf(set, n), icon), ...(conv ? c.conventional : { ...c.ready, title: set.icon + " " + set[st.lang] }) };
		const name = { id: "name", art: dictArt(blank, icon), ...c.name };
		const open = { id: "open", art: dictArt(blank, icon, svg("text", { x: 17, y: 36, "font-size": 18, "text-anchor": "middle", class: "v-t" }, "📂")), ...c.open };
		return formOf(formId).exampleFirst ? [ready, name, open] : [name, ready, open];
	}

	// ---- what a choice changes, and what it asks first ---------------------------
	// a form proposes its N, until the size is chosen (or a dictionary fixes it)
	function setForm(id) { st.plan.form = id; if (!st.dict && !st.plan.chosen.size) st.plan.n = formOf(id).n; }
	const madeWork = () => !!(st.make.symbols || (st.make.key && st.make.key.pieces.length));
	const readWork = () => !!(st.read.taps.length || st.read.keyTaps.length);
	// another dictionary (of the journey on screen): one of another size undoes
	// what was made or read with the old one, which is asked first
	function changeDict(d) {
		const c = seedColl(), same = c.dict && d && c.dict.things.length === d.things.length;
		if (!same && c.dict && (st.screen === "read" ? readWork() : madeWork()) && !confirm(T().dictChangeAsk)) return false;
		c.set(d);
		return true;
	}
	// another number of kinds: the dictionary of the old one goes, asked first
	function setSize(v) {
		const c = seedColl();
		if (c.dict && v !== c.dict.things.length) {
			if (!confirm(T().sizeChangeAsk)) return;
			c.set(null);
			st.ways[st.screen].dict = null;
		}
		const p = st.screen === "read" ? st.read : st.plan;
		p.n = v; p.chosen.size = true;
	}
	// the key's own collection (null: the same as the sequence's): its dictionary goes, asked first
	function setPadForm(f) {
		const kc = keyColl(), p = st.screen === "read" ? st.read : st.plan;
		if (f === p.padForm) return true;
		if (kc.dict && !confirm(T().keyCollChangeAsk)) return false;
		p.padForm = f; p.chosen.padForm = false; kc.set(null); st.ways[st.screen].keyDict = null; st.ways[st.screen].keyNameDraft = null;
		return true;
	}

	// ---- the slides of each journey ------------------------------------------
	const ICON = { seed: "🌱", key: "⚿" };
	// what an old view of the key needs first (the dictionary, the key's own)
	const needs = (flow) => { navOpts = {}; const v = needFirst(flow, st.step[flow]); return v ? legacy(v) : null; };
	const SLIDES = {
		make: {
			mode: () => decide({ question: T().modeHelp, options: modeOptions(), chosen: st.mode, choose: setMode }),
			form: () => {
				const t = T(), p = st.plan;
				return decide({ question: t.formTitle, options: formOptions(FORMS.filter((f) => f.keeps)), chosen: p.chosen.form ? p.form : null,
					choose: (id) => { if (id === p.padForm && !setPadForm(otherForm(id, true))) return; setForm(id); p.chosen.form = true; },
					help: helpOf(t.formAvoidTitle, null, t.formAvoid) });
			},
			words: () => {
				const t = T(), p = st.plan;
				return decide({ question: t.seedWords, options: wordsOptions(st.dict ? st.dict.things.length : p.n), chosen: p.chosen.words ? p.words : null,
					choose: (w) => { if (w !== p.words) { if (madeWork() && !confirm(t.wordsChangeAsk)) return; setWords(w); } p.chosen.words = true; } });
			},
			size: () => {
				const p = st.plan;
				return decide({ question: T().howMany, options: sizeOptions(p.form, p.words), chosen: st.dict ? st.dict.things.length : p.chosen.size ? p.n : null,
					choose: setSize });
			},
			keyAs: () => {
				const p = st.plan;
				return decide({ question: T().keyAsQ, options: keyAsOptions(kindThings(p.form, formOf(p.form).n)), chosen: p.chosen.padAs ? p.padAs : null,
					choose: (v) => { p.padAs = v; p.chosen.padAs = true; } });
			},
			keyColl: () => {
				const p = st.plan, other = p.padForm || otherForm(p.form, true);
				return decide({ question: T().keyCollQ, options: keyCollOptions(p.form, other), chosen: p.chosen.padColl ? (p.padForm ? "other" : "same") : null,
					choose: (v) => { if (setPadForm(v === "same" ? null : other)) p.chosen.padColl = true; } });
			},
			keyForm: () => {
				const p = st.plan;
				return decide({ question: T().keyFormQ, options: formOptions(FORMS.filter((f) => f.keeps && f.id !== p.form), "key"), chosen: p.chosen.padForm ? p.padForm : null,
					choose: (id) => { if (setPadForm(id)) p.chosen.padForm = true; }, help: helpOf(T().formAvoidTitle, null, T().formAvoid) });
			},
			pieces: piecesSlide,
			dict: () => dictChoice("make"),
			dictHave: () => needs("make") || asIsSlide(),
			keyDict: () => keyDictChoice("make"),
			keyDictHave: () => needs("make") || asIsSlide("pad"),
			keyWho: () => needs("make") || keyWhoSlide(),
			keyTool: () => needs("make") || keyToolSlide(),
			keyThrow: () => needs("make") || keyThrowSlide(),
			seed: () => needs("make") || seedSlide(),
			seq: () => needs("make") || turnSlide(),
			check: () => makeFlow(checkStep),
			store: () => makeFlow(storeStep),
		},
		read: {
			mode: () => decide({ question: T().modeHelpRead, options: modeOptions(), chosen: st.read.mode, choose: setMode }),
			form: () => {
				const rd = st.read;
				// any form: a backup to read back may have been made in one that is not recommended
				return decide({ question: T().haveFormQ, options: formOptions(FORMS), chosen: rd.chosen.form ? rd.form : null,
					choose: (id) => { if (id === rd.padForm && !setPadForm(otherForm(id))) return; st.read.form = id; st.read.chosen.form = true; } });
			},
			size: () => {
				const rd = st.read;
				return decide({ question: T().howMany, options: sizeOptions(rd.form, null), chosen: rd.dict ? rd.dict.things.length : rd.chosen.size ? rd.n : null,
					choose: setSize });
			},
			dict: () => dictChoice("read"),
			dictHave: () => asIsSlide(),
			keyAs: () => {
				const rd = st.read;
				return decide({ question: T().haveKeyHelp, options: keyAsOptions(kindThings(rd.form, formOf(rd.form).n)), chosen: rd.chosen.padAs ? rd.padAs : null,
					choose: (v) => { st.read.padAs = v; st.read.chosen.padAs = true; } });
			},
			keyColl: () => {
				const rd = st.read, other = rd.padForm || otherForm(rd.form);
				return decide({ question: T().keyCollQRead, options: keyCollOptions(rd.form, other), chosen: rd.chosen.padColl ? (rd.padForm ? "other" : "same") : null,
					choose: (v) => { if (setPadForm(v === "same" ? null : other)) st.read.chosen.padColl = true; } });
			},
			keyForm: () => decide({ question: T().keyFormQRead, options: formOptions(FORMS.filter((f) => f.id !== st.read.form), "key"),
				chosen: st.read.chosen.padForm ? st.read.padForm : null, choose: (id) => { if (setPadForm(id)) st.read.chosen.padForm = true; } }),
			keyDict: () => keyDictChoice("read"),
			keyDictHave: () => asIsSlide("pad"),
			keyFile: keyFileSlide,
			recover: () => readFlow(() => turnReader(st.read)),
			seed: () => readFlow(seedStep),
		},
	};

	// ---- the dictionary: ready-made, your own, or one saved before ----------------
	// (naming it piece by piece, checking it: nameSlide, checkSlide)
	// a dictionary file opened: its pieces, or what is wrong with it (n: the size it must have)
	function dictFileInput(n, onThings, onError) {
		const t = T();
		return h("input", { type: "file", accept: ".json,.txt,application/json,text/plain", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			try {
				const things = dictFromFile(await f.text(), f.name), problem = dictProblem(things);
				if (problem) onError(problem);
				else if (n && things.length !== n) onError(t.errPadDictSize(things.length, n));
				else onThings(things);
			} catch (x) { onError(t.errDictFile); }
		} } });
	}
	const blankThings = (n) => Array.from({ length: n }, () => ({ name: "", emoji: "", colour: "", photo: "" }));
	// your own dictionary, being named: kept in the journey's ways (key: nameDraft,
	// or keyNameDraft for the key's), so leaving it half named loses nothing
	function nameDraft(ways, key, target, n) {
		if (!ways[key] || ways[key].things.length !== n) ways[key] = { kind: "name", target, things: blankThings(n), i: 0, draft: key };
		return ways[key];
	}
	function dictChoice(flow) {
		const t = T(), ways = st.ways[flow];
		const dict = seedColl().dict, n = dict ? dict.things.length : flow === "read" ? st.read.n : st.plan.n, formId = flow === "read" ? st.read.form : st.plan.form;
		const set = readySet(n, formId);
		let input = null;
		const pick = (x) => { if (changeDict({ things: thingsOf(x, n), checked: x.id === "streets" && formId === "book", way: "ready" })) { ways.dict = "ready"; ways.error = ""; } };
		const chosen = ways.dict || (dict ? dict.way || "ready" : null);
		// your own: named piece by piece once Next is pressed; then the dictionary as it is
		const naming = chosen === "name" && !(dict && dict.way === "name");
		return decide({ question: t.dictQ, options: dictOptions(n, formId, "seed"), chosen,
			choose: (id) => { ways.error = ""; if (id === "ready") pick(set); else if (id === "name") ways.dict = "name"; else if (input) input.click(); },
			ready: naming || !!dict, caption: () => ways.error || null,
			next: naming ? { go: () => editDict(nameDraft(ways, "nameDraft", undefined, n)), ready: true } : undefined,
			extra: () => (input = dictFileInput(0, (things) => { if (changeDict({ things, checked: false, way: "open" })) ways.dict = "open"; render(); },
				(msg) => { ways.error = msg; render(); })),
			help: helpOf(t.dictBeforeTitle, t.dictIntro, t.dictChecks),
			shortcuts: SETS.filter((x) => x.things.length >= n && x !== set).map((x) => ({ icon: x.icon, label: x[st.lang], go: () => { pick(x); render(); } })) });
	}
	// pad mode, the key as things of another collection: its own dictionary (SPEC §11.4), as many kinds as the sequence's
	function keyDictChoice(flow) {
		const t = T(), ways = st.ways[flow], kc = keyColl(), dict = seedColl().dict, n = dict ? dict.things.length : flow === "read" ? st.read.n : st.plan.n;
		const formId = kc.form || otherForm(flow === "read" ? st.read.form : st.plan.form);
		const set = readySet(n, formId);
		let input = null;
		const pick = (x) => { kc.set({ things: thingsOf(x, n), checked: x.id === "streets" && formId === "book", way: "ready" }); ways.keyDict = "ready"; ways.keyError = ""; };
		const chosen = ways.keyDict || (kc.dict ? kc.dict.way || "ready" : null);
		const naming = chosen === "name" && !(kc.dict && kc.dict.way === "name");
		return decide({ question: t.keyDictQ, options: dictOptions(n, formId, "key"), chosen,
			choose: (id) => { ways.keyError = ""; if (id === "ready") pick(set); else if (id === "name") ways.keyDict = "name"; else if (input) input.click(); },
			ready: naming || !!kc.dict, caption: () => ways.keyError || null,
			next: naming ? { go: () => editDict(nameDraft(ways, "keyNameDraft", "pad", n)), ready: true } : undefined,
			extra: () => (input = dictFileInput(n, (things) => { keyColl().set({ things, checked: false, way: "open" }); ways.keyDict = "open"; render(); },
				(msg) => { ways.keyError = msg; render(); })),
			shortcuts: SETS.filter((x) => x.things.length >= n && x !== set).map((x) => ({ icon: x.icon, label: x[st.lang], go: () => { pick(x); render(); } })) });
	}

	// ---- the key: who draws it, and with what --------------------------------
	function keyWhoSlide() {
		const c = T().cards, m = st.make, key = m.key || { by: null, pieces: [], pos: 0, draft: [], fix: null };
		const choose = (who) => {
			m.keyWho = who;
			if (who === "device") setKey({ ...key, by: "device", draft: [], fix: null });
			else if (key.by === "device" || !m.key) setKey({ ...key, by: null, draft: [], fix: null });
		};
		return decide({ question: T().keyWhoQ, chosen: m.keyWho || null, choose,
			options: [{ id: "device", art: deviceArt(), ...c.device }, { id: "me", art: dieArt({ sides: 6, face: 3 }), ...c.me }] });
	}
	function keyToolSlide() {
		const t = T(), c = t.cards, m = st.make, key = m.key, k = Math.log2(st.dict.things.length);
		const form = st.plan.padAs === "string" && st.plan.padForm ? st.plan.padForm : st.plan.form;
		// a die gives b bits a throw (SPEC §10.2): the throws a piece takes, and whether some faces are thrown again
		const die = (sides) => {
			const { b, keep } = S.diceBits(sides), per = Math.ceil(k / b);
			return { id: "d" + sides, art: dieArt({ sides, label: "d" + sides }), title: "d" + sides,
				pros: per === 1 ? [c.dieOne] : [], cons: [per > 1 ? c.dieMany(per) : null, keep < sides ? c.dieAgain : null].filter(Boolean) };
		};
		// a bag only of pieces you can hold
		const options = [formOf(form).family !== "written" ? { id: "bag", art: bagArt(), ...c.bag } : null,
			{ id: "coin", art: dieArt({ sides: 2, label: t.coinHeads }), title: c.coin.title, pros: c.coin.pros, cons: [c.coinMany(k)] },
			...S.DICE.filter((x) => x !== 2).map(die)].filter(Boolean);
		return decide({ question: t.keyTools, options, chosen: key && key.by !== "device" ? key.by : null,
			// the same tool again keeps the piece half thrown; another one starts it again
			choose: (by) => { if (m.key.by !== by) setKey({ ...m.key, by, draft: [], fix: null }); } });
	}

	// ---- recovering: the key file, typed, pasted or opened --------------------------
	function keyFileSlide() {
		const rd = st.read;
		if (!rd.dict) return { question: T().keyFileQ, ready: false, body: () => null };
		checkKeyFile(rd);
		return { question: T().keyFileQ, ready: !!rd.keyFile, body: () => h("div", { class: "slide-form" }, ...keyFileInput(rd)) };
	}

	// ---- make, 2: the pieces ------------------------------------------------------
	// A group per collection, with its icon: the kinds of piece, how many of
	// each, what holds them, where that number comes from, and «I have them».
	// A key of the same collection is one group with more of each.
	function piecesSlide() {
		const t = T(), p = st.plan, n = st.dict ? st.dict.things.length : p.n, L = symbolsFor(p.words, n);
		// an address book's conventional order needs no dictionary of pieces (SPEC §11.3)
		const dictPieces = (id) => id === "book" && n === 8 ? 0 : 1;
		const { groups, keyFile } = J.pieces({ words: p.words, n, mode: st.mode, padAs: p.padAs, form: p.form, padForm: p.padForm }, dictPieces);
		const group = (g) => {
			const written = formOf(g.form).family === "written", own = g.kinds[0] === "key" ? st.padDict : st.dict;
			const materials = materialsOf(g.form, L, n);
			return h("section", { class: "pieces-group" + (g.kinds[0] === "key" ? " key" : "") },
				h("h2", {}, h("span", { class: "pieces-icon", "aria-hidden": "true", text: g.kinds.map((x) => ICON[x]).join(" ") }),
					h("span", { text: t.piecesFor[g.what] }), h("small", { text: t.forms[g.form].name })),
				h("div", { class: "pieces-kinds" + (n > 16 ? " many" : "") }, kindThings(g.form, n, own && own.things).map((x) => h("span", { class: "pieces-kind" },
					svg("svg", { viewBox: "0 0 24 24", role: "img", "aria-label": x.name }, V.piece({ box: { x: 0, y: 0, w: 24, h: 24 }, thing: x, named: false })),
					written ? null : h("small", { text: "×" + (g.each + g.copies) })))),
				materials ? h("p", { class: "pieces-thread", text: g.what === "both" ? t.piecesTwice(materials) : materials }) : null,
				h("p", { class: "pieces-split", text: written ? t.gatherNoPieces : t.piecesSplit(g.each, g.copies, g.what) }),
				h("label", { class: "pieces-have" }, h("input", { type: "checkbox", checked: st.gathered[g.what] ? "" : null,
					on: { change: (e) => { st.gathered[g.what] = e.target.checked; render(); } } }), h("span", { text: t.piecesHave })));
		};
		return { question: t.piecesQ, body: () => h("div", { class: "pieces" + (groups.length > 1 ? " two" : "") }, ...groups.map(group),
			keyFile ? h("p", { class: "pieces-file" }, h("span", { class: "pieces-icon", "aria-hidden": "true", text: ICON.key }), t.gatherFile) : null) };
	}


	// ---- make, 3 (and read, 1): the dictionary ------------------------------
	// naming or checking it: a slide per piece (nameSlide, checkSlide), its own way on
	function editDict(edit) { st.edit = edit; render(); }

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
	// pad mode, the key as things of another collection: its own dictionary (SPEC §11.4)
	function keyDictNeeded() { return st.mode === "pad" && st.plan.padAs === "string" && !!st.plan.padForm; }
	// The key's own collection: the backup's (st.plan, st.padDict) or, recovering,
	// the one being read's (st.read), which leaves the backup alone
	const keyColl = () => st.screen === "read"
		? { form: st.read.padForm, dict: st.read.padDict, set: (d) => { st.read.padDict = d; } }
		: { form: st.plan.padForm, dict: st.padDict, set: (d) => { st.padDict = d; st.make.check = null; } };

	// ---- your own dictionary: as it is, named and checked a slide per piece ----------
	// The same little box everywhere (vocab.js's dictionary, 🌱 or ⚿), on the
	// geometry of layouts.js (dictAsIs, dictName, dictCheck): the HTML over the
	// canvas is placed on its boxes, in the lectern's units. The key's own
	// collection: the same slides (target "pad"). Recovering: the same, on the
	// reading's own dictionaries (seedColl, keyColl), never the backup's.
	const Lay = SeedcraftLayouts;
	const collOf = (target) => target === "pad" ? keyColl() : seedColl();
	const iconOf = (target) => target === "pad" ? "key" : "seed";
	const canvas = (...kids) => svg("svg", { class: "dict-canvas", viewBox: `0 0 ${Lay.VIEW.w} ${Lay.VIEW.h}` }, ...kids);
	// an element over the canvas, on a box of it
	function place(el, b) {
		Object.assign(el.style, { left: `calc(var(--u) * ${b.x})`, top: `calc(var(--u) * ${b.y})`, width: `calc(var(--u) * ${b.w})`, height: `calc(var(--u) * ${b.h})` });
		return el;
	}
	// the things of a dictionary, to edit (the symbol typed by hand, if it is not the initials)
	const editable = (things) => things.map((x) => ({ ...x, symbolTyped: !!x.emoji && x.emoji !== initialsOf(x.name) }));
	// Editing a dictionary already there («Edit», «Fix it here»): a draft kept in
	// the journey's ways while it is the same dictionary, so that Back past the
	// first piece, the guide or another language loses nothing; i: the piece to open at.
	function editDraft(target, i) {
		const ways = st.ways[st.screen], key = target === "pad" ? "keyEditDraft" : "editDraft", d = collOf(target).dict;
		if (!ways[key] || ways[key].base !== d) ways[key] = { kind: "name", target, things: editable(d.things), i: 0, draft: key, base: d };
		if (i !== undefined) ways[key].i = i;
		return ways[key];
	}
	const draftOf = (target) => { const x = st.ways[st.screen][target === "pad" ? "keyEditDraft" : "editDraft"]; return x && x.base === collOf(target).dict ? x : null; };
	const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
	// a round of checking: every piece, shuffled; then again the ones missed, until a round has none
	function startCheck(target) {
		const n = collOf(target).dict.things.length;
		editDict({ kind: "check", target, i: 0, order: J.checkOrder(n, random), answered: [], missed: [], wrong: null, round: 1 });
	}

	// The dictionary as it is: its box, whether it is checked, and what to do
	// with it. Making one: check, edit, save (.json, .txt), forget. Recovering
	// one, it is only used: check, edit, or another one.
	function asIsSlide(target) {
		const t = T(), flow = st.screen, reading = flow === "read", coll = collOf(target), d = coll.dict, ways = st.ways[flow];
		const lay = Lay.dictAsIs({ n: d.things.length }), b = lay.boxes;
		const json = () => JSON.stringify({ format: "seedcraft-dictionary", version: 0,
			things: d.things.map((x) => Object.fromEntries(Object.entries({ name: x.name, emoji: x.emoji, colour: x.colour, photo: x.photo }).filter(([, v]) => v))) }, null, 1);
		const act = (label, fn, cls = "btn ghost") => h("button", { type: "button", class: cls, on: { click: fn } }, label);
		const forget = () => {
			if (!confirm(t.dictForgetAsk)) return;
			coll.set(null);
			ways[target === "pad" ? "keyDict" : "dict"] = null;
			render();
		};
		const other = () => {
			if (target === "pad") coll.set(null); else if (!changeDict(null)) return;
			ways[target === "pad" ? "keyDict" : "dict"] = null;
			render();
		};
		const status = place(h("p", { class: "dict-status" + (d.checked ? " ok" : " warn") }, d.checked ? "✓ " + t.dictChecked : t.dictNotChecked), b.status);
		const actions = place(h("div", { class: "dict-actions" },
			act(t.dictCheck, () => startCheck(target), d.checked ? "btn ghost" : "btn"),
			act(draftOf(target) ? t.dictEditOn : t.dictEdit, () => editDict(editDraft(target))),
			...(reading ? [act(t.dictOther, other)] : [
				h("div", { class: "dict-save" }, h("span", { text: t.dictSave }),
					act(t.dictSaveJson, () => download(json(), "dictionary.json", "application/json"), "btn ghost small"),
					act(t.dictSaveTxt, () => download(d.things.map((x) => x.name).join("\n") + "\n", "dictionary.txt", "text/plain"), "btn ghost small")),
				act(t.dictForget, forget, "btn ghost dict-forget")])), b.actions);
		return {
			question: target === "pad" ? t.keyDictHaveQ(t.forms[coll.form].name) : t.dictHaveQ,
			help: reading ? null : helpOf(t.dictSave, t.dictSaveHelp, []),
			body: () => h("div", { class: "dict-slide" },
				canvas(V.dictionary({ box: b.dict, things: d.things, mode: "static", icon: iconOf(target), columns: lay.columns })), status, actions),
		};
	}

	// Naming a piece: «Which piece will be 5?». On the left the box filling up,
	// the row of the piece being named framed; in the centre its number, big,
	// and its bits; on the right the piece, its name, a colour and a photo.
	function nameSlide(flow) {
		const t = T(), ed = st.edit, n = ed.things.length, x = ed.things[ed.i], icon = iconOf(ed.target), b = Lay.dictName({ n }).boxes;
		const own = flow === "read" ? st.read.form : st.plan.form, form = ed.target === "pad" ? keyColl().form || own : own;
		const problem = () => J.nameProblem(ed.things, ed.i);
		// what changes as the name is typed, redrawn in place (the field keeps its focus)
		const dict = svg("g"), piece = svg("g");
		const draw = () => {
			dict.replaceChildren(V.dictionary({ box: b.dict, things: ed.things, mode: "static", value: ed.i, icon }));
			piece.replaceChildren(V.piece({ box: b.piece, thing: x }));
		};
		draw();
		const err = h("p", { class: "dict-err", role: "alert" });
		const tell = () => { const p = problem(); err.textContent = p === "dup" ? t.errDictDupOne(x.name.trim()) : ""; return p; };
		tell();
		// done: the dictionary (or, editing one, nothing changed: as it was), then checking it
		function finish() {
			const bad = ed.things.findIndex((_, j) => J.nameProblem(ed.things, j));
			if (bad >= 0 || dictProblem(ed.things)) { ed.i = Math.max(0, bad); render(); return; }
			const things = ed.things.map(({ symbolTyped, ...y }) => ({ ...y, name: y.name.trim() }));
			const keep = ["name", "emoji", "colour", "photo"], same = ed.base && ed.base.things.length === things.length
				&& things.every((y, j) => keep.every((k) => (y[k] || "") === (ed.base.things[j][k] || "")));
			if (ed.draft) st.ways[flow][ed.draft] = null;
			if (same) { editDict(null); return; }
			collOf(ed.target).set({ things, checked: false, way: "name" });
			st.ways[flow][ed.target === "pad" ? "keyDict" : "dict"] = "name";
			st.at[flow] = ed.target === "pad" ? "keyDictHave" : "dictHave";
			startCheck(ed.target);
		}
		// on: the next piece, or once the last is named, done
		const forward = () => { if (problem()) return; if (ed.i < n - 1) { ed.i++; render(); } else finish(); };
		// the symbol follows the name (its initials) until it is typed by hand
		const nameIn = h("input", { type: "text", class: "dict-name", placeholder: t.forms[form].namePh, autocomplete: "off", "aria-label": t.nameQ(ed.i),
			on: { input: (e) => {
				x.name = e.target.value;
				if (!x.symbolTyped && !x.symbol) x.emoji = initialsOf(x.name);
				draw(); Slides.setReady(!tell());
			}, keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); forward(); } } } });
		nameIn.value = x.name;
		const photoIn = h("input", { type: "file", accept: "image/*", capture: "environment", class: "hidden", on: { change: async (e) => {
			const f = e.target.files[0];
			if (!f) return;
			try { x.photo = await photoOf(f); render(); } catch (z) { err.textContent = t.errPhoto; }
		} } });
		const dot = h("span", { class: "dict-dot" + (x.colour ? "" : " none"), "aria-hidden": "true" });
		if (x.colour) dot.style.setProperty("--c", x.colour);
		setTimeout(() => { if (document.activeElement !== nameIn && !document.querySelector(".slide-popup")) nameIn.focus(); }, 0);
		return {
			question: t.nameQ(ed.i),
			help: helpOf(t.dictName, t.nameHelp, t.dictChecks),
			shortcuts: [{ icon: "Aa", label: t.thingSymbol, go: () => symbolPopup(x) }],
			prev: { go: () => { if (ed.i > 0) { ed.i--; render(); } else editDict(null); } },
			next: { label: ed.i < n - 1 ? undefined : "✓ " + t.dictDone, go: forward, ready: !problem() },
			body: () => h("div", { class: "dict-slide" },
				canvas(dict, V.number({ box: b.number, value: ed.i, colour: icon }), V.bits({ box: b.bits, bits: Lay.binary(ed.i, n), colour: icon }), piece),
				place(h("div", { class: "dict-form" }, nameIn,
					h("div", { class: "dict-buttons" },
						h("button", { type: "button", class: "btn ghost", on: { click: () => colourPopup(x) } }, dot, t.pieceColour),
						h("button", { type: "button", class: "btn ghost", title: t.photoTake, on: { click: () => photoIn.click() } }, x.photo ? t.photoAgain : t.piecePhoto),
						x.photo ? h("button", { type: "button", class: "btn ghost", title: t.photoRemove, "aria-label": t.photoRemove, on: { click: () => { x.photo = ""; render(); } } }, "✕") : null,
						// editing a dictionary already there: saved from any piece, no need to page to the end
						ed.base && ed.i < n - 1 ? h("button", { type: "button", class: "btn", on: { click: () => { if (!problem()) finish(); } } }, "✓ " + t.dictSaveNames) : null,
						photoIn),
					err), b.form)),
		};
	}
	// a piece's colour: one of the beads' colours, any other, or none (a tap chooses and closes)
	function colourPopup(x) {
		const t = T();
		const pick = (c) => { x.colour = c; Slides.closePopup(); };
		const swatch = (c, label) => {
			const b = h("button", { type: "button", class: "swatch" + (c ? "" : " none") + (x.colour === c ? " on" : ""), title: label, "aria-label": label,
				"aria-pressed": String(x.colour === c), on: { click: () => pick(c) } });
			if (c) b.style.setProperty("--c", c);
			return b;
		};
		const other = !!x.colour && !BEAD_COLOURS.some((b) => b.colour === x.colour);
		Slides.popup(h("div", { class: "dict-colours" }, h("h2", { text: t.thingColour }),
			h("div", { class: "swatches", role: "group", "aria-label": t.thingColour }, swatch("", t.colourNone), ...BEAD_COLOURS.map((b) => swatch(b.colour, b.name[st.lang])),
				h("label", { class: "swatch-any" + (other ? " on" : "") }, h("input", { type: "color", value: x.colour || "#7f7f7f",
					on: { change: (e) => pick(e.target.value.toLowerCase()) } }), t.colourOther))), { label: t.thingColour, onClose: () => render() });
	}
	// the symbol drawn on it, if not its initials («⋯»)
	function symbolPopup(x) {
		const t = T();
		const input = h("input", { type: "text", class: "emoji", placeholder: "AB", maxlength: 8, "aria-label": t.thingSymbol,
			on: { input: (e) => { x.emoji = e.target.value.trim(); x.symbolTyped = !!x.emoji; if (!x.emoji && !x.symbol) x.emoji = initialsOf(x.name); },
				keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); Slides.closePopup(); } } } });
		input.value = x.emoji || x.symbol || "";
		Slides.popup(h("div", { class: "slide-help" }, h("h2", { text: t.thingSymbol }), h("p", { text: t.thingSymbolHelp }), input), { label: t.thingSymbol, onClose: () => render() });
	}

	// Checking a piece: «Which number is this piece?», the pieces shuffled, the
	// box filling up as each is answered. A wrong answer says what the screen
	// has, and the piece is asked again once the round is over: the dictionary
	// is checked only after a round with every answer right.
	function checkSlide(flow) {
		const t = T(), ed = st.edit, d = collOf(ed.target).dict, n = d.things.length, v = ed.order[ed.i], x = d.things[v], icon = iconOf(ed.target);
		const lay = Lay.dictCheck({ n }), b = lay.boxes, right = ed.answered.includes(v);
		// the box shows the pieces answered; the rest are still empty rows
		const shown = d.things.map((y, j) => ed.answered.includes(j) ? y : { name: "" });
		const answer = (k) => {
			if (k === v) { if (!right) ed.answered.push(v); ed.wrong = null; }
			else { ed.wrong = k; if (!ed.missed.includes(v)) ed.missed.push(v); }
			render();
			if (k === v && $("slide-next")) $("slide-next").focus();
		};
		const numbers = h("div", { class: "dict-numbers" + (lay.answers.cols > 4 ? " dense" : ""), role: "group", "aria-label": t.checkQ },
			Array.from({ length: n }, (_, k) => h("button", { type: "button", class: "dict-n" + (right && k === v ? " right" : "") + (ed.wrong === k ? " wrong" : ""),
				disabled: right || undefined, "aria-pressed": String(right && k === v), on: { click: () => answer(k) } }, String(k))));
		numbers.style.gridTemplateColumns = `repeat(${lay.answers.cols}, 1fr)`;
		const wrong = ed.wrong !== null && !right ? h("div", { class: "dict-wrong", role: "alert" }, h("p", { text: t.checkWrong(v, ed.wrong) }),
			h("button", { type: "button", class: "btn ghost", on: { click: () => editDict(editDraft(ed.target, v)) } }, t.checkFix)) : null;
		const last = ed.i >= ed.order.length - 1;
		return {
			question: t.checkQ,
			help: helpOf(t.dictCheck, null, t.checkTips),
			caption: () => ed.round > 1 ? t.checkAgainNow : null,
			prev: { go: () => { if (ed.i > 0) { ed.i--; ed.wrong = null; render(); } else editDict(null); } },
			next: { label: !last ? undefined : ed.missed.length ? t.checkAgain(ed.missed.length) : "✓ " + t.checkDone, ready: right, go: () => {
				ed.wrong = null;
				if (!last) { ed.i++; render(); return; }
				if (ed.missed.length) {
					// another round: only the ones missed, shuffled, their rows empty again
					const missed = ed.missed;
					Object.assign(ed, { order: J.checkOrder(missed.length, random).map((j) => missed[j]), answered: ed.answered.filter((y) => !missed.includes(y)), missed: [], i: 0, round: ed.round + 1 });
					render();
					return;
				}
				d.checked = true; editDict(null);
			} },
			body: () => h("div", { class: "dict-slide" },
				canvas(V.dictionary({ box: b.dict, things: shown, mode: "static", value: right ? v : null, icon }), V.piece({ box: b.piece, thing: x })),
				place(h("div", { class: "dict-answer" }, numbers, wrong), b.answers)),
		};
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

	// ---- make, 4: the key (pad mode) ----------------------------------------------
	// The key comes first: L numbers, each pure chance, drawn one piece at a time
	// by the person (a bag, coins, a die) or by the device (SPEC §10.2). Its
	// state is st.make.key (see S.keyMove); st.make.pad, its numbers once all L
	// are there. A piece once drawn stays: moving only shows it again, and only
	// the first missing one is drawn. One set by hand can be marked again
	// ("Fix"), never thrown again.
	const KEY_ROW = S.PAD_ROW;  // numbers per row of the key file, each row closed by its check character
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
	// the pieces of the sequence changed by a key corrected after it was made, each a way to its turn («⋯»)
	const keyChangedWays = () => {
		const t = T(), m = st.make, changed = m.symbols && m.keyChanged || [];
		const toTurn = (j) => { m.turn = j; m.explain = null; goSlide("make", "seq"); };
		return changed.slice(0, 6).map((j) => ({ icon: "↪", label: t.readPiece(j + 1), go: () => toTurn(j) }));
	};
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

	// ---- the key's throw: a slide per piece ---------------------------------------
	// «What came up?» On the left the faces of the die (or the coin) as buttons,
	// every one tappable, and under them what to do now; in the middle the bit
	// tower filling up, each face that counts on its left with its order number
	// (①②③) and joined to its bits, those thrown again aside, dimmed, with ↻;
	// then brace → the number → the key's dictionary turning to it → the piece
	// → its slot in the key string at the bottom. A key file: the number goes
	// to its place in the file, growing at the bottom. The bag: the dictionary
	// as buttons. The device: one die that rolls and stops on the number. Only
	// the current arrow shows whole. Moving never throws again: a piece drawn
	// is shown as it was drawn, and a piece half thrown keeps its throws.
	let keyRolling = false;  // the device's die rolling: nothing else moves until it stops
	let keyFresh = null;     // the position of a piece just completed: it is shown arriving, once
	let keyFocus = null;     // the face tapped from the keyboard, focused again once redrawn
	const circled = (i) => i <= 20 ? String.fromCodePoint(0x2460 + i - 1) : i <= 35 ? String.fromCodePoint(0x3251 + i - 21) : i <= 50 ? String.fromCodePoint(0x32B1 + i - 36) : `(${i})`;
	const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
	function keyThrowSlide() {
		const t = T(), m = st.make, n = st.dict.things.length, k = Math.log2(n), L = keyLength();
		const asString = st.plan.padAs === "string", own = asString && !!st.plan.padForm;
		const things = own ? st.padDict.things : st.dict.things;
		const key = m.key, pos = key.pos, have = key.pieces.length, values = key.pieces.map((p) => p.value);
		const piece = key.fix ? null : key.pieces[pos] || null, value = piece ? piece.value : null;
		// what this piece was (or is being) drawn with: its own, once drawn or while it is marked again
		const by = key.fix ? key.pieces[key.fix.at].by : piece ? piece.by : key.by;
		const sides = sidesOf(by), coin = sides === 2, tool = by === "bag" ? "bag" : by === "device" ? "device" : "dice";
		const lay = Lay.keyThrow({ sides: sides || 6, bits: k, tool, file: !asString, n, value }), b = lay.boxes;
		const throws = piece ? piece.throws : key.draft, parts = sides ? J.throwParts(throws, sides, k) : null;
		const update = (next) => { setKey(next); render(); };
		const fresh = keyFresh === pos && !!piece && !calm();
		keyFresh = null;
		const focus = keyFocus; keyFocus = null;

		// a throw marked: the piece's own coin or die (marking one again, the one it was thrown with)
		const mark = (f) => {
			if (piece || keyRolling) return;
			const before = m.key, after = S.keyAddThrow({ ...before, by }, f, sides, k, L);
			if (after.pieces.length > before.pieces.length || (before.fix && !after.fix)) keyFresh = pos;
			const at = document.activeElement;
			keyFocus = at && at.getAttribute && at.getAttribute("data-face") !== null ? f : null;
			update({ ...after, by: before.by });
		};
		const pick = (v) => { if (piece || keyRolling) return; keyFresh = pos; update(S.keyAddPiece(m.key, v, "bag", [], L)); };
		// the device: its die rolls (~600 ms) and stops on the number, which stays a moment; with reduced motion, at once
		let dieEl = null;
		const dieOf = (label, rolling) => V.die({ sides: 6, label, size: 100, rolling });
		const draw = () => {
			if (keyRolling || piece || key.fix || by !== "device") return;
			const v = S.newPad(1, n)[0], still = calm();
			const put = () => {
				keyRolling = false;
				const x = m.key;
				// still here, still the device's, still the first missing piece: else the number drawn is let go
				if (st.screen === "make" && st.at.make === "keyThrow" && x && x.by === "device" && !x.fix && x.pieces.length < keyLength() && x.pos === x.pieces.length) {
					keyFresh = x.pos;
					update(S.keyAddPiece(x, v, "device", [], keyLength()));
				} else render();
			};
			keyRolling = true;
			const nb = document.getElementById("slide-next");
			if (nb) nb.disabled = true;
			if (dieEl) { dieEl.disabled = true; dieEl.replaceChildren(dieOf(String(v), !still)); }
			setTimeout(() => {
				if (dieEl) dieEl.replaceChildren(dieOf(String(v), false));
				setTimeout(put, still ? 0 : 500);
			}, still ? 0 : 600);
		};
		const all = () => {
			if (keyRolling) return;
			let x = S.keyMove(m.key, m.key.pos, L);
			for (const v of S.newPad(L - x.pieces.length, n)) x = S.keyAddPiece(x, v, "device", [], L);
			st.seen.keyWhy = true;
			update(S.keyMove(x, L - 1, L));
		};
		const saveFile = () => { download(S.writePadFile(m.pad, n), "numbers.txt", "text/plain"); m.padKept = true; render(); };
		const saveList = () => download(m.pad.map((v, i) => `${i + 1}. ${things[v].name}`).join("\n") + "\n", "list-b.txt", "text/plain");

		// what to do now
		const last = throws.length ? throws[throws.length - 1] : null;
		const instruction = piece ? (tool === "bag" ? t.keyBagBack : t.keyPieceReady)
			: tool === "bag" ? t.keyBagHow : tool === "device" ? t.keyTapDie
			: !throws.length ? (coin ? t.keyThrowCoin : t.keyThrowDie)
			: last >= S.diceBits(sides).keep ? t.keyNoCount : coin ? t.keyAgainCoin : t.keyAgainDie;

		function body() {
			const kids = [], over = [];
			const faceOf = (f, box, cls) => svg("g", { transform: `translate(${box.x} ${box.y})`, class: cls },
				V.die({ sides, face: f, size: box.w, label: coin ? (f ? t.coinHeadsMark : t.coinTailsMark) : undefined }));
			// the tower: the bits so far (the device's and the bag's, the number's), the rest empty
			if (b.tower) {
				const bits = piece ? Lay.binary(value, n) : parts ? parts.bits : [];
				kids.push(V.bits({ box: b.tower, bits: Array.from({ length: k }, (_, i) => bits[i] === undefined ? null : bits[i]), orientation: "tower", colour: "key" }));
				const { x, y, w, h: hh } = b.brace, cx = x + w / 2, my = y + hh / 2, r = Math.min(6, hh / 4);
				kids.push(svg("path", { class: "kt-brace" + (piece ? "" : " kt-wait"),
					d: `M${x} ${y} Q${cx} ${y} ${cx} ${y + r} V${my - r} Q${cx} ${my} ${x + w} ${my} Q${cx} ${my} ${cx} ${my + r} V${y + hh - r} Q${cx} ${y + hh} ${x} ${y + hh}` }));
			}
			// the faces thrown: those that count beside their bits, the others aside
			if (parts) {
				const marks = Lay.throwMarks(lay, { bits: k, used: parts.used, rejected: parts.rejected });
				marks.used.forEach((u) => kids.push(svg("g", { class: "kt-thrown" },
					svg("path", { class: "kt-join", d: `M${u.join[0][0]} ${u.join[0][1]} H${u.join[1][0]} M${u.span[0][0]} ${u.span[0][1]} V${u.span[1][1]}` }),
					faceOf(throws[u.at], u.face, "kt-small"),
					svg("text", { x: u.label[0], y: u.label[1], "font-size": 10, "text-anchor": "end", class: "v-t kt-order" }, circled(u.at + 1)))));
				marks.rejected.forEach((r) => kids.push(svg("g", { class: "kt-again" }, faceOf(throws[r.at], r.face, "kt-small"),
					svg("text", { x: r.label[0], y: r.label[1], "font-size": 7, "text-anchor": "middle", class: "v-t kt-order" }, circled(r.at + 1) + "↻"),
					svg("title", {}, t.keyNoCount))));
				// (a d10's faces are already numbered from 0)
				if (sides !== 10) kids.push(svg("text", { x: b.info.x, y: b.info.y + 10, "font-size": 9, class: "v-t kt-info" }, coin ? t.keyCoinBits : t.keyFirstZero));
			}
			// the bag: the key's dictionary as buttons
			if (b.picker) {
				const pk = V.dictionary({ box: b.picker, things, mode: "picker", value, icon: "key", onPick: pick });
				if (piece) pk.classList.add("kt-off");
				kids.push(pk);
			}
			// brace → number → dictionary → piece → slot (the bag: from the piece picked), each shown with its arrow
			const stages = lay.arrows.map((a) => a.id);
			const at = (id) => stages.indexOf(id);
			const groups = { number: svg("g"), dict: svg("g"), piece: svg("g"), slot: svg("g") };
			const arrows = lay.arrows.map((a) => ({ a, g: svg("g") }));
			kids.push(...arrows.map((x) => x.g), groups.number, groups.dict, groups.piece, groups.slot);
			const stage = (p, turning) => {
				const shown = (id) => !!piece && at(id) < p;
				if (b.number) groups.number.replaceChildren(V.number({ box: b.number, value: shown("number") ? value : null, colour: "key" }));
				if (b.keyDict) {
					const reel = V.dictionary({ box: b.keyDict, things, mode: "reel", value: shown("dict") ? value : null, icon: "key", from: turning ? 0 : undefined });
					groups.dict.replaceChildren(svg("g", { class: shown("dict") ? null : "kt-wait" }, reel));
				}
				if (b.piece) groups.piece.replaceChildren(V.piece({ box: b.piece, thing: shown("piece") ? things[value] : null }));
				groups.slot.replaceChildren(asString ? keyString(shown("slot")) : keyFile(shown("slot")));
				arrows.forEach(({ a, g }) => g.replaceChildren(V.arrow({ points: a.points, colour: "key",
					state: !piece ? "hidden" : at(a.id) === p - 1 ? "current" : at(a.id) < p - 1 ? "past" : "hidden" })));
			};
			if (fresh) {
				// it arrives: the number, the dictionary turning to it, the piece, its slot
				stage(1);
				const live = () => groups.slot.isConnected !== false;
				const steps = stages.slice(1).map((id, i) => [id, 450 * (i + 1) + (at("dict") >= 0 && at(id) > at("dict") ? 450 : 0)]);
				steps.forEach(([id, ms]) => setTimeout(() => { if (live()) stage(at(id) + 1, id === "dict"); }, ms));
			} else stage(stages.length);

			// over the canvas: the faces, the device's die, what to do, the tools
			if (b.faces) {
				const order = coin ? [1, 0] : Array.from({ length: sides }, (_, f) => f);
				order.forEach((f, i) => {
					const btn = V.faceButton({ sides, face: f, label: coin ? (f ? t.coinHeads : t.coinTails) : undefined, disabled: !!piece, onPress: mark });
					btn.classList.add("kt-face");
					btn.setAttribute("data-face", String(f));
					over.push(place(btn, Lay.faceBox(lay, i)));
					if (focus === f && !piece) Promise.resolve().then(() => btn.focus());
				});
			}
			if (b.die) {
				dieEl = h("button", { type: "button", class: "v-face kt-face kt-die", "aria-label": t.keyTapDie, disabled: piece || keyRolling ? true : undefined, on: { click: draw } },
					dieOf(piece ? String(value) : "?", false));
				over.push(place(dieEl, b.die));
			}
			over.push(place(h("p", { class: "kt-instr" + (piece ? " ready" : ""), "aria-live": "polite", text: instruction }), b.instruction));
			const act = (label, fn, cls = "btn ghost small") => h("button", { type: "button", class: cls, on: { click: fn } }, label);
			const tools = [];
			if (!piece && throws.length && tool === "dice") tools.push(act("↶ " + t.keyUndo, () => update(S.keyUndoThrow(m.key))));
			if (key.fix) tools.push(act(t.keyFixCancel, () => keyGo(pos)));
			if (piece && piece.by !== "device") tools.push(act(t.keyFix, () => update(S.keyFix(key))));
			if (piece && !asString && have === L && pos === L - 1) tools.push(act("⤓ " + t.padFileSave, saveFile, m.padKept ? "btn ghost small" : "btn small"));
			over.push(place(h("div", { class: "kt-tools" }, tools), b.tools));
			if (focus !== null && piece) Promise.resolve().then(() => { const nb = document.getElementById("slide-next"); if (nb) nb.focus(); });
			return h("div", { class: "dict-slide kt-slide" }, canvas(...kids), ...over);
		}

		// the key string being built: the piece's slot in the middle, six on each side
		function keyString(withPiece) {
			const items = Array.from({ length: 13 }, (_, j) => {
				const i = pos - 6 + j;
				if (i < 0 || i >= L) return undefined;
				if (i === pos) return withPiece ? value : null;
				return i < have ? values[i] : null;
			});
			return V.string({ box: b.keyString, role: "build", kind: "key", things, items, current: 6, firstPosition: pos - 5 });
		}
		// the key file growing (writePadFile's format): the line before (its first line, «L N», or
		// the row before), then the row with this piece, its place framed under the slot, its check once the row is whole
		function keyFile(withPiece) {
			const ROW = S.PAD_ROW, r = Lay.fileRow(pos, { row: ROW, group: S.PAD_GROUP }), start = r.row * ROW, len = Math.min(ROW, L - start), box = b.keyString, slot = b.keySlot;
			const at = (i) => i === pos ? (withPiece ? value : null) : i < have ? values[i] : null;
			const row = Array.from({ length: len }, (_, j) => at(start + j));
			const whole = row.every((v) => v !== null);
			const lineOf = (vals) => S.writePadFile(vals, n).trimEnd().split("\n");
			const parts = [svg("text", { x: box.x + 8, y: box.y + 48, "font-size": 14, "text-anchor": "middle", class: "v-t v-icon" }, ICON.key)];
			const y1 = box.y + 16, y2 = box.y + 48;
			if (r.row === 0) parts.push(svg("text", { x: r.xs[0] - 5, y: y1, "font-size": 11, class: "v-t v-mono kt-file-before" }, `${L} ${n}`));
			else Array.from(lineOf(values.slice(start - ROW, start))[1].replace(/ /g, "")).forEach((c, j) =>
				parts.push(svg("text", { x: r.xs[j], y: y1, "font-size": 11, "text-anchor": "middle", class: "v-t v-mono kt-file-before" }, c)));
			parts.push(svg("rect", { x: slot.x + slot.w / 2 - 13, y: y2 - 21, width: 26, height: 28, rx: 4, class: "kt-file-slot" }));
			row.forEach((v, j) => parts.push(svg("text", { x: r.xs[j], y: y2, "font-size": 20, "text-anchor": "middle",
				class: "v-t v-mono v-bold" + (start + j === pos ? " kt-file-now" : "") + (v === null ? " kt-file-hole" : "") }, v === null ? "·" : S.PAD_DIGITS[v])));
			if (whole) parts.push(svg("text", { x: r.xs[ROW], y: y2, "font-size": 20, "text-anchor": "middle", class: "v-t v-mono kt-file-check" }, lineOf(row)[1].split(" ").pop()));
			return svg("g", { class: "v v-file", role: "img", "aria-label": t.padFileTitle }, parts);
		}

		// on, back: a piece at a time; Next on the device's missing piece rolls it
		let next;
		if (key.fix || (!piece && by !== "device")) next = { go: () => {}, ready: false };
		else if (!piece) next = { label: "🎲 " + t.keyRoll, go: draw, ready: !keyRolling };
		else if (pos < L - 1) next = { go: () => keyGo(pos + 1) };
		else {
			const after = along("make", "keyThrow", 1);
			next = after ? { go: () => goSlide("make", after), ready: asString || !!m.padKept } : null;
		}
		// one line, when there is something to say: what changed, what to do first, why
		const changed = m.symbols && m.keyChanged || [];
		const caption = key.fix ? t.keyFixing(pos + 1)
			: !asString && have === L && !m.padKept ? t.keySaveFirst
			: changed.length ? t.keyChanged(changed.length)
			: parts && parts.rejected.length && !st.seen.reroll ? t.keyRerollWhy
			: sides && lastPart(throws, sides, k) && !st.seen.keyPart ? t.keyPartUsed(k)
			: !asString && piece && closesRow(pos, L) && !st.seen.rowCheck ? t.keyRowCheck
			: !st.seen.keyWhy ? t.keyWhy : null;
		const shortcuts = keyChangedWays();
		if (key.by === "device" && have < L) shortcuts.push({ icon: "⏩", label: t.seeAll, go: all });
		if (have === L) shortcuts.push(asString ? { icon: "⤓", label: t.saveList, go: saveList } : { icon: "⤓", label: t.padFileSave, go: saveFile });
		const why = tool === "bag" ? [t.keyBagPutBack] : tool === "device" ? [] : coin ? [t.keyCoinBits]
			: [sides === 10 ? null : t.keyFirstZero, t.keyRerollWhy, t.keyPartUsed(k)].filter(Boolean);
		return {
			question: t.keyThrowQ, count: `${pos + 1}/${L}`, caption: () => caption, shortcuts,
			help: helpOf(stepName("make", "key"), t.keyWhy, asString ? why : [...why, t.padFileHelp]),
			prev: pos > 0 ? { go: () => keyGo(pos - 1) } : undefined, next, body,
		};
	}

	// ---- make, 5: the sequence ----------------------------------------------
	// another seed: its words go, and in pad mode the key too: it starts again from the key (one key, one seed: SPEC §10.8)
	function otherSeed() {
		const m = st.make;
		m.seed = ""; m.symbols = m.entropy = m.basic = m.check = m.keyChanged = null;
		m.checked = m.stored = false; m.turn = 0; m.explain = null;
		if (st.mode !== "pad") { goSlide("make", "seed"); return; }
		m.key = m.pad = null; m.keyWho = null; m.padKept = false;
		toStep("make", "key");
	}
	// «What are your 12 words?»: typed, checked as they are typed, the
	// fingerprint once typing stops. Next makes the sequence. Once made, the
	// words stay as they are; another seed starts over.
	function seedSlide() {
		const t = T(), m = st.make, n = st.dict.things.length, k = Math.log2(n), padMode = st.mode === "pad", made = !!m.symbols;
		const area = h("textarea", { class: "input mono", rows: 3, spellcheck: "false", autocomplete: "off", "aria-label": t.seedTitle,
			readonly: made ? "" : undefined, placeholder: "height demise useless trap grow lion found off key clown transfer enroll" });
		area.value = m.seed;
		const status = h("div", { class: "status" }), print = h("div", { class: "seed-print" });
		let timer = 0;
		const check = () => {
			if (!made) m.seed = area.value;
			const words = m.seed.trim().split(/\s+/).filter(Boolean).length;
			clearTimeout(timer);
			print.replaceChildren();
			try {
				const entropy = S.mnemonicToEntropy(m.seed);
				if (words !== st.plan.words) { status.className = "status bad"; status.textContent = t.seedNotPlanned(words, st.plan.words); return false; }
				status.className = "status ok"; status.textContent = t.seedOk(words);
				// the fingerprint takes a moment: once typing stops
				timer = setTimeout(() => print.replaceChildren(fingerprintLine(entropy)), made ? 0 : 300);
				return true;
			}
			catch (e) { status.className = "status bad"; status.textContent = words ? e.message : t.seedEmpty; return false; }
		};
		const ok = check();
		area.addEventListener("input", () => Slides.setReady(check()));
		const test = (bytes) => { const e = new Uint8Array(bytes); crypto.getRandomValues(e); area.value = S.entropyToMnemonic(e); Slides.setReady(check()); };
		const make = () => {
			if (made || !check()) return;
			m.entropy = S.mnemonicToEntropy(m.seed);
			if (padMode) {
				// the basic sequence plus the key of the step before, mod N (SPEC §10.3)
				m.basic = S.encode(m.entropy, k);
				m.symbols = S.encrypt(m.basic, m.pad, n);
			} else m.symbols = S.encode(m.entropy, k);
			m.turn = 0; m.explain = null; turnFresh = null;
			m.checked = m.stored = false; m.check = null; m.keyChanged = null;
		};
		const tool = made
			? h("button", { type: "button", class: "btn ghost small", on: { click: () => { if (confirm(t.otherSeedAsk(st.mode))) otherSeed(); } } }, "◀ " + t.otherSeed)
			: h("button", { type: "button", class: "btn ghost small", on: { click: () => test(st.plan.words === 12 ? 16 : 32) } }, st.plan.words === 12 ? t.seedTest12 : t.seedTest24);
		return {
			question: t.seedQ(st.plan.words),
			next: made ? undefined : { label: t.makeIt + " ▶", go: () => { make(); if (m.symbols) goSlide("make", "seq"); }, ready: ok },
			caption: () => made ? (padMode ? t.whyPad : t.makeWarn) : padMode ? t.seqPadIntro : t.seqIntro,
			body: () => h("div", { class: "slide-form seed-form" }, seedAlert(), area, status, print, h("div", { class: "row" }, tool)),
		};
	}

	// ---- the sequence, a turn per slide --------------------------------------
	// layouts.js's makeTurn, bottom to top and left to right: your string being
	// built (the turn's slot in the middle of 13 positions) → its position →
	// the QR code's squares (blue) → their bits → their number; with a key,
	// the key string (a reference: 7 positions, the turn's framed) → its
	// dictionary turning to the piece → its number; both numbers → the clock
	// → the seed's dictionary turning to the result → the piece in the slot.
	// The first turns (J.EXPLAINED), and any turn «?» explains, show one
	// relation per step, its sentence at the foot; the others play the whole
	// cycle at once on arriving (at once with reduced motion). Only the arrow
	// of the step shows whole; the ones before it stay, nearly invisible.
	let turnFresh = null;   // a turn reached with Next: its cycle plays once
	let turnRun = 0;        // moves on at every render: a turn's cycle still playing from an earlier one stops
	let turnBack = false;   // a turn reached with Back: shown at its last step
	// to another turn of the sequence; a turn explained is explained only while it is on screen
	// still: shown as it ends, never played (a jump, not Next)
	function turnGo(to, still = false) {
		const m = st.make, from = m.turn || 0;
		m.turn = Math.max(0, Math.min(m.symbols.length - 1, to));
		turnFresh = !still && m.turn === from + 1 ? m.turn : null;
		turnBack = m.turn === from - 1;
		m.explain = null;
		render();
	}
	// «?» or «⋯ › Explain this turn»: this turn again, a relation at a time, from its first step
	function explainTurn() {
		const m = st.make;
		m.explain = { turn: m.turn || 0, run: (m.explain ? m.explain.run : 0) + 1 };
		turnFresh = null; turnBack = false;
		render();
	}
	// the key's things, if the key is a string (its own collection's, or the seed's)
	const keyThingsMade = () => st.mode !== "pad" || st.plan.padAs === "file" ? null : st.plan.padForm ? st.padDict.things : st.dict.things;
	// the whole string, as the sheet draws it, in a popup: a piece tapped goes to its turn
	function wholeString() {
		const m = st.make, L = m.symbols.length, perRow = Math.max(13, Math.ceil(Math.sqrt(L * 2.6)));
		const close = Slides.popup(h("div", { class: "seq-map" }, drawSeq(st.dict.things, m.symbols, { current: m.turn || 0, perRow, form: st.plan.form,
			onPick: (j) => { close(); turnGo(j, true); } })), { label: T().seqWhole });
	}
	function turnSlide() {
		const t = T(), m = st.make, things = st.dict.things, n = things.length, k = Math.log2(n), pad = st.mode === "pad";
		const file = pad && st.plan.padAs === "file", keyThings = keyThingsMade();
		const L = m.symbols.length, i = m.turn = Math.max(0, Math.min(L - 1, m.turn || 0)), pos = i + 1;
		const plain = pad ? m.basic : m.symbols, P = plain[i], C = m.symbols[i], K = pad ? m.pad[i] : null;
		const lay = Lay.makeTurn({ pad, n, file }), b = lay.boxes, stages = J.turnStages({ pad, file }), last = stages.length - 1;
		const qr = S.compactSeedQR(m.entropy), size = qr.size, cells = S.dataModulesRowMajor(size), ndata = cells.length;
		const bits = S.symbolsToBits(plain, k), turn = S.turnBits(size, i, k), roles = turn.map((x) => x.role);
		const explaining = i < J.EXPLAINED || !!(m.explain && m.explain.turn === i);
		const fresh = !explaining && turnFresh === i && !calm(), back = turnBack;
		turnFresh = null; turnBack = false;
		const changed = (m.keyChanged || []).includes(i);
		// the header (version and mask) and the padding have no squares in the QR code
		const note = roles.includes("header") ? t.turnHeader : roles.includes("padding") ? t.turnPadding : null;
		// the last turn, once whole: why it is made this way (with a key: why both strings are needed)
		const end = i === L - 1 ? (pad ? t.endPad : t.endBasic) : null;

		// the QR code: its fixed squares, the data squares of the turns so far, this turn's in blue
		const fixed = S.functionModules(size), data = new Map(cells.map(([r, c], j) => [r * size + c, j]));
		const upto = Math.min(ndata, (i + 1) * k);
		const modules = (r, c) => fixed.has(r * size + c) ? qr.getModule(c, r) : data.get(r * size + c) < upto ? bits[data.get(r * size + c)] === 1 : null;
		const turnCells = turn.filter((x) => x.cell).map((x) => x.cell);
		const stageOf = (arrowId) => stages.findIndex((s) => s.arrows.includes(arrowId));
		const at = (id) => stages.findIndex((s) => s.id === id);

		// the slide as it is at stage p (0 … last); turning: the dictionaries reaching their row now turn to it
		const groups = {}, arrowGroups = lay.arrows.map(() => svg("g"));
		["qr", "bits", "number", "key", "keyDict", "keyNumber", "clock", "seedDict", "seedString"].forEach((g) => { groups[g] = svg("g"); });
		const wait = (el, on) => on ? el : svg("g", { class: "tn-wait" }, el);
		function draw(p, turning, onRun) {
			const reached = (id) => at(id) >= 0 && at(id) <= p;
			groups.qr.replaceChildren(V.qr({ box: b.qr, size, modules, turnCells }));
			groups.bits.replaceChildren(V.bits({ box: b.bits, bits: turn.map((x) => reached("bits") ? bits[x.bit] : null), roles, colour: "qr" }));
			groups.number.replaceChildren(V.number({ box: b.number, value: reached("number") ? P : null, colour: "qr" }));
			if (pad) {
				groups.key.replaceChildren(file ? keyFileColumn() : V.string({ box: b.keyString, orientation: "v", role: "reference", kind: "key", things: keyThings,
					items: Array.from({ length: 7 }, (_, j) => { const x = i - 3 + j; return x < 0 || x >= L ? undefined : m.pad[x]; }), current: 3, firstPosition: i - 2 }));
				const keyAt = at(file ? "key" : "keyNumber");
				if (b.keyDict) groups.keyDict.replaceChildren(wait(V.dictionary({ box: b.keyDict, things: keyThings, mode: "reel", icon: "key",
					value: p >= keyAt ? K : null, from: turning && p === keyAt ? 0 : undefined }), reached("key")));
				groups.keyNumber.replaceChildren(V.number({ box: b.keyNumber, value: p >= keyAt ? K : null, colour: "key" }));
				const clockAt = at("clock");
				groups.clock.replaceChildren(p < clockAt ? svg("g") : V.clock({ box: b.clock, n, from: P, by: K, sign: 1, inputColour: "qr",
					phase: p === clockAt ? "inputs" : p === at("out") && turning ? "run" : "done", onDone: p === at("out") ? onRun : undefined }));
			}
			groups.seedDict.replaceChildren(wait(V.dictionary({ box: b.seedDict, things, mode: "reel", icon: "seed",
				value: reached("dict") ? C : null, from: turning && p === at("dict") ? 0 : undefined }), reached("dict")));
			// your string: those before the turn in place, the slot (filled at the last stage), the rest to come
			groups.seedString.replaceChildren(V.string({ box: b.seedString, role: "build", kind: "seed", things, current: 6, firstPosition: i - 5,
				items: Array.from({ length: 13 }, (_, j) => { const x = i - 6 + j; return x < 0 || x >= L ? undefined : x < i ? m.symbols[x] : x === i && reached("slot") ? C : null; }) }));
			lay.arrows.forEach((a, j) => {
				const s = stageOf(a.id);
				arrowGroups[j].replaceChildren(V.arrow({ points: a.points, colour: a.colour, state: s === p ? "current" : s < p ? "past" : "hidden" }));
			});
		}
		// the key file's characters around the turn, a column like the key string's: the turn's framed
		function keyFileColumn() {
			const box = b.keyString, top = 14, pitch = (box.h - top) / 7, parts = [svg("text", { x: box.x + box.w / 2, y: box.y + 11, "font-size": 11, "text-anchor": "middle", class: "v-t v-icon" }, ICON.key)];
			for (let j = 0; j < 7; j++) {
				const x = i - 3 + j, y = box.y + top + pitch * (j + 0.5);
				if (x < 0 || x >= L) continue;
				if (j === 3) parts.push(svg("rect", { x: box.x, y: y - pitch / 2 + 0.5, width: box.w, height: pitch - 1, rx: 3, class: "v-turn-frame" }));
				parts.push(svg("text", { x: box.x + 9, y: y + 3, "font-size": j === 3 ? 10 : 8, "text-anchor": "middle", class: "v-t v-pos" + (j === 3 ? " v-pos-current v-c-qr v-bold" : "") }, x + 1),
					svg("text", { x: box.x + 25, y: y + 5, "font-size": 14, "text-anchor": "middle", class: "v-t v-mono v-bold v-c-key" + (j === 3 ? "" : " tn-dim") }, S.PAD_DIGITS[m.pad[x]]));
			}
			return svg("g", { class: "v v-file", role: "img", "aria-label": t.padFileTitle }, parts);
		}

		function body(step) {
			const kids = [groups.qr, groups.bits, groups.number, groups.key, groups.keyDict, groups.keyNumber, groups.clock, groups.seedDict, groups.seedString, ...arrowGroups];
			if (explaining) draw(step, true);
			else if (fresh) {
				// on arriving: the cycle plays, a relation at a time; the clock turns step by step, then it goes on
				// (stage 0 now, before the body is on the page; each later stage only while
				// nothing has been drawn since: render() moves the token on)
				const run = turnRun, later = (fn, ms) => setTimeout(() => { if (run === turnRun) fn(); }, ms);
				const play = (p) => {
					const out = stages[p].id === "out";
					draw(p, true, out ? () => later(() => play(p + 1), 300) : undefined);
					if (p < last && !out) later(() => play(p + 1), 450);
				};
				play(0);
			} else draw(last, false);
			return h("div", { class: "dict-slide tn-slide" }, canvas(...kids));
		}

		// the sentences: one per relation (the first turns, or «?»); else what this turn has to say
		const bitsText = turn.map((x) => bits[x.bit]).join("");
		const say = (id) => ({
			position: t.turnPosition(pos), bits: note || t.turnBitsAre, number: t.turnNumber(bitsText, P),
			key: file ? t.turnKeyFile(pos, S.PAD_DIGITS[K], K) : t.turnKeyAt(pos), keyNumber: t.turnKeyNumber(K),
			clock: t.turnClockOf(n), out: t.turnOut(C), dict: t.turnDict(C), slot: t.turnSlot(pos),
		})[id];
		const caption = explaining
			? (s) => s === last && changed ? `${say("slot")} ${t.seqKeyChanged}` : s >= last && end ? end : say(stages[Math.min(s, last)].id)
			: () => changed ? t.seqKeyChanged : end || note;

		const listName = pad ? "list-a.txt" : "sequence.txt";
		const shortcuts = [
			{ icon: "⏩", label: t.seeAll, go: () => turnGo(L - 1, true) },
			{ icon: "🧵", label: t.seqWhole, go: wholeString },
			{ icon: "🖨", label: t.printIt, go: () => go("print") },
			{ icon: "⤓", label: t.saveList, go: () => download(m.symbols.map((s, j) => `${j + 1}. ${things[s].name}`).join("\n") + "\n", listName, "text/plain") },
			{ icon: "?", label: t.seqExplain, go: explainTurn },
			...keyChangedWays(),
			{ icon: "◀", label: t.otherSeed, go: () => { if (confirm(t.otherSeedAsk(st.mode))) otherSeed(); } },
		];
		return {
			count: `${pos}/${L}`, steps: explaining ? stages.length : 1, startStep: explaining && back ? last : 0, caption, shortcuts, help: explainTurn, body,
			prev: i > 0 ? { go: () => turnGo(i - 1) } : undefined,
			next: i < L - 1 ? { go: () => turnGo(i + 1) } : undefined,
		};
	}

	// ---- make, 6: read it back --------------------------------------------------
	function checkStep() {
		const m = st.make;
		if (!m.check) m.check = freshRead();
		// read as it was made; a key file made here is read as it is (the key as things is read back like the sequence)
		Object.assign(m.check, { mode: st.mode, words: st.plan.words, padAs: st.plan.padAs, padForm: st.plan.padForm, padDict: st.padDict, form: st.plan.form });
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
					st.make = { seed: "", entropy: null, symbols: null, turn: 0 };
					st.read = freshRead(); st.gathered = {}; fingerprints.clear();
					st.step.make = "plan"; st.at.make = "mode";
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
		// reading turn by turn: the arrows move among the turns read (the space bar is left to the buttons)
		const rd = st.edit ? null : st.screen === "read" && st.step.read === "recover" && st.read.mode && st.read.dict && keyGiven() ? st.read
			: st.screen === "make" && st.step.make === "check" && st.dict && m.symbols ? m.check : null;
		if (rd && !rd.typing) {
			if (e.key === "ArrowRight") { e.preventDefault(); readGo(rd, rd.turn + 1); }
			if (e.key === "ArrowLeft") { e.preventDefault(); readGo(rd, rd.turn - 1); }
			return navKey;
		}
		return false;
	}

	// ---- read ------------------------------------------------------------
	// read, 1: what you have — the mode it was made in, its form, its dictionary and, with a key, the key: decisions (SLIDES.read)
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
		const n = dictFor(rd).things.length;
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
		const L = symbolsFor(words, dictFor(rd).things.length);
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
	const keyThingsOf = (rd) => rd.padForm && rd.padDict ? rd.padDict.things : dictFor(rd).things;
	const readLength = (rd) => symbolsFor(rd.words, dictFor(rd).things.length);
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
		const n = dictFor(rd).things.length, L = readLength(rd), key = readKey(rd);
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
		const t = T(), things = dictFor(rd).things, n = things.length, k = Math.log2(n), padMode = rd.mode === "pad";
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
			if (i === 0 && !st.seen.readTap) left.push(h("div", { class: "note", text: t.forms[rd.form || st.plan.form].read }), keyThings ? hint(t.tapPadHelp) : null);
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
				sofar.length ? h("div", { class: "map turn-map" }, drawSeq(things, sofar, { current: i < L ? i : -1, onPick: (j) => readGo(rd, j), form: rd.form || st.plan.form })) : null));
	}

	// read, 3: the seed — its QR code to scan, its words and its fingerprint
	function seedStep() {
		const t = T(), rd = st.read, qr = S.compactSeedQR(rd.out.entropy);
		setNav({});
		return tool(panel(...stepHead("read"), ...readNotes(rd.out), seedResult(rd.out),
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: () => { st.read = freshRead(st.read); toStep("read", "have"); } } }, t.readAgain))),
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
					h("button", { class: "btn ghost", on: { click: () => goSlide("make", "seq") } }, "◀ " + t.back),
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
			setDict({ things: thingsOf(set, st.plan.n), checked: false, way: "ready" }); st.ways.make.dict = "ready";
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
