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
	// everything but the language, as on opening the page (and after «Forget everything»)
	const freshState = () => ({
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
		seen: {},  // the one-line explanations already shown once: keyWhy, reroll, keyPart, rowCheck, readTap
	});
	const st = { lang: (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en", ...freshState() };
	// What is being read, turn by turn (readTurnSlide): the turn shown (L: the
	// end), each turn's piece of the sequence (taps) and, in pad mode, of the
	// key (keyTaps, or keyFile: the key file's numbers, from fileText, checked
	// in "What you have"); typing, text, keyText, typeError: everything typed
	// at once («⋯ › Type it all»); out, error: what decodeTurns made of
	// it, for sig (the pieces it was worked out from). What it is read as is
	// its own, apart from the backup being made (st.mode, st.plan, st.padDict):
	// mode, words, padAs, padForm and padDict (the key's own collection), form,
	// n (until there is a dictionary), chosen (as the plan's) and dict, its own
	// dictionary, kept from `keep`.
	function freshRead(keep) {
		return { turn: 0, taps: [], keyTaps: [], keyFile: null, fileText: "",
			typing: false, text: "", keyText: "", typeError: "", out: null, error: "", sig: "", from: null,
			words: keep ? keep.words : 12, padAs: keep ? keep.padAs : "string", padForm: keep ? keep.padForm : null, padDict: keep ? keep.padDict : null,
			mode: keep ? keep.mode : null, form: keep ? keep.form : "necklace", n: keep ? keep.n : 16, chosen: keep ? keep.chosen : {}, dict: keep ? keep.dict : null };
	}
	const T = () => SEEDCRAFT_TEXT[st.lang];
	// the QR's fixed areas (amber, hatched), and the legend saying so where there is room
	const qrFixed = (size, box) => ({ fixed: S.functionModules(size), legend: box.h >= 150 ? T().qrFixedLegend : null });
	// a dictionary of another size, or another one (reset, once asked: changeDict):
	// what was made with the old one goes (a renamed piece changes nothing: the
	// sequence is numbers). Recovering has its own (st.read.dict, setReadDict):
	// reading never touches the backup.
	function setDict(d, reset) {
		const same = !reset && st.dict && d && st.dict.things.length === d.things.length;
		st.dict = d;
		if (d) st.plan.n = d.things.length;
		if (!same) st.make = { seed: st.make.seed, entropy: null, symbols: null, turn: 0 };
	}
	// the same for what is being read: another size (or reset), what was read with the old one goes
	function setReadDict(d, reset) {
		const rd = st.read, size = rd.dict && d && rd.dict.things.length === d.things.length;
		if (!size || reset) st.read = { ...freshRead(rd), padDict: size ? rd.padDict : null };
		st.read.dict = d;
		if (d) st.read.n = d.things.length;
	}
	// two dictionaries with the same pieces, in the same order
	const PIECE_KEYS = ["name", "emoji", "colour", "photo"];
	const sameThings = (a, b) => !!a && !!b && a.things.length === b.things.length
		&& a.things.every((x, j) => PIECE_KEYS.every((k) => (x[k] || "") === (b.things[j][k] || "")));
	// the dictionary of the journey on screen, and how to replace it
	const seedColl = () => st.screen === "read" ? { dict: st.read.dict, set: setReadDict } : { dict: st.dict, set: setDict };
	// the dictionary something is read with: recovering, the reading's own; checking a copy, the backup's
	const dictFor = (rd) => rd === st.read ? st.read.dict : st.dict;

	// another number of words: what was made for the old length goes (the key, the sequence), as with a new N
	function setWords(words) {
		st.plan.words = words; st.gathered = {};
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
	// One file picker for the whole page, outside the slides (they are drawn
	// anew on every change): Safari tells nothing of a file chosen in a picker
	// that left the page meanwhile. Each use says what files it takes and what
	// to do with the one chosen, whatever slide is on screen by then.
	let onPicked = null;
	const picker = h("input", { type: "file", class: "hidden", tabindex: "-1", "aria-hidden": "true", on: { change: () => {
		const f = picker.files && picker.files[0], fn = onPicked;
		picker.value = "";
		if (f && fn) fn(f);
	} } });
	document.body.append(picker);
	function pickFile(accept, fn, capture) {
		picker.setAttribute("accept", accept);
		if (capture) picker.setAttribute("capture", capture); else picker.removeAttribute("capture");
		onPicked = fn;
		picker.click();
	}
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
	// the automatic initials of a whole dictionary: the entries that would collide get three letters
	const autoInitials = (things) => {
		const at = things.map((x, i) => i).filter((i) => (things[i].name || "").trim()), u = J.uniqueInitials(at.map((i) => things[i].name.trim()), initialsOf), out = things.map(() => "");
		at.forEach((i, j) => { out[i] = u[j]; });
		return out;
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
	const readImage = (file) => new Promise((resolve, reject) => {
		const fr = new FileReader();
		fr.onerror = reject;
		fr.onload = () => {
			const img = new Image();
			img.onerror = reject;
			img.onload = () => resolve({ img, src: fr.result });
			img.src = fr.result;
		};
		fr.readAsDataURL(file);
	});
	// crop: {x, y, side} in the image's own pixels (none: the centred largest square)
	function photoOf(file, crop = null) {
		return readImage(file).then(({ img }) => {
			const iw = img.naturalWidth, ih = img.naturalHeight, side = Math.min(iw, ih);
			const r = crop ? Lay.cropClamp({ iw, ih, ...crop }) : { x: (iw - side) / 2, y: (ih - side) / 2, side }, c = document.createElement("canvas");
			c.width = c.height = 192;
			c.getContext("2d").drawImage(img, r.x, r.y, r.side, r.side, 0, 0, 192, 192);
			return c.toDataURL("image/jpeg", 0.85);
		});
	}
	// The popup that frames a photo: the image fitted, a square frame to drag, resize (wheel,
	// pinch, slider, +/−) and nudge (arrows). Resolves the crop, or null when cancelled.
	function cropPopup(file) {
		return readImage(file).then(({ img, src }) => new Promise((resolve) => {
			const t = T(), iw = img.naturalWidth, ih = img.naturalHeight, fit = Math.min(220 / iw, 150 / ih), short = Math.min(iw, ih);
			let c = Lay.cropClamp({ iw, ih, x: (iw - short) / 2, y: (ih - short) / 2, side: short }), done = false;
			const stage = h("div", { class: "crop-stage", tabindex: "0", role: "group", "aria-label": t.cropQ }), pic = h("img", { class: "crop-img", src, alt: "", draggable: "false" }), frame = h("div", { class: "crop-frame" });
			stage.style.width = `calc(var(--u) * ${iw * fit})`; stage.style.height = `calc(var(--u) * ${ih * fit})`;
			stage.append(pic, frame);
			const slider = h("input", { type: "range", class: "crop-size", min: "32", max: String(short), step: "1", "aria-label": t.cropSize });
			const paint = () => {
				frame.style.left = `calc(var(--u) * ${c.x * fit})`; frame.style.top = `calc(var(--u) * ${c.y * fit})`;
				frame.style.width = frame.style.height = `calc(var(--u) * ${c.side * fit})`;
				slider.value = String(Math.round(c.side));
			};
			// resize about the frame's centre
			const resize = (side) => { const m = Lay.cropClamp({ iw, ih, x: 0, y: 0, side }).side, cx = c.x + c.side / 2, cy = c.y + c.side / 2; c = Lay.cropClamp({ iw, ih, x: cx - m / 2, y: cy - m / 2, side: m }); paint(); };
			const move = (dx, dy) => { c = Lay.cropClamp({ iw, ih, x: c.x + dx, y: c.y + dy, side: c.side }); paint(); };
			const pts = new Map();
			let last = 0;
			const pxPerImg = () => stage.getBoundingClientRect().width / iw;
			const span = () => { const [p, q] = [...pts.values()]; return Math.hypot(p.x - q.x, p.y - q.y); };
			stage.addEventListener("pointerdown", (e) => {
				pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
				try { stage.setPointerCapture(e.pointerId); } catch (z) { /* not captured */ }
				if (pts.size === 2) last = span();
				else if (pts.size === 1) {
					// a press outside the frame puts its centre there
					const r = stage.getBoundingClientRect(), k = pxPerImg(), ix = (e.clientX - r.left) / k, iy = (e.clientY - r.top) / k;
					if (ix < c.x || ix > c.x + c.side || iy < c.y || iy > c.y + c.side) move(ix - c.side / 2 - c.x, iy - c.side / 2 - c.y);
				}
			});
			stage.addEventListener("pointermove", (e) => {
				const p = pts.get(e.pointerId); if (!p) return;
				const dx = e.clientX - p.x, dy = e.clientY - p.y;
				pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
				if (pts.size >= 2) { const s = span(); if (last > 0 && s > 0) resize(Lay.cropPinch(c.side, last, s)); last = s; }
				else { const k = pxPerImg(); move(dx / k, dy / k); }
			});
			const up = (e) => { pts.delete(e.pointerId); if (pts.size === 1) last = 0; };
			stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
			stage.addEventListener("wheel", (e) => { e.preventDefault(); resize(c.side * Math.exp(e.deltaY * 0.002)); }, { passive: false });
			stage.addEventListener("keydown", (e) => {
				const zoom = Lay.cropKeyScale(e.key);
				if (zoom && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); resize(c.side * zoom); return; }
				const d = Math.max(1, Math.round(c.side / 20)), v = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
				if (v) { e.preventDefault(); move(...v); }
			});
			slider.addEventListener("input", () => resize(+slider.value));
			const finish = (r) => { if (done) return; done = true; resolve(r); };
			const close = Slides.popup(h("div", { class: "slide-help crop-pop" }, h("h2", { text: t.cropQ }), stage,
				h("div", { class: "crop-row" }, h("button", { type: "button", class: "btn ghost", "aria-label": "−", text: "−", on: { click: () => resize(c.side * Lay.CROP_STEP) } }), slider,
					h("button", { type: "button", class: "btn ghost", "aria-label": "+", text: "+", on: { click: () => resize(c.side / Lay.CROP_STEP) } })),
				h("div", { class: "crop-row" }, h("button", { type: "button", class: "btn ghost", text: t.cropCancel, on: { click: () => close() } }),
					h("button", { type: "button", class: "btn", text: t.cropDo, on: { click: () => { finish({ x: c.x, y: c.y, side: c.side }); close(); } } }))),
				{ label: t.cropQ, onClose: () => finish(null) });
			paint();
		}));
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
	// Every screen is a slide (slides.js): the journeys' slides, and the
	// start page, about, donate and the printable sheet as they are, each a
	// page fitted into the frame (slides.js's page: under the guide's band,
	// scrolling inside only what does not fit).
	const Slides = SeedcraftSlides;
	let mounted = false;
	function render() {
		turnRun++;
		document.documentElement.lang = st.lang;
		if (!mounted) {
			// another language from the «⋯» panel: the same slide, the same state, redrawn
			Slides.mount($("app"), { lang: st.lang, onLang: (l) => { st.lang = l; render(); } });
			mounted = true;
		}
		Slides.setLang(st.lang);
		// the mask's bubble is over once a slide that is no turn is shown
		if (!(st.screen === "make" && ["seq", "check"].includes(st.at.make)) && !(st.screen === "read" && st.at.read === "recover")) st.seen.maskWhy = st.seen.maskWhy || maskTipTurn !== null;
		const reading = st.screen === "read" && st.at.read === "recover" ? st.read : st.screen === "make" && st.at.make === "check" ? st.make.check : null;
		const view = [st.screen, st.at[st.screen], st.at[st.screen] === "seq" ? st.make.turn : "", reading ? `${reading.turn}${reading.typing ? "t" : ""}` : "", st.make.explain ? st.make.explain.run : "", st.make.key && st.make.key.by, st.make.key && st.make.key.pos, st.make.key && !!st.make.key.fix, st.edit && st.edit.kind, st.edit && st.edit.target, st.edit && st.edit.i].join();
		Slides.show(slideNow(view));
		online();
	}
	// the slide for what is on screen now
	function slideNow(view) {
		const t = T(), home = { icon: V.iconTag("home"), label: t.slidesHome, go: () => go("intro") };
		const toStart = { label: "◀ " + t.tabIntro, go: () => go("intro") };
		const page = (body, prev) => ({ id: view, page: true, guide: [], question: null, steps: 1, body: () => body,
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
	// pieces, a dictionary, a throw, a turn, an end, storing it. Back and Next
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
			keyTool: !!(m.key && m.key.by), keyThrow: keyDone(), pieces: gatherOk(), seed: !!m.symbols, qr: !!m.symbols, seqIntro: !!m.symbols, seq: !!m.symbols, checkIntro: !!m.symbols, check: !!m.checked })[id] !== false;
		return ({ mode: !!rd.mode, form: !!rd.chosen.form, size: !!rd.dict || !!rd.chosen.size, dict: !!rd.dict, keyAs: !!rd.chosen.padAs,
			keyColl: !!rd.chosen.padColl, keyForm: !!rd.chosen.padForm, keyDict: !!rd.padDict, keyFile: !!rd.keyFile, words: !!rd.chosen.words, recover: !!rd.out })[id] !== false;
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
			: before ? { go: () => goSlide(flow, along(flow, at, -1)) } : toStart;
		const after = along(flow, at, 1);
		const forward = () => { if (d.onNext) d.onNext(); goSlide(flow, along(flow, at, 1)); };
		const next = d.hidden ? null : d.next !== undefined ? d.next
			: after ? { go: forward, ready: d.ready !== false } : null;
		return { id: view, guide, question: d.question || null, steps: d.steps || 1, startStep: d.startStep || 0, wide: !!d.wide, body: d.body, caption: d.caption || null,
			prev, next, shortcuts: [...(d.shortcuts || []), home], help: d.help || null, hurry: d.hurry || null, keys: d.keys || null, hint: d.hint || null };
	}
	// ---- small building blocks ----------------------------------------
	const panel = (...children) => h("section", { class: "panel" }, ...children);
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
		st.mode = mode; st.gathered = {};
		st.make = { seed: m.seed, entropy: null, symbols: null, turn: 0 };
		return true;
	}
	// ---- the two journeys ----------------------------------------------
	// Making a backup and reading one: each a sequence of steps, the guide's.
	// The key's step is there only with a key. Making one, the key comes
	// first: the sequence is made with it. Reading one, the key is given with
	// the rest of what you have, and both strings are read together, turn by turn.
	const MAKE_STEPS = ["plan", "gather", "dict", "key", "seq", "check", "store"];
	const READ_STEPS = ["have", "recover", "seed"];
	const keyThread = (step) => step === "key";
	const stepsOf = (flow) => (flow === "make" ? MAKE_STEPS : READ_STEPS).filter((x) => !keyThread(x) || st.mode === "pad");
	const stepName = (flow, step) => (flow === "make" ? T().makeSteps[MAKE_STEPS.indexOf(step)] : T().readSteps[READ_STEPS.indexOf(step)])[0];
	// to a step: its first slide
	function toStep(flow, step) { const x = journeyOf(flow).find((y) => y.step === step); goSlide(flow, x && x.id); }
	// the key's step has done its job: the key is whole and, as a file, saved
	const keyDone = () => keyReady() && (st.plan.padAs === "string" || !!st.make.padKept);
	// The step a slide needs done first, if any: a slide that cannot start
	// yet says which one comes first, and Next goes there.
	function needFirst(flow, step) {
		const m = st.make, later = ["key", "seq", "check", "store"].includes(step);
		if (flow === "make") {
			if (step !== "plan" && !st.mode) return "plan";
			if (later && (!st.dict || (keyDictNeeded() && !st.padDict))) return "dict";
			if (["seq", "check", "store"].includes(step) && st.mode === "pad" && !keyReady()) return "key";
			// a key file is saved before a sequence is made with it, and before it is checked: this page forgets it
			// (Store too: its own warning and its forgetting that waits are a second guard)
			if ((step === "check" || step === "store" || (step === "seq" && !m.symbols)) && st.mode === "pad" && st.plan.padAs === "file" && !m.padKept) return "key";
			if ((step === "check" || step === "store") && !m.symbols) return "seq";
			return null;
		}
		if (step !== "have" && (!st.read.mode || !st.read.dict || !keyGiven())) return "have";
		if (step === "seed" && !st.read.out) return "recover";
		return null;
	}
	const needs = (flow) => {
		const need = needFirst(flow, st.step[flow]);
		return need ? { question: T().needFirst(stepName(flow, need)), body: () => null, next: { label: stepName(flow, need) + " ▶", go: () => toStep(flow, need) } } : null;
	};

	// ---- the decisions: a question, and a card per option -------------------------
	// Every choice looks the same (vocab.js's cards): each card's drawing in
	// the one visual vocabulary, its name, at most two ✓ and two ✕ (SPEC §11,
	// RISK-AUDIT.md). A tap chooses, and the chosen card has the accent; Next
	// waits until one is chosen. A choice that would undo work asks first.
	const V = SeedcraftVocab(svg, h);
	function decide({ question, options, chosen, choose, ready, help, shortcuts, next, caption, intro }) {
		const grid = J.cardGrid(options.length);
		return { question, help, shortcuts, next, caption, ready: ready !== undefined ? ready : chosen !== null && chosen !== undefined,
			body: () => h("div", { class: "decision" + (intro ? " intro" : "") + (grid.compact ? " compact" : "") },
				intro ? h("p", { class: "decision-intro", text: intro }) : null,
				V.cards({ options, chosen, grid, onChoose: (id) => {
					// a card chosen from the keyboard keeps the focus on the chosen one, drawn anew
					const keyed = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("v-card");
					choose(id); render();
					const on = keyed && $("app").querySelector(".v-card.on");
					if (on) on.focus();
				} })) };
	}
	// «?»: a few lines on what to think of, over the slide
	const helpOf = (title, lead, items) => () => Slides.popup(h("div", { class: "slide-help" }, h("h2", { text: title }),
		lead ? h("p", { text: lead }) : null, items.length ? h("ul", {}, items.map((x) => h("li", { text: x }))) : null), { label: title });

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
	const dictArt = (things, icon, extra) => artOf(extra || null, V.dictionary({ label: T().dictLabel, box: { x: 34, y: 2, w: 92, h: 52 }, things, icon }));
	const keyFileArt = () => artOf(V.icon("key", 22, 29, 18),
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
		return { id: w, title: T().words(w), sub: T().wordsLenSub(L), pros: [], cons: [],
			// the string's last positions: how long it is
			art: artOf(V.string({ box: { x: 0, y: 4, w: ART_W, h: ART_H - 8 }, orientation: "h", role: "read", kind: "seed", items: [null, null, null, null], firstPosition: L - 3, showValues: false, room: 20 })) };
	});
	// words: the seed's; null (recovering: it is not asked) gives both lengths, 12 and 24 words
	function sizeOptions(formId, words) {
		const c = T().cards, rec = formOf(formId).n;
		return SIZES.map((n) => {
			const L = symbolsFor(words || 12, n), L2 = words ? undefined : symbolsFor(24, n);
			return { id: n, title: c.sizeTitle(n), art: artOf(artString(kindThings(formId, n), [0, n - 1, 1, n - 2])),
				star: n === rec, starLabel: c.recommended,
				pros: [n <= 8 ? c.sizeEasy : c.sizeShort(L, L2)],
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
	function setForm(id) { if (id !== st.plan.form) st.gathered = {}; st.plan.form = id; if (!st.dict && !st.plan.chosen.size) st.plan.n = formOf(id).n; }
	const madeWork = () => !!(st.make.symbols || (st.make.key && st.make.key.pieces.length));
	const readWork = () => !!(st.read.taps.length || st.read.keyTaps.length);
	// another dictionary (of the journey on screen): any other one, of any size,
	// undoes what was made or read with the old one; with work done, or the old
	// one named by the person, it is asked first (no: everything stays)
	function changeDict(d) {
		const c = seedColl(), work = st.screen === "read" ? readWork() : madeWork();
		const size = () => { if (st.screen !== "read" && d.things.length !== st.plan.n) st.gathered = {}; };
		if (!c.dict || sameThings(c.dict, d)) { size(); c.set(d); return true; }
		if ((work || c.dict.way === "name") && !confirm(T().dictChangeAsk)) return false;
		size();
		c.set(d, work);
		return true;
	}
	// the same for the key's own dictionary: what was read with it, or the backup's check, goes
	function changeKeyDict(d) {
		const kc = keyColl(), work = st.screen === "read" ? !!st.read.keyTaps.length : madeWork();
		if (!kc.dict || sameThings(kc.dict, d)) { kc.set(d); return true; }
		if ((work || kc.dict.way === "name") && !confirm(T().keyDictChangeAsk)) return false;
		kc.set(d, work);
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
		if (v !== p.n && p === st.plan) st.gathered = {};
		p.n = v; p.chosen.size = true;
	}
	// the key's own collection (null: the same as the sequence's): its dictionary goes, asked first
	function setPadForm(f) {
		const kc = keyColl(), p = st.screen === "read" ? st.read : st.plan;
		if (f === p.padForm) return true;
		// recovering, the key's pieces read so far were of the old collection: they go too
		if ((kc.dict || (st.screen === "read" && st.read.keyTaps.length)) && !confirm(T().keyCollChangeAsk)) return false;
		if (p === st.plan) st.gathered = {};
		p.padForm = f; p.chosen.padForm = false; kc.set(null, true); st.ways[st.screen].keyDict = null; st.ways[st.screen].keyNameDraft = null;
		return true;
	}

	// the key as a string or as a file: once some of it is drawn (or read), asked
	// first; making one, it is then saved, read back and stored again as the new
	// kind; recovering, what was read of the key goes
	function setPadAs(v) {
		const reading = st.screen === "read", p = reading ? st.read : st.plan, m = st.make;
		if (v === p.padAs) return true;
		const work = reading ? !!(st.read.keyTaps.length || st.read.keyFile) : !!(m.key && m.key.pieces.length);
		if (work && !confirm(reading ? T().keyAsChangeAskRead : T().keyAsChangeAsk)) return false;
		p.padAs = v; if (!reading) st.gathered = {};
		// a key file holds no bag: a bag key becomes the best die, thrown again from the start
		if (!reading && v === "file" && m.key && m.key.by === "bag") setKey({ ...m.key, by: J.keyByForFile(m.key.by, st.dict.things.length, S.DICE.filter((x) => x !== 2)), draft: [], fix: null });
		if (reading) forgetKeyRead(st.read, true);
		else Object.assign(m, { padKept: false, check: null, checked: false, storedAt: {} });
		return true;
	}

	// ---- the slides of each journey ------------------------------------------
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
					choose: (v) => { if (setPadAs(v)) p.chosen.padAs = true; } });
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
			qr: () => needs("make") || qrSlide(),
			seqIntro: () => needs("make") || seqIntroSlide(),
			seq: () => needs("make") || turnSlide(),
			checkIntro: () => needs("make") || checkIntroSlide(),
			check: () => needs("make") || checkTurns(),
			store: () => needs("make") || storeSlide(),
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
					choose: (v) => { if (setPadAs(v)) st.read.chosen.padAs = true; } });
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
			words: () => {
				const rd = st.read;
				return decide({ question: T().seedWords, options: wordsOptions(rd.dict ? rd.dict.things.length : rd.n), chosen: rd.chosen.words ? rd.words : null,
					choose: (w) => {
						const L = symbolsFor(w, rd.dict ? rd.dict.things.length : rd.n);
						// fewer words: the pieces read past the new end go, asked first
						if (w !== rd.words && (rd.taps.length > L || rd.keyTaps.length > L) && !confirm(T().readWordsAsk(L))) return;
						if (w !== rd.words && rd.dict) readWords(rd, w); else rd.words = w;
						rd.chosen.words = true;
					} });
			},
			recover: () => needs("read") || recoverSlide(),
			seed: () => needs("read") || recoverEnd(),
		},
	};

	// ---- the dictionary: ready-made, your own, or one saved before ----------------
	// (naming it piece by piece, checking it: nameSlide, checkSlide)
	// a dictionary file opened: its pieces, or what is wrong with it (n: the size it must have)
	function openDictFile(n, onThings, onError) {
		pickFile(".json,.txt,application/json,text/plain", async (f) => {
			const t = T();
			try {
				const things = dictFromFile(await f.text(), f.name), problem = dictProblem(things);
				if (problem) onError(problem);
				else if (n && things.length !== n) onError(t.errPadDictSize(things.length, n));
				else {
					onThings(things);
					if (things.fixedInitials) Slides.popup(h("div", { class: "slide-help" }, h("p", { text: t.dupInitials })), { label: t.dupInitials });
				}
			} catch (x) { onError(t.errDictFile); }
		});
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
		const open = () => openDictFile(0, (things) => { if (changeDict({ things, checked: false, way: "open" })) ways.dict = "open"; render(); },
			(msg) => { ways.error = msg; render(); });
		const pick = (x) => { if (changeDict({ things: thingsOf(x, n), checked: x.id === "streets" && formId === "book", way: "ready" })) { ways.dict = "ready"; ways.error = ""; } };
		const chosen = ways.dict || (dict ? dict.way || "ready" : null);
		// your own: named piece by piece once Next is pressed; then the dictionary as it is
		const naming = chosen === "name" && !(dict && dict.way === "name");
		return decide({ question: t.dictQ, options: dictOptions(n, formId, "seed"), chosen,
			choose: (id) => { ways.error = ""; if (id === "ready") pick(set); else if (id === "name") ways.dict = "name"; else open(); },
			ready: naming || !!dict, caption: () => ways.error || "", intro: t.dictIntro,
			next: naming ? { go: () => editDict(nameDraft(ways, "nameDraft", undefined, n)), ready: true } : undefined,
			help: helpOf(t.dictBeforeTitle, null, t.dictChecks),
			shortcuts: SETS.filter((x) => x.things.length >= n && x !== set).map((x) => ({ icon: x.icon, label: x[st.lang], go: () => { pick(x); render(); } })) });
	}
	// pad mode, the key as things of another collection: its own dictionary (SPEC §11.4), as many kinds as the sequence's
	function keyDictChoice(flow) {
		const t = T(), ways = st.ways[flow], kc = keyColl(), dict = seedColl().dict, n = dict ? dict.things.length : flow === "read" ? st.read.n : st.plan.n;
		const formId = kc.form || otherForm(flow === "read" ? st.read.form : st.plan.form);
		const set = readySet(n, formId);
		const open = () => openDictFile(n, (things) => { if (changeKeyDict({ things, checked: false, way: "open" })) ways.keyDict = "open"; render(); },
			(msg) => { ways.keyError = msg; render(); });
		const pick = (x) => { if (changeKeyDict({ things: thingsOf(x, n), checked: x.id === "streets" && formId === "book", way: "ready" })) { ways.keyDict = "ready"; ways.keyError = ""; } };
		const chosen = ways.keyDict || (kc.dict ? kc.dict.way || "ready" : null);
		const naming = chosen === "name" && !(kc.dict && kc.dict.way === "name");
		return decide({ question: t.keyDictQ, options: dictOptions(n, formId, "key"), chosen,
			choose: (id) => { ways.keyError = ""; if (id === "ready") pick(set); else if (id === "name") ways.keyDict = "name"; else open(); },
			ready: naming || !!kc.dict, caption: () => ways.keyError || null,
			next: naming ? { go: () => editDict(nameDraft(ways, "keyNameDraft", "pad", n)), ready: true } : undefined,
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
		return decide({ question: T().keyWhoQ, intro: T().keyWhyChance, chosen: m.keyWho || null, choose,
			options: [{ id: "device", art: deviceArt(), ...c.device }, { id: "me", art: dieArt({ sides: 6, face: 3 }), ...c.me }] });
	}
	function keyToolSlide() {
		const t = T(), c = t.cards, m = st.make, key = m.key, k = Math.log2(st.dict.things.length);
		const form = st.plan.padAs === "string" && st.plan.padForm ? st.plan.padForm : st.plan.form;
		// a die gives b bits a throw (SPEC §10.2): the throws a piece takes, and whether some faces are thrown again
		const die = (sides) => {
			const { b, keep } = S.diceBits(sides), per = Math.ceil(k / b);
			return { id: "d" + sides, art: V.diceShape({ sides, size: 56 }), title: c.dieTitle(sides),
				pros: per === 1 ? [c.dieOne] : [], cons: [per > 1 ? c.dieMany(per) : null, keep < sides ? c.dieAgain : null].filter(Boolean) };
		};
		// a bag only of pieces you can hold
		const options = [st.plan.padAs === "string" && formOf(form).family !== "written" ? { id: "bag", art: bagArt(), ...c.bag } : null,
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
	// Cards: for each collection its pieces (what kinds, how many of each) and
	// its assembly (what holds them), each with a tick, then what is only
	// recommended. A key of the same collection is one group with more of each.
	function gatherPlan() {
		const p = st.plan, n = st.dict ? st.dict.things.length : p.n, L = symbolsFor(p.words, n);
		// an address book's conventional order needs no dictionary of pieces (SPEC §11.3)
		const dictPieces = (id) => id === "book" && n === 8 ? 0 : 1;
		// an assembly card: the form has materials to tell, and is not written
		const assemblyOf = (id) => formOf(id).family !== "written" && !!materialsOf(id, L, n);
		const made = J.pieces({ words: p.words, n, mode: st.mode, padAs: p.padAs, form: p.form, padForm: p.padForm }, dictPieces, assemblyOf);
		return { n, L, ...made, groups: made.groups.map((g) => ({ ...g, written: formOf(g.form).family === "written" })) };
	}
	const gatherOk = () => { const { groups } = gatherPlan(); return J.gatherDone(st.gathered, groups); };
	// the small drawings of the gather cards
	const gatherArt = (kind) => {
		const line = (tag, attrs) => svg(tag, { class: "gather-line", ...attrs });
		const parts = {
			cord: () => [svg("path", { class: "gather-line", d: "M6 20 Q24 4 42 20" }), svg("circle", { class: "gather-solid", cx: 6, cy: 20, r: 2.6 }), svg("circle", { class: "gather-solid", cx: 42, cy: 20, r: 2.6 })],
			book: () => [line("rect", { x: 9, y: 4, width: 30, height: 20, rx: 2 }), line("path", { d: "M24 4 V24" })],
			brick: () => [line("rect", { x: 8, y: 11, width: 32, height: 13, rx: 1.5 }), line("rect", { x: 13, y: 6, width: 7, height: 5 }), line("rect", { x: 28, y: 6, width: 7, height: 5 })],
			bag: () => [line("path", { d: "M13 10 Q24 6 35 10 L39 24 Q24 27 9 24 Z" }), line("path", { d: "M18 9 Q24 1 30 9" })],
			box: () => [line("rect", { x: 4, y: 6, width: 40, height: 18, rx: 2 }), ...[16, 28].map((x) => line("path", { d: `M${x} 6 V24` })), line("path", { d: "M4 15 H44" })],
			tweezers: () => [line("path", { d: "M8 23 L40 7" }), line("path", { d: "M8 23 L40 13" })],
			needle: () => [line("path", { d: "M6 23 L42 6" }), line("ellipse", { cx: 40.5, cy: 6.8, rx: 1, ry: 2.2, transform: "rotate(65 40.5 6.8)" })],
			envelope: () => [line("rect", { x: 8, y: 5, width: 32, height: 20, rx: 2 }), line("path", { d: "M8 6 L24 17 L40 6" })],
			photo: () => [line("rect", { x: 9, y: 4, width: 30, height: 21, rx: 1.5 }), line("circle", { cx: 18, cy: 11, r: 2.4 }), line("path", { d: "M10 24 L22 14 L29 20 L33 16 L38 22" })],
			corner: () => [line("rect", { x: 9, y: 4, width: 30, height: 21, rx: 1.5 }), line("path", { d: "M9 11 V4 H16" }), line("path", { d: "M39 18 V25 H32" })],
			pen: () => [line("path", { d: "M7 24 L38 6 L42 10 L12 26 Z" }), line("path", { d: "M33 9 L38 14" })],
			glue: () => [line("rect", { x: 16, y: 10, width: 16, height: 16, rx: 2 }), line("path", { d: "M20 10 V5 H28 V10" }), line("path", { d: "M24 5 V2" })],
		};
		return svg("svg", { class: "gather-art", viewBox: "0 0 48 28", "aria-hidden": "true" }, ...parts[kind]());
	};
	// the kinds as dots, in the colour of the piece when it has one
	const kindDots = (things, key) => {
		const n = things.length, cols = Math.min(n, 16), rows = Math.ceil(n / cols), step = Math.min(120 / cols, 28 / rows), r = step / 2 * 0.8;
		return svg("svg", { class: "gather-dots" + (key ? " key" : ""), viewBox: "0 0 120 28", "aria-hidden": "true" },
			...things.map((x, i) => svg("circle", { class: "gather-dot", cx: 60 - cols * step / 2 + (i % cols + 0.5) * step, cy: 14 - rows * step / 2 + (Math.floor(i / cols) + 0.5) * step, r, fill: x.colour || undefined })));
	};
	const formArt = (id) => ({ necklace: "cord", gems: "cord", book: "book", stickers: "book", photos: "book", bricks: "brick" })[id] || "bag";
	function piecesSlide() {
		const t = T(), { n, L, groups, keyFile } = gatherPlan(), done = J.gatherDone(st.gathered, groups);
		const tick = (what, label) => h("label", { class: "gather-tick" }, h("input", { type: "checkbox", checked: st.gathered[what] ? "" : null,
			on: { change: (e) => { st.gathered[what] = e.target.checked; render(); } } }), h("span", { text: label || t.piecesHave }));
		const card = (cls, ...kids) => h("section", { class: "gather-card " + cls }, ...kids);
		// one card per group: the pieces, then (if it has one) the assembly under a thin rule, both ticks at the bottom
		const groupCard = ({ group: g, assembly, kind }) => {
			if (kind === "sameAsString") return card("pieces-card key", kindDots(kindThings(g.form, n, st.dict && st.dict.things), true),
				h("h2", {}, h("span", { class: "pieces-icon", "aria-hidden": "true" }, V.iconTag("key")), h("span", { text: t.piecesFor.key }), h("small", { text: t.forms[g.form].name })),
				h("p", { class: "gather-note", text: t.gatherSameAsString }));
			const written = formOf(g.form).family === "written", key = g.kinds[0] === "key", own = key ? st.padDict : st.dict, each = g.each + g.copies;
			const other = key && g.what === "key";
			const mat = assembly ? materialsOf(g.form, L, n) : null, { big, text } = mat ? J.splitMaterials(mat) : {};
			return card("pieces-card" + (key ? " key" : ""),
				kindDots(kindThings(g.form, n, own && own.things), key),
				h("h2", {}, h("span", { class: "pieces-icon", "aria-hidden": "true" }, (g.what === "both" ? ["seed"] : g.kinds).map((x) => V.iconTag(x))),
					// a shared collection: this card is the string's, the key has its own card beside it
					h("span", { text: other ? t.gatherKeyPieces : t.piecesFor[g.what === "both" ? "seq" : g.what] }), h("small", { text: t.forms[g.form].name })),
				written ? h("p", { class: "gather-note", text: t.gatherNoPieces }) : h("div", { class: "gather-body" },
					h("div", { class: "gather-nums" },
						h("p", {}, h("b", { text: String(n) }), h("span", { text: t.gatherKinds })), h("p", {}, h("b", { text: String(each) }), h("span", { text: t.gatherEach }), h("small", { class: "gather-estimate", text: t.gatherEstimate }))),
					h("p", { class: "gather-total", text: t.gatherTotalLine(n * each, g.what) }),
					h("p", { class: "gather-later", text: t.gatherLater })),
				mat ? h("div", { class: "gather-assembly" },
					h("div", { class: "gather-assembly-head" }, gatherArt(formArt(g.form)), h("h3", {}, t.gatherAssembly)),
					big ? h("p", { class: "gather-big" }, h("b", { text: big })) : null,
					h("p", { class: "gather-note", text: g.what === "both" ? t.piecesTwice(text) : text })) : null,
				h("div", { class: "gather-ticks" }, ...(written || !assembly ? [written ? null : tick(g.what)] : [tick(g.what, t.piecesHavePieces), tick("assembly:" + g.what, t.piecesHaveAssembly)])));
		};
		const item = (kind, text, tag) => h("li", {}, gatherArt(kind), h("span", { text }), tag ? h("small", { text: tag }) : null);
		const tips = J.gatherTips(groups.map((g) => g.form)), recommended = tips.length || groups.some((g) => !g.written)
			? card("recommended-card", h("h2", {}, h("span", { text: t.gatherRecommended })),
				tips.length ? h("ul", {}, ...tips.map((x) => item(x.art, typeof t.gatherTip[x.text] === "function" ? t.gatherTip[x.text](n) : t.gatherTip[x.text], x.optional ? t.gatherOptional : null)))
					: h("p", { class: "gather-note", text: t.gatherTip.nothing })) : null;
		const cards = J.gatherCards(groups).map(groupCard);
		const cols = cards.length + (recommended ? 1 : 0);
		return { question: t.piecesQ, ready: done, caption: () => done ? null : t.gatherWait,
			body: () => h("div", { class: "pieces" }, h("div", { class: "gather-grid cols-" + cols }, ...cards, recommended),
				keyFile ? h("p", { class: "pieces-file" }, h("span", { class: "pieces-icon", "aria-hidden": "true" }, V.iconTag("key")), t.gatherFile) : null) };
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
			// colliding automatic initials get three letters (the note is for the caller)
			const auto = autoInitials(things);
			things.forEach((x, i) => { if (x.emoji && x.emoji === initialsOf(x.name) && auto[i] !== x.emoji) { x.emoji = auto[i]; things.fixedInitials = true; } });
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
	// (set(d, reset): another dictionary, once asked, and what was read with the
	// old one goes; making one, the copy is read back and stored again)
	const keyColl = () => st.screen === "read"
		? { form: st.read.padForm, dict: st.read.padDict, set: (d, reset) => { st.read.padDict = d; if (reset) forgetKeyRead(st.read); } }
		: { form: st.plan.padForm, dict: st.padDict, set: (d) => { st.padDict = d; Object.assign(st.make, { check: null, checked: false, storedAt: {} }); } };
	// what was read of the key goes (and, file: the key file given); the sequence's
	// pieces read stay, and with key pieces gone the turns start again
	const forgetKeyRead = (rd, file) => {
		if (rd.keyTaps.length) rd.turn = 0;
		Object.assign(rd, { keyTaps: [], keyText: "", out: null, error: "", sig: "" }, file ? { keyFile: null, fileText: "" } : {});
	};

	// ---- your own dictionary: as it is, named and checked a slide per piece ----------
	// The same little box everywhere (vocab.js's dictionary, 🌱 or the key), on the
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
	const editable = (things) => { const auto = autoInitials(things); return things.map((x, i) => ({ ...x, symbolTyped: !!x.emoji && x.emoji !== initialsOf(x.name) && x.emoji !== auto[i] })); };
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
			if (!(target === "pad" ? changeKeyDict(null) : changeDict(null))) return;
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
				canvas(V.dictionary({ label: T().dictLabel, box: b.dict, things: d.things, mode: "static", icon: iconOf(target), columns: lay.columns })), status, actions),
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
			dict.replaceChildren(V.dictionary({ label: T().dictLabel, box: b.dict, things: ed.things, mode: "static", value: ed.i, icon }));
			piece.replaceChildren(V.piece({ box: b.piece, thing: x }));
		};
		draw();
		const err = h("p", { class: "dict-err", role: "alert" }), note = h("p", { class: "hint dict-note", role: "status" });
		// the automatic initials of the whole dictionary; true when one of another piece changed or this one got three letters
		const uniqueAll = () => {
			const auto = autoInitials(ed.things); let changed = false;
			ed.things.forEach((y, j) => {
				if (y.symbolTyped || y.symbol || !(y.name || "").trim() || y.emoji === auto[j]) return;
				if (auto[j] !== initialsOf(y.name)) changed = true;
				y.emoji = auto[j];
			});
			return changed;
		};
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
				if (uniqueAll() && !ed.dupNoted) { ed.dupNoted = true; note.textContent = T().dupInitials; }
				draw(); Slides.setReady(!tell());
			}, keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); forward(); } } } });
		nameIn.value = x.name;
		const takePhoto = () => pickFile("image/*", async (f) => {
			try { const crop = await cropPopup(f); if (crop) { x.photo = await photoOf(f, crop); render(); } } catch (z) { err.textContent = t.errPhoto; }
		}, "environment");
		const dot = h("span", { class: "dict-dot" + (x.colour ? "" : " none"), "aria-hidden": "true" });
		if (x.colour) dot.style.setProperty("--c", x.colour);
		setTimeout(() => { if (document.activeElement !== nameIn && !document.querySelector(".slide-popup")) nameIn.focus(); }, 0);
		return {
			question: t.nameQ(ed.i),
			help: helpOf(t.dictName, t.nameHelp, [t.nameTipPiece, t.nameTipOrder, ...t.dictChecks]),
			shortcuts: [{ icon: "Aa", label: t.thingSymbol, go: () => symbolPopup(x) }],
			prev: { go: () => { if (ed.i > 0) { ed.i--; render(); } else editDict(null); } },
			next: { label: ed.i < n - 1 ? undefined : "✓ " + t.dictDone, go: forward, ready: !problem() },
			body: () => h("div", { class: "dict-slide" },
				canvas(dict, V.number({ box: b.number, value: ed.i, colour: icon }), V.bits({ box: b.bits, bits: Lay.binary(ed.i, n), colour: icon }), piece),
				place(h("div", { class: "dict-form" }, nameIn,
					h("div", { class: "dict-buttons" },
						h("button", { type: "button", class: "btn ghost", on: { click: () => colourPopup(x) } }, dot, t.pieceColour),
						h("button", { type: "button", class: "btn ghost", title: t.photoTake, on: { click: takePhoto } }, x.photo ? t.photoAgain : t.piecePhoto),
						x.photo ? h("button", { type: "button", class: "btn ghost", title: t.photoRemove, "aria-label": t.photoRemove, on: { click: () => { x.photo = ""; render(); } } }, "✕") : null,
						// editing a dictionary already there: saved from any piece, no need to page to the end
						ed.base && ed.i < n - 1 ? h("button", { type: "button", class: "btn", on: { click: () => { if (!problem()) finish(); } } }, "✓ " + t.dictSaveNames) : null),
					err, note), b.form),
				// the first piece: what the form is for, and what the order is (bubbles beside the form and the box)
				...(ed.i === 0 ? [place(h("p", { class: "tip right", text: t.nameTipPiece }), b.tipPiece), place(h("p", { class: "tip left", text: t.nameTipOrder }), b.tipOrder)] : [])),
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
				canvas(V.dictionary({ label: T().dictLabel, box: b.dict, things: shown, mode: "static", value: right ? v : null, icon }), V.piece({ box: b.piece, thing: x })),
				place(h("div", { class: "dict-answer" }, numbers, wrong), b.answers)),
		};
	}

	// ---- make --------------------------------------------------------

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
			m.symbols = S.encrypt(m.basic, m.pad, n); m.checked = false; m.check = null; m.storedAt = {};
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
		throwFrom = Math.abs(st.make.key.pos - key.pos) === 1 ? key.pos : null;
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
	// (a ring round its number) and joined to its bits, those thrown again aside, dimmed, with ↻;
	// then brace → the number → the key's dictionary turning to it → the piece
	// → its slot in the key string at the bottom. A key file: the number goes
	// to its place in the file, growing at the bottom. The bag: the dictionary
	// as buttons. The device: one die that rolls and stops on the number. Only
	// the current arrow shows whole. Moving never throws again: a piece drawn
	// is shown as it was drawn, and a piece half thrown keeps its throws.
	let keyRolling = false;  // the device's die rolling: nothing else moves until it stops
	let keyFresh = null;     // the position of a piece just completed: it is shown arriving, once
	let keyFocus = null;     // the face tapped from the keyboard, focused again once redrawn
	let throwFrom = null;    // the piece left with an adjacent Next or Back: the key string glides in from it
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
		let from = throwFrom !== null && Math.abs(pos - throwFrom) === 1 && asString && !calm() ? throwFrom : null;
		throwFrom = null;
		let glides = null, hold = null, arrowsOn = true;
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
					V.badge(u.at + 1, u.badge.x + u.badge.w / 2, u.badge.y + u.badge.h / 2, Lay.BADGE, "kt-order"))));
				// those thrown again: dimmed, each its badge and ↻ under it, side by side
				marks.rejected.forEach((r) => {
					const cy = r.badge.y + r.badge.h / 2, bw = V.badgeSize(r.at + 1, Lay.BADGE).w, sw = 0.7 * Lay.BADGE;
					const x0 = r.badge.x + (r.badge.w - bw - 2 - sw) / 2;
					kids.push(svg("g", { class: "kt-again" }, faceOf(throws[r.at], r.face, "kt-small"),
						V.badge(r.at + 1, x0 + bw / 2, cy, Lay.BADGE, "kt-order"),
						svg("text", { x: x0 + bw + 2 + sw / 2, y: cy + Lay.BADGE * 0.36, "font-size": Lay.BADGE, "text-anchor": "middle", class: "v-t kt-reroll" }, "↻"),
						svg("title", {}, t.keyNoCount)));
				});
				// (a d10's faces are already numbered from 0)
				if (sides !== 10) kids.push(svg("g", { class: "kt-info" }, V.icon("info", b.info.x + 6, b.info.y + b.info.h / 2, 12),
					svg("text", { x: b.info.x + 15, y: b.info.y + 10, "font-size": 9, class: "v-t" }, coin ? t.keyCoinBits : t.keyFirstZero)));
			}
			// the bag: the key's dictionary as buttons
			if (b.picker) {
				const pk = V.dictionary({ label: T().dictLabel, box: b.picker, things, mode: "picker", value, icon: "key", onPick: pick });
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
					const reel = V.dictionary({ label: T().dictLabel, box: b.keyDict, things, mode: "reel", value: shown("dict") ? value : null, icon: "key", from: turning ? 0 : undefined });
					groups.dict.replaceChildren(svg("g", { class: shown("dict") ? null : "kt-wait" }, reel));
				}
				if (b.piece) groups.piece.replaceChildren(V.piece({ box: b.piece, thing: shown("piece") ? things[value] : null }));
				groups.slot.replaceChildren(asString ? keyString(shown("slot")) : keyFile(shown("slot")));
				drawArrows(p);
			};
			// (only the arrows again once a glide has stopped: the string that glided is not replaced)
			const drawArrows = (p) => arrows.forEach(({ a, g }) => g.replaceChildren(V.arrow({ points: a.points, colour: "key",
				state: !piece || !arrowsOn ? "hidden" : at(a.id) === p - 1 ? "current" : at(a.id) < p - 1 ? "past" : "hidden" })));
			if (fresh) {
				// it arrives: the number, the dictionary turning to it, the piece, its slot
				stage(1);
				const live = () => groups.slot.isConnected !== false;
				const steps = stages.slice(1).map((id, i) => [id, 450 * (i + 1) + (at("dict") >= 0 && at(id) > at("dict") ? 450 : 0)]);
				steps.forEach(([id, ms]) => setTimeout(() => { if (live()) stage(at(id) + 1, id === "dict"); }, ms));
			} else if (from !== null) hold = afterGlide((on) => { arrowsOn = on; if (on) drawArrows(stages.length); else stage(stages.length); });
			else stage(stages.length);
			// an adjacent Next or Back: the key string starts a piece over and glides to its place
			// (its arrows only once it has stopped)
			if (from !== null) glides = glideIn(from, (f) => [V.glide(runOf(groups.slot), { dx: (pos - f) * Lay.pitch(b.keyString, 13) })]);
			from = null;

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
			if (piece && !asString && have === L && pos === L - 1) tools.push(act([V.iconTag("save"), " " + t.padFileSave], saveFile, m.padKept ? "btn ghost small" : "btn small"));
			over.push(place(h("div", { class: "kt-tools" }, tools), b.tools));
			if (focus !== null && piece) Promise.resolve().then(() => { const nb = document.getElementById("slide-next"); if (nb) nb.focus(); });
			return h("div", { class: "dict-slide kt-slide" }, canvas(...kids), ...over);
		}

		// the key string being built: the piece's slot in the middle, six on each side
		function keyString(withPiece) {
			const item = (i) => {
				if (i < 0 || i >= L) return undefined;
				if (i === pos) return withPiece ? value : null;
				return i < have ? values[i] : null;
			};
			const items = Array.from({ length: 13 }, (_, j) => item(pos - 6 + j));
			return V.string({ box: b.keyString, role: "build", kind: "key", things, items, current: 6, firstPosition: pos - 5, posBox: b.posBox, spill: [item(pos - 7), item(pos + 7)] });
		}
		// the key file growing (writePadFile's format): the line before (its first line, «L N», or
		// the row before), then the row with this piece, its place framed under the slot, its check once the row is whole
		function keyFile(withPiece) {
			const ROW = S.PAD_ROW, r = Lay.fileRow(pos, { row: ROW, group: S.PAD_GROUP }), start = r.row * ROW, len = Math.min(ROW, L - start), box = b.keyString, slot = b.keySlot;
			const at = (i) => i === pos ? (withPiece ? value : null) : i < have ? values[i] : null;
			const row = Array.from({ length: len }, (_, j) => at(start + j));
			const whole = row.every((v) => v !== null);
			const lineOf = (vals) => S.writePadFile(vals, n).trimEnd().split("\n");
			const parts = [V.icon("key", box.x + 8, box.y + 43, 14)];
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
		if (have === L) shortcuts.push(asString ? { icon: V.iconTag("save"), label: t.saveList, go: saveList } : { icon: V.iconTag("save"), label: t.padFileSave, go: saveFile });
		const why = tool === "bag" ? [t.keyBagPutBack] : tool === "device" ? [] : coin ? [t.keyCoinBits]
			: [sides === 10 ? null : t.keyFirstZero, t.keyRerollWhy, t.keyPartUsed(k)].filter(Boolean);
		return {
			question: t.keyThrowQ, count: `${pos + 1}/${L}`, caption: () => caption, shortcuts,
			help: helpOf(stepName("make", "key"), t.keyWhy, asString ? why : [...why, t.padFileHelp]),
			prev: pos > 0 ? { go: () => keyGo(pos - 1) } : undefined, next, body,
			// Next while the key string glides: first its end, then on
			hurry: () => { const playing = !!glides && glides.playing; if (glides) glides.finish(); return (!!hold && hold.finish()) || playing; },
		};
	}

	// ---- make, 5: the sequence ----------------------------------------------
	// another seed: its words go, and in pad mode the key too: it starts again from the key (one key, one seed: SPEC §10.8)
	function otherSeed() {
		const m = st.make;
		m.seed = ""; m.symbols = m.entropy = m.basic = m.check = m.keyChanged = null;
		m.checked = false; m.storedAt = {}; m.turn = 0; m.explain = null;
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
			m.turn = 0; m.explain = null; turnFresh = null; turnFrom = null;
			m.checked = false; m.storedAt = {}; m.check = null; m.keyChanged = null;
		};
		const tool = made
			? h("button", { type: "button", class: "btn ghost small", on: { click: () => { if (confirm(t.otherSeedAsk(st.mode))) otherSeed(); } } }, "◀ " + t.otherSeed)
			: h("button", { type: "button", class: "btn ghost small", on: { click: () => test(st.plan.words === 12 ? 16 : 32) } }, st.plan.words === 12 ? t.seedTest12 : t.seedTest24);
		return {
			question: t.seedQ(st.plan.words),
			next: made ? undefined : { label: t.makeIt + " ▶", go: () => { make(); if (m.symbols) goSlide("make", "qr"); }, ready: ok },
			caption: () => made ? (padMode ? t.whyPad : t.makeWarn) : padMode ? t.seqPadIntro : t.seqIntro,
			body: () => h("div", { class: "slide-form seed-form" }, h("p", { class: "seed-intro", text: t.seedIntro }), seedAlert(), area, status, print, h("div", { class: "row" }, tool)),
		};
	}

	// ---- «Your QR»: words → number → QR, before the first turn ------------------
	// The parts of the words → number → QR picture at a step (layouts.js's
	// seedQr): { kids: for the canvas, over: HTML placed on its boxes }. Step 0
	// the first thing, step 1 the arrow to the number and the number, step 2
	// the arrow on to the last thing. toWords: the other way round (QR, then
	// number, then words: recovering's end). reveal: the QR filling in; fade: the
	// number fading in (only when its step was just reached with Next).
	function seedQrParts(lay, { words, entropy, qr, step, toWords = false, reveal = null, fade = false, plain = false, fixedStep = undefined }) {
		const t = T(), b = lay.boxes, kids = [], over = [];
		const digits = S.groupDigits(S.entropyNumber(entropy), 5);
		const showWords = toWords ? step >= 2 : true, showNumber = step >= 1, showQr = toWords ? true : step >= 2;
		if (showWords) {
			over.push(place(h("div", { class: "qr-seed", "aria-hidden": "true" }, V.iconTag("seed")), { x: b.words.x, y: b.words.y - 22, w: 24, h: 20 }));
			over.push(place(h("ol", { class: "qr-words" + (words.length > 12 ? " many" : "") }, words.map((w) => h("li", { text: w }))), b.words));
		}
		if (showNumber) {
			const f = Lay.digitFont(b.number, 19, digits.length);   // the lines and the «bits» under them fit their box
			const num = place(h("div", { class: "qr-number" }, h("div", { class: "qr-digits" }, digits.map((x) => h("div", { text: x }))),
				h("div", { class: "qr-bits", text: t.qrBits(entropy.length * 8) })), b.number);
			num.style.fontSize = `calc(var(--u) * ${f})`;
			over.push(fade ? V.fadeIn(num) : num);
		}
		if (showQr) {
			kids.push(V.qr({ box: b.qr, size: qr.size, modules: (r, c) => qr.getModule(c, r), reveal, ...(plain ? {} : fixedStep === null ? { legendSpace: b.qr.h >= 150 } : { ...qrFixed(qr.size, b.qr), ...(fixedStep === "reveal" ? { fixedReveal: { ms: 800 } } : {}) }) }));
			over.push(place(h("div", { class: "qr-label" }, V.iconTag("seed"), " " + t.qrLabel(qr.size)), { x: b.qr.x, y: b.qr.y + b.qr.h + 2, w: b.qr.w, h: 16 }));
		}
		// the arrow of each step is the current one, the one before it past
		lay.arrows.forEach((a, j) => { if (step >= j + 1) kids.push(V.arrow({ points: a.points, colour: a.colour, state: step === j + 1 ? "current" : "past" })); });
		return { kids, over };
	}
	let qrBack = false;   // «Your QR» reached with Back from the first turn: opens at its last step, nothing replays
	let qrSeen = 0;   // the step «Your QR» was last drawn at: the QR fills in only when a step grew
	function qrSlide() {
		const t = T(), m = st.make, words = S.entropyToMnemonic(m.entropy).split(" "), qr = S.compactSeedQR(m.entropy), lay = Lay.seedQr({});
		const back = qrBack;
		qrBack = false;
		if (back) qrSeen = 3;
		return {
			id: "qr", question: t.qrQ, wide: true, steps: 4, startStep: back ? 3 : 0, caption: (s) => [t.qrStepWords, t.qrStepNumber, t.qrStepQr, t.qrStepFixed][s],
			help: helpOf(t.qrQ, null, [t.qrHelp]),
			next: { go: () => goSlide("make", "seqIntro") },
			body: (at) => {
				const step = Math.min(at, 2), amber = at === 3;   // the last step draws the QR again, now with its fixed part
				const grew = at > qrSeen && !calm();
				const grewFrom = qrSeen;
				qrSeen = at;
				const reveal = step === 2 && grew && at === 2 ? { order: S.dataModulesRowMajor(qr.size), ms: 1000 } : null;
				const parts = seedQrParts(lay, { words, entropy: m.entropy, qr, step, reveal, fade: step === 1 && grew, fixedStep: amber ? (grew && grewFrom === 2 ? "reveal" : "shown") : null });
				// with the QR, under its label: what kind of QR it is, who reads it (links that open apart)
				const note = step === 2 ? [place(h("p", { class: "qr-compact" }, ...compactNote()), { x: lay.boxes.qr.x, y: lay.boxes.qr.y + lay.boxes.qr.h + 20, w: lay.boxes.qr.w, h: 30 })] : [];
				return h("div", { class: "dict-slide" }, canvas(...parts.kids), ...parts.over, ...note);
			},
		};
	}
	// «It's a CompactSeedQR: SeedSigner or NDS-Signer can read it.», each reader a link, and the standard after it
	function compactNote() {
		const t = T(), urls = { SeedSigner: "https://github.com/SeedSigner/seedsigner", "NDS-Signer": "https://github.com/ndssigner/nds-signer" };
		const parts = t.qrCompact.split(/(SeedSigner|NDS-Signer)/).map((x) => urls[x] ? link(urls[x], x) : x);
		return [...parts, " (", link("https://github.com/SeedSigner/seedsigner/blob/dev/docs/seed_qr/README.md", t.qrStandard), ")"];
	}

	// a bubble beside a drawing (the intros before the turns and before checking)
	const tip = (cls, text, box) => place(h("p", { class: "tip " + cls, text }), box);

	// ---- before the first turn: the QR, the string to build, the count ------------
	// layouts.js's seqIntro: the QR (this turn's squares marked), the string empty
	// (position 1 waiting), each with its bubble; the exact count of pieces of each
	// kind (the string's, and the dictionary's: as «Gather this» counted them) beside
	// the estimate; with a key, its string (or file) and its bubble. Next: turn 1.
	function seqIntroSlide() {
		const t = T(), m = st.make, things = st.dict.things, n = things.length, k = Math.log2(n), pad = st.mode === "pad";
		const file = pad && st.plan.padAs === "file", keyThings = keyThingsMade(), L = m.symbols.length;
		const qr = S.compactSeedQR(m.entropy), size = qr.size, lay = Lay.seqIntro({ pad }), b = lay.boxes;
		const turnCells = S.turnBits(size, 0, k).filter((x) => x.cell).map((x) => x.cell);
		// the seed's collection as «Gather this» showed it (with a key in it, both strings)
		const g = gatherPlan().groups[0], shared = g.what === "both";
		const most = J.maxPerKind(m.symbols, ...(shared ? [m.pad] : [])) + g.copies, est = g.each + g.copies;
		const kids = [
			V.qr({ box: b.qr, size, modules: (r, c) => qr.getModule(c, r), turnCells, markerLabel: t.qrPosition(1), ...qrFixed(size, b.qr) }),
			V.string({ box: b.string, role: "build", kind: "seed", things, current: 6, firstPosition: -5, posBox: b.posBox,
				items: Array.from({ length: 13 }, (_, j) => j < 6 || j - 6 >= L ? undefined : null) }),
			...lay.arrows.map((a) => V.arrow({ points: a.points, colour: a.colour, state: "current" })),
		];
		if (pad) kids.push(file ? keyFileReference(b.keyString, m.pad, 0, L)
			: V.string({ box: b.keyString, orientation: "v", role: "reference", kind: "key", things: keyThings,
				items: Array.from({ length: 7 }, (_, j) => j < 3 || j - 3 >= L ? undefined : m.pad[j - 3]), current: 3, firstPosition: -2 }));
		// a key in a collection of its own: its exact count too, from its group as the seed's from its own
		const kg = pad && !file && !shared ? gatherPlan().groups[1] : null, keyLine = kg && !kg.written ? t.seqCountKey(J.maxPerKind(m.pad) + kg.copies, kg.each + kg.copies) : null;
		const count = g.written ? [] : [place(h("div", { class: "seq-count" }, h("div", { class: "seq-row" }, h("b", { text: String(most) }), h("p", { text: t.seqCount(most, est) })),
			...(keyLine ? [h("p", { class: "seq-key", text: keyLine })] : [])), b.count)];
		return {
			question: t.seqIntroQ, wide: true, caption: () => t.seqIntroFoot,
			// Back: «Your QR» at its last step, nothing replays
			prev: { go: () => { qrBack = true; goSlide("make", "qr"); } },
			next: { go: () => { m.turn = 0; m.explain = null; turnFresh = null; turnBack = false; turnFrom = null; goSlide("make", "seq"); } },
			body: () => h("div", { class: "dict-slide" }, canvas(...kids), ...count,
				tip("left", t.seqTipQr, b.qrTip), tip("down", t.seqTipString, b.stringTip), ...(pad ? [tip("left", t.seqTipKey, b.keyTip)] : [])),
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
	let turnFrom = null;    // the turn left with an adjacent Next or Back: the new one glides in from it
	// A turn's cycle played on arriving: a stage every STAGE_MS, the clock's
	// run (vocab.js: RUN_MS at most) and STAGE_MS after it, so a whole turn
	// lasts about 4 s, whatever N. draw(p, turning, onRun, alive):
	// the slide at stage p; alive: whether this play still counts (render()
	// moves turnRun on: a play from an earlier drawing stops). finish(): its
	// end at once (Next while it plays); false when there was nothing playing.
	// delay: the advance between turns plays first: stage −1 (all as before the cycle, its
	// arrows hidden) at once, the first stage only after delay.
	const STAGE_MS = 400;
	function playCycle(stages, first, draw, delay = 0) {
		const run = turnRun, last = stages.length - 1;
		let playing = true;
		const alive = () => playing && run === turnRun;
		const later = (fn, ms) => setTimeout(() => { if (alive()) fn(); }, ms);
		const play = (p, wait = 0) => {
			const out = stages[p].id === "out";
			draw(p, true, out ? () => later(() => play(p + 1), STAGE_MS + wait) : undefined, alive);
			if (p >= last) playing = false;
			else if (!out) later(() => play(p + 1), STAGE_MS + wait);
		};
		if (delay > 0) { draw(-1, false); later(() => play(first), delay); } else play(first);
		return { finish: () => { if (!alive()) return false; playing = false; draw(last, false); return true; } };
	}
	// An arrival that glides and plays no cycle: show(false) at once (its arrows hidden), show(true)
	// once the advance has stopped (V.ADVANCE_MS), unless another drawing has come since (render, or
	// cancel() from a body drawn again). finish() (Next while it waits): show(true) at once.
	function afterGlide(show) {
		const run = turnRun;
		let over = false;
		show(false);
		const self = {
			playing: true,
			cancel() { over = true; self.playing = false; },
			finish() { if (over) return false; self.cancel(); if (run === turnRun) show(true); return true; },
		};
		setTimeout(() => { if (!over && run === turnRun) self.finish(); else self.cancel(); }, V.ADVANCE_MS);
		return self;
	}
	// a string's run (its beads and thread, the part that glides; its icon stays put)
	const runOf = (g) => (g && g.querySelector && g.querySelector(".v-string-run")) || null;
	// The advance between two drawings: start(from) makes the glides once the body is on
	// the page (just after body() returns), unless another drawing has come since.
	// playing: until ADVANCE_MS have gone by or finish() (Next while it plays) settles them.
	function glideIn(from, start) {
		const run = turnRun;
		let list = null, over = false;
		const self = {
			playing: true,
			finish() { over = true; self.playing = false; if (list) list.forEach((g) => g.finish()); },
		};
		Promise.resolve().then(() => {
			if (over || run !== turnRun) { self.playing = false; return; }
			list = start(from);
			setTimeout(() => { self.playing = false; }, V.ADVANCE_MS);
		});
		return self;
	}
	// to another turn of the sequence; a turn explained is explained only while it is on screen
	// still: shown as it ends, never played (a jump, not Next)
	function turnGo(to, still = false) {
		const m = st.make, from = m.turn || 0;
		m.turn = Math.max(0, Math.min(m.symbols.length - 1, to));
		turnFresh = !still && m.turn === from + 1 ? m.turn : null;
		turnBack = m.turn === from - 1;
		turnFrom = !still && Math.abs(m.turn - from) === 1 ? from : null;
		m.explain = null;
		render();
	}
	// «?» or «⋯ › Explain this turn»: this turn again, a relation at a time, from its first step
	function explainTurn() {
		const m = st.make;
		m.explain = { turn: m.turn || 0, run: (m.explain ? m.explain.run : 0) + 1 };
		turnFresh = null; turnBack = false; turnFrom = null;
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
	// A last turn's cards (layouts.js's header boxes, spec §8, §6): each part's bits from the turns up to
	// this one (turn i; values: every bit of the sequence, null where it is not known: J.headerBitsUpTo),
	// this turn's ringed and the others dimmed, «·» for those still to come. The mask's value once its 3 bits
	// are there; the padding's die once all of it is.
	function headerCardsOf(b, parts, size, k, i, values) {
		const t = T(), nmod = S.dataModulesRowMajor(size).length, of = J.headerBitsUpTo(parts, i, k, nmod, values);
		const whole = (p) => of[p].bits.every((x) => x !== null), num = (p) => parseInt(of[p].bits.join("") || "0", 2);
		const extra = {
			version: { title: t.hdrVersion, note: t.hdrVersionNote },
			mask: { title: t.hdrMask, note: t.hdrMaskFoot, value: parts.includes("mask") && whole("mask") ? num("mask") : null },
			padding: { title: t.hdrPadding, note: t.hdrPaddingNote, face: parts.includes("padding") && whole("padding") ? num("padding") % 6 : null },
		};
		return parts.map((p) => V.headerCard({ box: b["card" + p[0].toUpperCase() + p.slice(1)], kind: p, bits: of[p].bits, now: of[p].now, ...extra[p] }));
	}
	// The one-time bubble on why the mask is what it is (spec §6), beside a last turn's mask card: on the
	// first turn of the run that brings it, until it is closed or that turn is left (st.seen.maskWhy)
	let maskTipTurn = null;
	function maskTip(lay, header, i) {
		if (maskTipTurn !== null && maskTipTurn !== i) st.seen.maskWhy = true;
		if (st.seen.maskWhy || !header || !lay.maskTip) return [];
		maskTipTurn = i;
		const el = place(h("div", { class: "tip mask-tip " + lay.maskTip.dir }, h("span", { text: T().hdrMaskWhy }),
			h("button", { class: "tip-close", type: "button", "aria-label": T().slidesClose, text: "×", on: { click: () => { st.seen.maskWhy = true; el.remove(); } } })), lay.maskTip.box);
		el.style.setProperty("--at", `calc(var(--u) * ${lay.maskTip.at})`);
		return [el];
	}
	// the parts of a turn that are not squares (S.turnBits's), or false: none
	const headerOf = (turn) => { const parts = [...new Set(turn.map((x) => x.part).filter((p) => p !== "data"))]; return parts.length ? parts : false; };
	// the line under a turn that brings the mask (spec §4): what its three cells show and the mask itself
	// (m: S.maskSeen's or S.maskFrom's; null: not all known, no line)
	const maskLineOf = (m) => m ? T().hdrMaskSeen(m.seen.join(""), m.mask.join("")) : null;
	// the mask's «?»: why it is there, what its cells show, that its bits are not squares, where the 8 masks are;
	// explain: the button that explains the turn
	const maskHelp = (line, explain) => Slides.popup(h("div", { class: "slide-help" }, h("h2", { text: T().hdrMask }), h("p", { text: T().hdrMaskWhy }),
		line ? h("p", { text: line }) : null, h("p", { text: T().turnHeaderNoQr }), h("p", { text: T().hdrMaskCatalog }),
		h("button", { type: "button", class: "btn", text: T().hdrMaskExplain, on: { click: () => { Slides.closePopup(true); explain(); } } })), { label: T().hdrMask });
	// a file column's rows with one more beyond each end (j −1 and 7, a pitch on, under the fade): [row, j];
	// the place a run glided a row over brings in, or takes out, is drawn there (see V.string's spill)
	const spillRows = (col) => {
		const at = (j) => {
			const e = Math.max(0, Math.min(col.rows.length - 1, j)), d = (j - e) * col.pitch, r = col.rows[e];
			if (!d) return r;
			const o = {};
			for (const [k, v] of Object.entries(r)) o[k] = typeof v === "number" ? (k === "y" ? v + d : v) : Array.isArray(v) ? [v[0], v[1] + d] : v && typeof v === "object" ? { ...v, y: v.y + d } : v;
			return o;
		};
		return Array.from({ length: col.rows.length + 2 }, (_, j) => [at(j - 1), j - 1]);
	};
	// a key file reference's row j (place x): its place and its character
	const fileRefRow = (r, j, x, pad) => [svg("text", { x: r.pos[0], y: r.pos[1], "font-size": j === 3 ? 10 : 8, "text-anchor": "middle", class: "v-t v-pos" + (j === 3 ? " v-pos-current v-c-qr v-bold" : "") }, x + 1),
		svg("text", { x: r.digit[0], y: r.digit[1], "font-size": 14, "text-anchor": "middle", class: "v-t v-mono v-bold v-c-key" + (j === 3 ? "" : " tn-dim") }, S.PAD_DIGITS[pad[x]])];
	// the key file's characters around turn i (pad: the key's values), a column like the key string's: the turn's framed
	function keyFileReference(box, pad, i, L) {
		const col = Lay.fileColumn(box, { role: "reference" }), parts = [];
		spillRows(col).forEach(([r, j]) => {
			const x = i - 3 + j;
			if (x < 0 || x >= L) return;
			if (j < 0 || j > 6) { parts.push(svg("g", { class: "v-spill", "aria-hidden": "true" }, fileRefRow(r, j, x, pad))); return; }
			if (j === 3) parts.push(svg("rect", { x: r.frame.x, y: r.frame.y, width: r.frame.w, height: r.frame.h, rx: 3, class: "v-turn-frame" }));
			parts.push(...fileRefRow(r, j, x, pad));
		});
		// its icon apart: the run glides, the icon stays
		return svg("g", { class: "v v-file", role: "img", "aria-label": T().padFileTitle },
			[svg("g", { class: "v-string-icon" }, V.icon("key", col.icon[0], col.icon[1] - 4, 11)), ...V.fadeRun(box, col.pitch, parts, col.top)]);
	}
	function turnSlide() {
		const t = T(), m = st.make, things = st.dict.things, n = things.length, k = Math.log2(n), pad = st.mode === "pad";
		const file = pad && st.plan.padAs === "file", keyThings = keyThingsMade();
		const L = m.symbols.length, i = m.turn = Math.max(0, Math.min(L - 1, m.turn || 0)), pos = i + 1;
		const plain = pad ? m.basic : m.symbols, P = plain[i], C = m.symbols[i], K = pad ? m.pad[i] : null;
		const qr = S.compactSeedQR(m.entropy), size = qr.size;
		const bits = S.symbolsToBits(plain, k), turn = S.turnBits(size, i, k), roles = turn.map((x) => x.part);
		const turnCells = turn.filter((x) => x.cell).map((x) => x.cell), header = headerOf(turn), data = turnCells.length > 0;
		// a turn that brings the mask: the line on what its cells show; the cursor on them (S.turnCursor), unless the turn has squares too
		const withMask = !!header && header.includes("mask"), maskLine = withMask ? maskLineOf(S.maskSeen(qr)) : null, cur = S.turnCursor(size, turn);
		// a last turn (header): the cards its bits come from, beside a smaller QR
		const lay = Lay.makeTurn({ pad, n, file, header, data, size }), b = lay.boxes, stages = J.turnStages({ pad, file, header: !!header, data }), last = stages.length - 1;
		const explaining = i < J.EXPLAINED || !!(m.explain && m.explain.turn === i);
		const fresh = !explaining && turnFresh === i && !calm(), back = turnBack;
		// an adjacent Next or Back: the slide glides in from the turn left (once, on the first drawing)
		let from = turnFrom !== null && Math.abs(i - turnFrom) === 1 && !calm() ? turnFrom : null;
		turnFresh = null; turnBack = false; turnFrom = null;
		const changed = (m.keyChanged || []).includes(i);
		// the header (version and mask) and the padding have no squares in the QR code (a turn with the mask: where it is written instead)
		const note = header ? maskLine || t.turnHeaderNoQr : null;
		// the last turn, once whole: why it is made this way (with a key: why both strings are needed)
		const end = i === L - 1 ? (pad ? t.endPad : t.endBasic) : null;

		// the QR code, whole in every turn; this turn's squares in blue
		const modules = (r, c) => qr.getModule(c, r);
		const stageOf = (arrowId) => stages.findIndex((s) => s.arrows.includes(arrowId));
		const at = (id) => stages.findIndex((s) => s.id === id);

		// the slide as it is at stage p (0 … last); turning: the dictionaries reaching their row now turn to it
		const groups = {}, arrowGroups = lay.arrows.map(() => svg("g"));
		["qr", "cards", "bits", "number", "key", "keyDict", "keyNumber", "clock", "seedDict", "seedString"].forEach((g) => { groups[g] = svg("g"); });
		const wait = (el, on) => on ? el : svg("g", { class: "tn-wait" }, el);
		// the strings are drawn again only when they change (the key's never, the seed's when its slot
		// fills): a stage drawn while the advance plays does not replace the run that glides
		// (the QR, the same at every stage, drawn once: its cursor glides undisturbed);
		// arrowsOn false: every arrow hidden (an arrival that glides, until it has stopped)
		let keyDrawn = false, slotDrawn = null, qrDrawn = false, arrowsOn = true;
		function draw(p, turning, onRun, alive) {
			const reached = (id) => at(id) >= 0 && at(id) <= p;
			if (!qrDrawn) groups.qr.replaceChildren(V.qr({ box: b.qr, size, modules, turnCells, cursorCells: cur.cells, maskOutline: cur.outline, markerLabel: cur.mask ? T().qrMask : T().qrPosition(i + 1), ...qrFixed(size, b.qr) }));
			qrDrawn = true;
			// the cards, filled from their stage on (the mask is the QR's, written in its format band)
			if (header) groups.cards.replaceChildren(...headerCardsOf(b, header, size, k, i, bits.map((x, j) => Math.floor(j / k) === i && !reached("cards") ? null : x)));
			groups.bits.replaceChildren(V.bits({ box: b.bits, bits: turn.map((x) => reached("bits") ? bits[x.bit] : null), roles, colour: "qr" }));
			groups.number.replaceChildren(V.number({ box: b.number, value: reached("number") ? P : null, colour: "qr" }));
			if (pad) {
				if (!keyDrawn) groups.key.replaceChildren(file ? keyFileReference(b.keyString, m.pad, i, L) : V.string({ box: b.keyString, orientation: "v", role: "reference", kind: "key", things: keyThings,
					items: Array.from({ length: 7 }, (_, j) => { const x = i - 3 + j; return x < 0 || x >= L ? undefined : m.pad[x]; }), current: 3, firstPosition: i - 2,
					spill: [i - 4, i + 4].map((x) => x < 0 || x >= L ? undefined : m.pad[x]) }));
				keyDrawn = true;
				const keyAt = at(file ? "key" : "keyNumber");
				if (b.keyDict) groups.keyDict.replaceChildren(wait(V.dictionary({ label: T().dictLabel, box: b.keyDict, things: keyThings, mode: "reel", icon: "key",
					value: p >= keyAt ? K : null, from: turning && p === keyAt ? 0 : undefined }), reached("key")));
				groups.keyNumber.replaceChildren(V.number({ box: b.keyNumber, value: p >= keyAt ? K : null, colour: "key" }));
				const clockAt = at("clock");
				groups.clock.replaceChildren(p < clockAt ? svg("g") : V.clock({ box: b.clock, n, from: P, by: K, sign: 1, inputColour: "qr",
					phase: p === clockAt ? "inputs" : p === at("out") && turning ? "run" : "done", onDone: p === at("out") ? onRun : undefined, alive }));
			}
			groups.seedDict.replaceChildren(wait(V.dictionary({ label: T().dictLabel, box: b.seedDict, things, mode: "reel", icon: "seed",
				value: reached("dict") ? C : null, from: turning && p === at("dict") ? 0 : undefined }), reached("dict")));
			// your string: those before the turn in place, the slot (filled at the last stage), the rest to come
			if (slotDrawn !== reached("slot")) {
				slotDrawn = reached("slot");
				groups.seedString.replaceChildren(V.string({ box: b.seedString, role: "build", kind: "seed", things, current: 6, firstPosition: i - 5, posBox: b.posBox,
					items: Array.from({ length: 13 }, (_, j) => { const x = i - 6 + j; return x < 0 || x >= L ? undefined : x < i ? m.symbols[x] : x === i && slotDrawn ? C : null; }),
					spill: [i - 7, i + 7].map((x) => x < 0 || x >= L ? undefined : x < i ? m.symbols[x] : null) }));
			}
			lay.arrows.forEach((a, j) => {
				const s = stageOf(a.id);
				arrowGroups[j].replaceChildren(V.arrow({ points: a.points, colour: a.colour, state: p < 0 || !arrowsOn ? "hidden" : s === p ? "current" : s < p ? "past" : "hidden" }));
			});
		}

		// The advance from turn f (FLIP): each thing starts where it was in f's drawing and glides
		// to its place, the QR's marker from f's squares, the strings a piece (a row) over;
		// the bits and the number fade in. Its glides, while they play
		function advance(f) {
			const out = [], q = groups.qr.lastChild, marker = q && q.querySelector && q.querySelector(".v-qr-cursor");
			const was = Lay.qrCellsBox(b.qr, size, S.turnCursor(size, S.turnBits(size, f, k)).cells, { legend: b.qr.h >= 150 }), now = Lay.qrCellsBox(b.qr, size, S.turnCursor(size, turn).cells, { legend: b.qr.h >= 150 });
			if (was && now && marker) out.push(V.glide(marker, { dx: was.x - now.x, dy: was.y - now.y }));
			out.push(V.glide(runOf(groups.seedString), { dx: (i - f) * Lay.pitch(b.seedString, 13) }));
			if (pad) out.push(V.glide(runOf(groups.key), { dy: (i - f) * (file ? Lay.fileColumn(b.keyString, { role: "reference" }).pitch : Lay.pitch(b.keyString, 7, { vertical: true })) }));
			V.fadeIn(groups.bits); V.fadeIn(groups.number);
			return out;
		}
		let cycle = null, glides = null, hold = null;
		function body(step) {
			const kids = [groups.qr, groups.cards, groups.bits, groups.number, groups.key, groups.keyDict, groups.keyNumber, groups.clock, groups.seedDict, groups.seedString, ...arrowGroups];
			cycle = null;
			if (hold) { hold.cancel(); hold = null; }
			// a fade left from an advance does not replay on this redraw (the groups are re-inserted)
			if (from === null) [groups.bits, groups.number].forEach((g) => g.classList && g.classList.remove("v-fade-in"));
			// an arrival that glides with no cycle (an explained turn, or Back): its arrows once the string has stopped
			if (from !== null && !fresh) hold = afterGlide((on) => { arrowsOn = on; if (explaining) draw(step, on); else draw(last, false); arrowsOn = true; });
			else if (explaining) draw(step, true);
			// on arriving: the cycle plays, a relation at a time, the clock turning step by step
			// (stage 0 now, before the body is on the page; each later one only while nothing has been drawn since),
			// after the advance from the turn before
			else if (fresh) cycle = playCycle(stages, 0, draw, from !== null ? V.ADVANCE_MS : 0);
			else draw(last, false);
			if (from !== null) glides = glideIn(from, advance);
			from = null;
			return h("div", { class: "dict-slide tn-slide" }, canvas(...kids), ...maskTip(lay, header, i));
		}
		// Next while it plays: the advance's end, then the cycle's; true if either was playing
		const hurry = () => {
			const g = glides && glides.playing;
			if (glides) glides.finish();
			const h = !!hold && hold.finish();
			return (!!cycle && cycle.finish()) || h || !!g;
		};

		// the sentences: one per relation (the first turns, or «?»); else what this turn has to say
		const bitsText = turn.map((x) => bits[x.bit]).join("");
		const say = (id) => ({
			position: t.turnPosition(pos), cards: note, bits: note || t.turnBitsAre, number: t.turnNumber(bitsText, P),
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
			{ icon: V.iconTag("save"), label: t.saveList, go: () => download(m.symbols.map((s, j) => `${j + 1}. ${things[s].name}`).join("\n") + "\n", listName, "text/plain") },
			{ icon: "?", label: t.seqExplain, go: explainTurn },
			...keyChangedWays(),
			{ icon: "◀", label: t.otherSeed, go: () => { if (confirm(t.otherSeedAsk(st.mode))) otherSeed(); } },
		];
		return {
			count: `${pos}/${L}`, steps: explaining ? stages.length : 1, startStep: explaining && back ? last : 0, caption, shortcuts, body,
			help: withMask ? () => maskHelp(maskLine, explainTurn) : explainTurn,
			// Next while the advance or the cycle plays: first its end, then on
			hurry,
			prev: i > 0 ? { go: () => turnGo(i - 1) } : { go: () => goSlide("make", "seqIntro") },
			next: i < L - 1 ? { go: () => turnGo(i + 1) } : undefined,
		};
	}

	// ---- make, 6: read it back --------------------------------------------------
	// Before the first turn of checking (layouts.js's checkIntro): the string to
	// read, a column as the turns', empty (and the key's, as it will be read),
	// the QR blank, each with its bubble. Next: the first turn of checking.
	function checkIntroSlide() {
		const t = T(), m = st.make, things = st.dict.things, pad = st.mode === "pad", file = pad && st.plan.padAs === "file";
		const L = m.symbols.length, size = S.compactSeedQR(m.entropy).size, lay = Lay.checkIntro({ pad }), b = lay.boxes;
		const kids = [readColumn(b.column, "seed", things, [], 0, L, { column: lay.columns.seed }),
			V.qr({ box: b.qr, size, modules: (r, c) => S.templateModule(size, r, c), ...qrFixed(size, b.qr) })];
		if (pad) kids.push(file ? fileColumn(b.keyColumn, m.pad, 0, L) : readColumn(b.keyColumn, "key", keyThingsMade(), [], 0, L, { column: lay.columns.key }));
		return {
			question: t.checkIntroQ, wide: true,
			next: { go: () => { if (m.check) m.check.turn = 0; goSlide("make", "check"); } },
			body: () => h("div", { class: "dict-slide" }, canvas(...kids),
				tip("left", t.checkTipColumn, b.columnTip), tip("right", t.checkTipQr, b.qrTip), ...(pad ? [tip("left", t.checkTipKey, b.keyTip)] : [])),
		};
	}
	// The same turns as recovering (what will be done years from now), on a
	// reading of its own (m.check), read as it was made; a key file made here
	// is read as it is. Then the end: the QR code of your words beside the one
	// read, = or ≠.
	function checkTurns() {
		const m = st.make;
		if (!m.check) m.check = freshRead();
		Object.assign(m.check, { mode: st.mode, words: st.plan.words, padAs: st.plan.padAs, padForm: st.plan.padForm, padDict: st.padDict, form: st.plan.form });
		if (st.mode === "pad" && st.plan.padAs === "file") m.check.keyFile = m.pad;
		const rd = m.check, L = readLength(rd), pad = st.mode === "pad", done = () => { rd.turn = L; render(); };
		readOut(rd);
		// the copy reads back only while every piece read gives the seed made, exactly: a piece the
		// QR code's error correction had to put right is still wrong on the string. A piece that
		// differs only in its padding (random bits, with no square: SPEC §11) does not block.
		const diff = readFrontier(rd) >= L ? J.checkRead({ taps: rd.taps.slice(0, L), keys: pad ? readKey(rd).slice(0, L) : null, symbols: m.symbols,
			pad: pad ? m.pad : null, keyRead: pad && st.plan.padAs === "string" }) : null;
		const same = !!rd.out && [...rd.out.entropy].join() === [...m.entropy].join();
		m.checked = J.checkVerdict({ sameEntropy: same, fixed: !!(rd.out && rd.out.fixed), diff, ...plainsOf(m, diff) });
		if (m.checked) m.keyChanged = null;
		if (rd.typing) return readTypingSlide(rd, done);
		if (rd.turn >= L && diff) return checkEnd(rd, diff);
		return readTurnSlide(rd, { checking: true, done });
	}
	// the plain values to compare (with a key, each piece less its key's) and the bits that carry data
	// (the QR code's data squares and its header), for J.checkVerdict
	function plainsOf(m, diff) {
		const n = st.dict.things.length, pad = st.mode === "pad";
		if (!diff || !diff.wrong.length) return { k: Math.log2(n) };
		const plain = (seed, key) => seed.map((c, p) => pad ? S.clockStep(c, key[p], n, -1).value : c);
		return { readPlain: plain(diff.seed, diff.key), madePlain: plain(m.symbols, m.pad), k: Math.log2(n), nbits: S.dataModulesRowMajor(S.compactSeedQR(m.entropy).size).length + 5 };
	}
	// what was read so far forgotten (once asked), to start again from the first piece; a key file stays
	function restartRead(rd) {
		if (!confirm(T().readRestartAsk)) return;
		Object.assign(rd, freshRead(rd), { keyFile: rd.keyFile, fileText: rd.fileText });
		render();
	}
	// The end of checking (layouts.js's checkFinal): the QR code of your words
	// and the one you read, side by side. The same: «=», «✓ It is your seed»,
	// its fingerprint and «the N pieces, exact», and on to Store. Not: «≠», the
	// squares that differ in red, the strings as read around the first piece
	// that does not match, it framed in red, and Next goes to it. Read from the
	// other end (or the two strings swapped): it says so, and offers to turn
	// it round (to swap them); whatever differs, to start again. Only the
	// padding differs: the same seed, «=», and on to Store.
	function checkEnd(rd, diff) {
		const t = T(), m = st.make, things = st.dict.things, n = things.length, k = Math.log2(n), pad = st.mode === "pad", L = readLength(rd);
		const exact = !!m.checked, padOnly = exact && diff.wrong.length > 0, cf = Lay.checkFinal({ pad }), b = cf.boxes, cols = cf.columns;
		const qr = S.compactSeedQR(m.entropy), size = qr.size, cells = S.dataModulesRowMajor(size), made = (r, c) => qr.getModule(c, r);
		// what was read, place by place along the strings (as it reads best), on the template
		const plain = diff.seed.map((c, p) => pad ? S.clockStep(c, diff.key[p], n, -1).value : c);
		const readBits = S.symbolsToBits(plain, k), painted = new Map(), differ = [];
		cells.forEach(([r, c], j) => { painted.set(r * size + c, readBits[j]); if (readBits[j] !== (made(r, c) ? 1 : 0)) differ.push([r, c]); });
		const w = diff.wrong[0] || { turn: L - 1, column: "seed" };
		const label = (box, s) => svg("text", { x: box.x + box.w / 2, y: box.y + box.h - 4, "font-size": 12, "text-anchor": "middle", class: "v-t v-name" }, s);
		const kids = [
			V.qr({ box: b.made, size, modules: made, ...qrFixed(size, b.made) }),
			svg("text", { x: b.sign.x + b.sign.w / 2, y: b.sign.y + b.sign.h / 2 + 15, "font-size": 42, "text-anchor": "middle", class: "v-t v-bold " + (exact ? "v-c-seed" : "v-c-err") }, exact ? "=" : "≠"),
			exact ? V.qr({ box: b.read, size, modules: made, ...qrFixed(size, b.read) }) : V.qr({ box: b.read, size, modules: (r, c) => S.templateModule(size, r, c), painted, wrong: differ, ...qrFixed(size, b.read) }),
			label(b.madeLabel, t.checkMadeQr), label(b.readLabel, t.checkReadQr),
		];
		if (!exact) {
			// the strings as read, around the turn of the piece that does not match, it framed in red;
			// the two strings swapped, each column is drawn as the string read in it (its icon, its dictionary)
			const keyThings = pad && rd.padAs === "string" ? keyThingsOf(rd) : null, swapped = !!(keyThings && diff.swapped);
			kids.push(swapped ? readColumn(b.seedColumn, "key", keyThings, rd.taps, w.turn, L, { column: cols.seed }) : readColumn(b.seedColumn, "seed", things, rd.taps, w.turn, L, { column: cols.seed }));
			if (pad) kids.push(!keyThings ? fileColumn(b.keyColumn, rd.keyFile, w.turn, L)
				: swapped ? readColumn(b.keyColumn, "seed", things, rd.keyTaps, w.turn, L, { column: cols.key }) : readColumn(b.keyColumn, "key", keyThings, rd.keyTaps, w.turn, L, { column: cols.key }));
			kids.push(V.frame({ box: w.column === "key" && b.keyRow ? b.keyRow : b.seedRow, colour: "err" }));
		}
		// the reading turned the way the copy was made (only the seed's string, with a key file), and read again
		const turn = (how) => {
			const f = J.flipRead({ taps: rd.taps.slice(0, L), keyTaps: rd.keyTaps.slice(0, L), ...how });
			rd.taps = f.taps;
			if (pad && rd.padAs === "string") rd.keyTaps = f.keyTaps;
			rd.turn = L;
			render();
		};
		const act = (label, fn) => h("button", { type: "button", class: "btn ghost small", on: { click: fn } }, label);
		const reversed = diff.reversed || diff.keyReversed;
		// exact: the result in its box; otherwise its line, and under it, on a row of its own (never clipped),
		// the note (only the padding differs: read from the other end too, if so) or the actions
		const line = (cls, text) => place(h("div", { class: "cf-result cf-line " + cls }, h("b", { text })), b.resultLine);
		const result = padOnly
			? [line("ok", "✓ " + t.checkSame), place(h("p", { class: "cf-note", text: (diff.reversed || diff.keyReversed || diff.swapped ? (diff.swapped ? t.checkSwapped : t.checkReversed) + " " : "") + t.checkPaddingOk }), b.actions)]
			: exact
			? [place(h("div", { class: "cf-result ok" }, h("b", { text: "✓ " + t.checkSame }), h("span", { class: "cf-exact", text: t.checkExact(L) }), fingerprintLine(m.entropy)), b.result)]
			: [line("bad", diff.swapped ? t.checkSwapped : reversed ? t.checkReversed : t.checkWrongPiece(w.turn + 1)),
				place(h("div", { class: "cf-actions" },
					reversed ? act(t.checkFlip, () => turn(diff)) : null,
					diff.swapped && !reversed ? act(t.checkSwap, () => turn({ reversed: false, keyReversed: false, swapped: true })) : null,
					act(t.checkRestart, () => restartRead(rd))), b.actions)];
		const same = !!rd.out && [...rd.out.entropy].join() === [...m.entropy].join();
		return {
			// the same seed: put right by the QR code, or wrong only in the padding (bits with no square)
			caption: () => exact ? t.checkMatch : same && rd.out.fixed ? t.checkFixed : t.checkMismatch,
			shortcuts: readShortcuts(rd, L, () => {}),
			prev: { go: () => readGo(rd, L - 1) },
			next: exact ? { label: stepName("make", "store") + " ▶", go: () => goSlide("make", "store") }
				: { label: t.checkGo(w.turn + 1) + " ▶", go: () => readGo(rd, w.turn) },
			body: () => h("div", { class: "dict-slide cf-slide" }, canvas(...kids), ...result),
		};
	}

	// ---- make, 7: store it ------------------------------------------------------
	// layouts.js's store. With a key, two places, A and B, a red dashed border
	// between them, «never together»: in A your string and its dictionary, in
	// B the key and its own (the same one: a copy in each, SPEC §10.8; a key
	// file's place keeps a copy too), each with «Saved». With no key, the
	// string in one place with no dictionary (it has its own place) and the
	// dictionary apart. At the foot, in red, forgetting everything here; a key
	// file not saved yet is saved first, and until then nothing is forgotten.
	function storeSlide() {
		const t = T(), m = st.make, pad = st.mode === "pad", file = pad && st.plan.padAs === "file", n = st.dict.things.length;
		const lay = Lay.store({ pad }), b = lay.boxes, saved = m.storedAt || (m.storedAt = {});
		// the key's own collection only for a key of things (padForm may be left from a choice undone)
		const unsaved = file && !m.padKept, own = pad && !file && !!st.plan.padForm, shared = pad && !own;
		const first = (vals) => Array.from({ length: Math.min(vals.length, pad ? 8 : 11) }, (_, j) => vals[j]);
		const seedString = V.string({ box: b.aString, orientation: "h", role: "read", kind: "seed", things: st.dict.things, items: first(m.symbols), showValues: false });
		// the key file as it starts: its first line, and its first rows
		const keyFile = () => {
			const f = lay.file, lines = S.writePadFile(m.pad, n).split("\n").slice(0, 3);
			return svg("g", { class: "v v-file", role: "img", "aria-label": t.padFileTitle },
				V.icon("key", f.icon.x + f.icon.w / 2, f.icon.y + f.icon.h / 2, f.icon.w),
				svg("rect", { x: f.sheet.x, y: f.sheet.y, width: f.sheet.w, height: f.sheet.h, rx: 4, class: "card-file" }),
				...lines.map((x, j) => svg("text", { x: f.lines[j][0], y: f.lines[j][1], "font-size": 10, class: "v-t v-mono v-c-key" }, x)));
		};
		const kids = [
			svg("rect", { x: b.a.x, y: b.a.y, width: b.a.w, height: b.a.h, rx: 8, class: "st-place" }), seedString,
			// in a key's mode each place keeps the dictionary of what it holds; with no key the dictionary has its own place
			pad ? V.dictionary({ label: T().dictLabel, box: b.aDict, things: st.dict.things, mode: "static", icon: "seed" }) : null,
		];
		const over = [];
		const note = (box, ...lines) => over.push(place(h("div", { class: "st-note" }, lines.filter(Boolean).map((x) => h("p", { text: x }))), box));
		const titled = (box, icon, text) => over.push(place(h("p", { class: "st-title" }, V.iconTag(icon), " ", text), box));
		const savedBox = (id, box) => over.push(place(h("label", { class: "st-saved" }, h("input", { type: "checkbox", checked: saved[id] ? "" : null,
			on: { change: (e) => { saved[id] = e.target.checked; } } }), h("span", { text: t.storeSaved })), box));
		const saveFile = () => { download(S.writePadFile(m.pad, n), "numbers.txt", "text/plain"); m.padKept = true; render(); };
		if (pad) {
			const keyThings = file ? null : keyThingsMade();
			kids.push(svg("rect", { x: b.b.x, y: b.b.y, width: b.b.w, height: b.b.h, rx: 8, class: "st-place st-key" }),
				file ? keyFile() : V.string({ box: b.bString, orientation: "h", role: "read", kind: "key", things: keyThings, items: first(m.pad), showValues: false }),
				V.dictionary({ label: T().dictLabel, box: b.bDict, things: own ? st.padDict.things : st.dict.things, mode: "static", icon: "key" }),
				svg("line", { x1: b.border.x + b.border.w / 2, y1: b.border.y, x2: b.border.x + b.border.w / 2, y2: b.border.y + b.border.h, class: "st-border" }),
				svg("text", { x: b.apart.x + b.apart.w / 2, y: b.apart.y + 12, "font-size": 12, "text-anchor": "middle", class: "v-t v-bold v-c-err" }, t.storeApart));
			titled(b.aTitle, "seed", t.storeA); titled(b.bTitle, "key", t.storeB);
			// which half is which only for two strings; beside a file, its start is all there is to mark
			note(b.aNote, file ? t.storeMarkStartOnly : t.storeMarkStart, shared ? t.storeCopy : null);
			note(b.bNote, file ? t.storeFileNote : t.storeMarkStart, shared ? t.storeCopy : null);
			savedBox("a", b.aSaved);
			if (unsaved) over.push(place(h("div", { class: "st-saved" }, h("button", { type: "button", class: "btn small", on: { click: saveFile } }, V.iconTag("save"), " " + t.padFileSave)), b.bSaved));
			else savedBox("b", b.bSaved);
		} else {
			kids.push(svg("rect", { x: b.d.x, y: b.d.y, width: b.d.w, height: b.d.h, rx: 8, class: "st-place" }),
				V.dictionary({ label: T().dictLabel, box: b.dDict, things: st.dict.things, mode: "static", icon: "seed" }));
			titled(b.aTitle, "seed", t.storeHere); titled(b.dTitle, "seed", t.storeDictApart);
			note(b.aNote, t.storeAmong); note(b.dNote, t.storeDictWhy);
			savedBox("a", b.aSaved); savedBox("d", b.dSaved);
		}
		// forgetting everything here, as on opening the page (the language aside)
		const forget = () => {
			// the places whose «Saved» is not ticked, named
			const open = (pad ? [["a", t.storeA], ["b", t.storeB]] : [["a", t.storeHere], ["d", t.storeDictApart]]).filter(([id]) => !saved[id]).map(([, x]) => x);
			if (unsaved || !confirm(t.storeForgetAsk(open))) return;
			Object.assign(st, freshState());
			fingerprints.clear();
			go("intro");
		};
		over.push(place(h("div", { class: "st-forget" }, h("button", { type: "button", class: "btn ghost st-forget-btn", disabled: unsaved || undefined, on: { click: forget } }, t.storeForget)), b.forget));
		return {
			// reached without a copy read back exactly (the guide lands on Check first): said at the foot
			question: t.storeQ(pad), caption: () => unsaved ? t.storeKeyUnsaved : !m.checked ? t.storeNotChecked : t.storeForgetWhy, next: null,
			help: helpOf(stepName("make", "store"), null, pad ? t.storePad : t.storeBasic),
			body: () => h("div", { class: "dict-slide st-slide" }, canvas(...kids), ...over),
		};
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
		const open = () => pickFile(".txt,text/plain", async (f) => { rd.fileText = await f.text(); render(); });
		return [h("div", { class: "label pad-label", text: t.padFileTitle }), h("div", { class: "hint", text: t.padFileReadHelp }), area, status,
			h("div", { class: "row" }, h("button", { class: "btn ghost small", on: { click: open } }, t.padFileOpen))];
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
	// (rd.from: the turn left, when it is the one before or after, not the end: the slide glides in from it)
	function readGo(rd, to) {
		const was = rd.turn || 0;
		rd.turn = Math.max(0, Math.min(readFrontier(rd), to));
		rd.from = was < readLength(rd) && Math.abs(rd.turn - was) === 1 ? was : null;
		render();
	}
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

	// an SVG drawing that is a button: a tap, Enter or the space bar
	const tapOn = (el, fn) => {
		el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
		el.addEventListener("click", fn);
		el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
		return el;
	};
	// A string as read, vertical (vocab.js's "read"): the 7 places around turn
	// i, each piece with its number beside it; vals: what was read at each
	// place. The turn's place, while it is not read: a hole (a «+» with slot).
	// slot(): the hole tapped; piece(x): the piece of place x tapped;
	// title(x): what hovering the piece of place x says (a locked one: where its number comes from);
	// column: layouts.js's readColumn for the box (where each row's position, piece and number go).
	// spill: the places just outside the window too (V.string's), for a column that glides;
	// frontier: the first place not read, an empty place in every drawing (a «+» only on its own turn),
	// so two turns side by side show the same places
	function readColumn(box, kind, things, vals, i, L, on = {}) {
		const item = (x) => x < 0 || x >= L ? undefined : vals[x] !== undefined ? vals[x] : x === i || x === on.frontier ? null : undefined;
		const items = Array.from({ length: 7 }, (_, j) => item(i - 3 + j));
		return V.string({ box, orientation: "v", role: "read", kind, things, items, current: 3, firstPosition: i - 2, column: on.column, spill: on.spill ? [item(i - 4), item(i + 4)] : undefined, slotOnly: true,
			onSlot: on.slot ? () => on.slot() : undefined, onPiece: on.piece ? (j) => on.piece(i - 3 + j) : undefined, titleOf: on.title ? (j) => on.title(i - 3 + j) : undefined });
	}
	// A key file's characters around turn i, a column like a string read: each
	// with its number beside it (amber) and its place under that, on
	// layouts.js's fileColumn; hovering one says where its number comes
	// from. onTap(x): place x tapped (the same, in a popup).
	// spill: its places just outside the window too (a column that glides), as readColumn's
	function fileColumn(box, values, i, L, onTap, spill = false) {
		const col = Lay.fileColumn(box), parts = [];
		(spill ? spillRows(col) : col.rows.map((r, j) => [r, j])).forEach(([r, j]) => {
			const x = i - 3 + j, v = values && values[x], out = j < 0 || j > 6;
			if (x < 0 || x >= L || v === undefined) return;
			const g = svg("g", { class: "v-piece rt-file" + (j === 3 ? " v-current" : "") + (out ? " v-spill" : ""), "aria-hidden": out ? "true" : undefined },
				svg("rect", { x: r.ring.x, y: r.ring.y, width: r.ring.w, height: r.ring.h, rx: 4, class: "rt-file-ring" }),
				svg("text", { x: r.digit[0], y: r.digit[1], "font-size": 17, "text-anchor": "middle", class: "v-t v-mono v-bold v-c-key" }, S.PAD_DIGITS[v]),
				svg("text", { x: r.value[0], y: r.value[1], "font-size": 13, "text-anchor": "middle", class: "v-t v-value v-bold v-c-key" }, String(v)),
				svg("text", { x: r.pos[0], y: r.pos[1], "font-size": 9, "text-anchor": "middle", class: "v-t v-pos" + (j === 3 ? " v-pos-current v-c-qr v-bold" : "") }, String(x + 1)),
				out ? null : svg("title", {}, T().readLockedFile(x + 1, S.PAD_DIGITS[v], v)));
			if (onTap && !out) tapOn(g, () => onTap(x));
			parts.push(g);
		});
		// its icon apart: the run glides on an advance, the icon stays
		return svg("g", { class: "v v-file", role: "group", "aria-label": T().padFileTitle },
			[svg("g", { class: "v-string-icon" }, V.icon("key", col.icon[0], col.icon[1], 11)), ...V.fadeRun(box, col.pitch, parts, col.top)]);
	}

	// The turn read back (layouts.js's readTurn), recovering and checking a
	// copy alike. On the left the strings read, vertical and side by side with
	// the same weight (the seed's, and the key's or its file), 7 places each;
	// the turn's row framed in blue, with a «+» in each string: it opens that
	// string's dictionary as buttons in a popup («Which one do you see at
	// 14?»), closed by Esc or a tap outside (nothing chosen, the hole stays
	// empty and Next waits). A key file gives its number by itself. The rows
	// before are locked: a tap only says where the number comes from. The
	// turn's position in its own box beside the row, from where an arrow goes
	// over the top into the QR above the turn's squares; the row's piece goes
	// straight into its dictionary, then its number. With a key, its piece
	// into its own dictionary (stacked over the seed's) and the two numbers
	// into the clock («n | −k»); what comes out (with no key, the seed's
	// number) gives the bits, which go round the QR's outer side into the
	// turn's squares of the QR code, on the right and the largest. Only the
	// current arrow shows whole. Once a turn's pieces are in, its cycle plays
	// once (at once with reduced motion, or coming back to it). opts.done: on
	// from the last turn.
	let readFresh = null;   // a turn whose pieces were just chosen: its cycle plays once
	let readShown = null;   // the read turn on the page: its columns' rows, for the next one's glide
	function readTurnSlide(rd, opts) {
		const t = T(), things = dictFor(rd).things, n = things.length, k = Math.log2(n), pad = rd.mode === "pad";
		const file = pad && rd.padAs === "file", keyThings = pad && !file ? keyThingsOf(rd) : null, ownKey = !!(keyThings && rd.padForm && rd.padDict);
		const L = readLength(rd), size = S.sizeFor(L, k), cells = S.dataModulesRowMajor(size);
		const key = readKey(rd), frontier = readFrontier(rd);
		const i = rd.turn = Math.max(0, Math.min(frontier, L - 1, rd.turn || 0)), pos = i + 1;
		const C = rd.taps[i], K = key ? key[i] : undefined, hasC = C !== undefined, hasK = pad && K !== undefined, whole = hasC && (!pad || hasK);
		const plainOf = (j) => key ? S.clockStep(rd.taps[j], key[j], n, -1).value : rd.taps[j];
		const wholeAt = (j) => rd.taps[j] !== undefined && (!key || key[j] !== undefined);
		const P = whole ? plainOf(i) : null;
		const turn = S.turnBits(size, i, k), roles = turn.map((x) => x.part), turnCells = turn.filter((x) => x.cell).map((x) => x.cell), header = headerOf(turn);
		const withMask = !!header && header.includes("mask"), cur = S.turnCursor(size, turn);
		// the turn's squares in the QR's box (none for the header and the padding): where the position and the bits arrive;
		// a last turn (header): its bits go to their cards, beside a smaller QR
		const probe = Lay.readTurn({ pad, n, file, header }).boxes.qr, cursor = Lay.qrCellsBox(probe, size, turnCells, { legend: probe.h >= 150 });
		const lay = Lay.readTurn({ pad, n, file, cursor, header, size }), b = lay.boxes, stages = J.readStages({ pad, file, header: !!header, data: !!cursor }), last = stages.length - 1;
		const at = (id) => stages.findIndex((s) => s.id === id), stageOf = (id) => stages.findIndex((s) => s.arrows.includes(id));
		const fresh = whole && readFresh === i && !calm();
		readFresh = null;
		let from = typeof rd.from === "number" && Math.abs(i - rd.from) === 1 && !calm() ? rd.from : null;
		rd.from = null;
		const form = rd.form || st.plan.form;
		// the typing column starts at the seed on each turn
		if (rd.typedTurn !== i) { rd.typedTurn = i; rd.typedBuf = ""; rd.typedCol = "seed"; }
		const typedKey = () => !!keyThings && rd.typedCol === "key";
		// a keyboard is there (a fine pointer, or a key already pressed): the typing hint and the active column show
		const keyboard = () => !!rd.keyed || (typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches);
		// the squares painted: every other turn read; this one once its cycle reaches them
		const paintTurn = (map, j) => bitsOf(plainOf(j), k).forEach((bit, x) => { const c = cells[j * k + x]; if (c) map.set(c[0] * size + c[1], bit); });
		const before = new Map();
		for (let j = 0; j < L; j++) if (j !== i && wholeAt(j)) paintTurn(before, j);
		const template = (r, c) => S.templateModule(size, r, c);

		// a piece chosen, by the picker or typed: it goes in, and on to what is left
		function put(which, v) {
			(which === "key" ? rd.keyTaps : rd.taps)[i] = v;
			st.seen.readTap = true;
			Slides.closePopup(true);
			if (wholeAt(i)) readFresh = i;
			rd.typedBuf = "";
			// typing goes on to the string still empty
			rd.typedTurn = i;
			if (keyThings) rd.typedCol = which === "seed" && (rd.keyTaps[i] === undefined) ? "key" : which === "key" && rd.taps[i] === undefined ? "seed" : which;
			render();
			// on to what is left: the other string's «+», or Next
			const hole = $("app").querySelector(".v-slot"), nb = $("slide-next");
			if (hole) hole.focus(); else if (nb && !nb.disabled) nb.focus();
		}
		// a «+» tapped (or the turn's piece, to change it): the string's dictionary as buttons, over the slide
		function choose(which) {
			const th = which === "key" ? keyThings : things, cur = which === "key" ? K : C, pl = Lay.pickerPopup({ n });
			const pick = (v) => put(which, v);
			// typing in the open picker: a buffer (in the heading), the first match lit, ↓/↑ among them, Enter picks as a tap does
			// what each piece shows and answers to: its initials (typed, else the automatic ones)
			const auto = autoInitials(th), shown = th.map((x, i) => x.emoji || auto[i]);
			let buf = "", matches = [], at = 0;
			const typedEl = h("span", { class: "rt-pick-typed", "aria-live": "polite" });
			const light = () => {
				const cells = pop.querySelectorAll(".v-pick");
				cells.forEach((c, v) => { const on = matches[at] === v; c.classList.toggle("v-pick-hl", on); if (on) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current"); });
				const lit = th[matches[at]];
				typedEl.textContent = buf ? " «" + buf + "»" + (lit ? " → " + (matches[at] + 1) + ": " + (lit.name || shown[matches[at]] || "") : "") : "";
				const c = cells[matches[at]];
				if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" });
			};
			const typeKey = (e) => {
				const r = J.pickKey({ key: e.key, mods: e.ctrlKey || e.metaKey || e.altKey, buffer: buf, matches, at });
				if (!r.consumed) return;
				e.preventDefault(); e.stopPropagation();
				if (r.pick !== null) { pick(r.pick); return; }
				if (r.buffer !== buf) matches = J.pickMatch(th, r.buffer, shown);
				buf = r.buffer; at = matches.length ? r.at : 0; light();
			};
			// the lit match follows the focus: another piece focused (Tab) ends the typing, so Enter acts on that piece
			const refocus = (e) => {
				const cells = Array.from(pop.querySelectorAll(".v-pick"));
				if (buf && cells.indexOf(e.target) !== matches[at]) { buf = ""; matches = []; at = 0; light(); }
			};
			const pop = h("div", { class: "rt-pick" }, h("h2", { class: "rt-pick-q" }, V.iconTag(which), " ", t.readWhich(pos), typedEl),
				h("p", { class: "hint rt-pick-type", text: T().pickType }),
				svg("svg", { class: "rt-pick-canvas", viewBox: `0 0 ${pl.view.w} ${pl.view.h}` },
					V.dictionary({ label: T().dictLabel, box: pl.boxes.picker, things: th, initials: shown, mode: "picker", value: cur === undefined ? null : cur, icon: which, onPick: pick })));
			pop.addEventListener("focusin", refocus);
			pop.addEventListener("keydown", typeKey, true); // before a focused piece's own Enter
			Slides.popup(pop, { label: t.readWhich(pos) });
		}
		// a row before (or a key file's place) tapped: only where its number comes from
		const lockLine = (which, x) => {
			const v = which === "key" ? key[x] : rd.taps[x];
			return which === "key" && file ? t.readLockedFile(x + 1, S.PAD_DIGITS[v], v) : t.readLocked(x + 1, v, (which === "key" ? keyThings : things)[v].name, which === "key" && ownKey);
		};
		// (to change it: back to its turn with ◀, or on to it with ▶)
		function locked(which, x) {
			const line = lockLine(which, x);
			Slides.popup(h("div", { class: "slide-help rt-lock" }, h("p", { text: line }), x !== i ? h("p", { class: "hint", text: x > i ? t.readLockedAhead : t.readLockedWhy }) : null), { label: line });
		}

		// what each arrow shows: the pieces still being chosen, the position and the numbers already in;
		// once they are in, stage p of the cycle (the stage's own whole, the ones before nearly gone)
		const arrowState = (id, p) => {
			if (!whole) {
				if (id === "position") return hasC || (keyThings && hasK) ? "past" : "current";
				if (id === "piece" || id === "number" || id === "clockSeed") return hasC ? "current" : "hidden";
				if (id === "keyPiece" || id === "keyNumber" || id === "clockKey") return hasK ? "current" : "hidden";
				return "hidden";
			}
			const s = stageOf(id);
			return s === p ? "current" : s < p ? "past" : "hidden";
		};
		// the columns (the same at every stage) drawn once, the QR only when its painting changes: a stage or
		// the arrows' drawing never replaces what glides; arrowsOn false: every arrow hidden (until the glide has stopped)
		let posText = null;
		const shownPos = () => rd.typedBuf && rd.typedTurn === i ? rd.typedBuf : String(pos);
		// the typed number is no position: underlined, and in its column's colour
		const posClass = () => "v-t v-pos v-pos-current v-c-qr v-bold" + (rd.typedBuf && rd.typedTurn === i ? " v-pos-typed" + (typedKey() ? " v-pos-key" : "") : "");
		const showPos = () => { if (posText) { posText.textContent = shownPos(); posText.setAttribute("class", posClass()); } };
		// the column that takes the typed digits is ringed (a key as string only)
		const markCol = () => { if (keyThings) { g.seed.classList.toggle("v-col-typing", keyboard() && !typedKey()); g.key.classList.toggle("v-col-typing", keyboard() && typedKey()); } };
		let colsDrawn = false, paintDrawn = null, arrowsOn = true;
		const g = { frame: svg("g"), seed: svg("g"), key: svg("g"), dicts: svg("g"), numbers: svg("g"), clock: svg("g"), bits: svg("g"), cards: svg("g"), qr: svg("g") }, arrowGroups = lay.arrows.map(() => svg("g"));
		function draw(p, turning, onRun, alive) {
			const reached = (id) => whole && at(id) >= 0 && p >= at(id);
			// what is known of each string: while choosing, what has been chosen; once whole, as far as the cycle has gone
			const seedAt = (id) => whole ? reached(id) : hasC, keyAt = (id) => whole ? reached(id) : hasK;
			// the row's frame and, beside it, the turn's position in its own box
			g.frame.replaceChildren(V.frame({ box: b.row, colour: "qr" }),
				svg("rect", { x: b.posBox.x, y: b.posBox.y, width: b.posBox.w, height: b.posBox.h, rx: 4, class: "v-pos-box" }),
				posText = svg("text", { x: b.posBox.x + b.posBox.w / 2, y: b.posBox.y + b.posBox.h / 2 + 4, "font-size": 11, "text-anchor": "middle", class: posClass() }, shownPos()));
			// the dictionaries, each turned to its piece (the key file's numbers need none), and the numbers
			g.dicts.replaceChildren(
				V.dictionary({ label: t.dictLabel, box: b.seedDict, things, mode: "reel", icon: "seed", value: seedAt("piece") ? C : null, from: turning && p === at("piece") ? 0 : undefined }),
				b.keyDict ? V.dictionary({ label: t.dictLabel, box: b.keyDict, things: keyThings, mode: "reel", icon: "key", value: keyAt("keyPiece") ? K : null, from: turning && p === at("keyPiece") ? 0 : undefined }) : svg("g"));
			g.numbers.replaceChildren(V.number({ box: b.number, value: seedAt("number") ? C : null, colour: pad ? "seed" : "qr" }),
				pad ? V.number({ box: b.keyNumber, value: keyAt("keyNumber") ? K : null, colour: "key" }) : svg("g"));
			if (!colsDrawn) g.seed.replaceChildren(readColumn(b.seedColumn, "seed", things, rd.taps, i, L, { column: lay.columns.seed, spill: true, frontier, slot: () => choose("seed"), piece: (x) => x === i ? choose("seed") : locked("seed", x),
				title: (x) => x === i ? null : lockLine("seed", x) }));
			if (pad && !colsDrawn) {
				g.key.replaceChildren(file ? fileColumn(b.keyColumn, key, i, L, (x) => locked("key", x), true)
					: readColumn(b.keyColumn, "key", keyThings, rd.keyTaps, i, L, { column: lay.columns.key, spill: true, frontier, slot: () => choose("key"), piece: (x) => x === i ? choose("key") : locked("key", x),
						title: (x) => x === i ? null : lockLine("key", x) }));
			}
			colsDrawn = true;
			if (pad) {
				// its inputs: while choosing, what is chosen; once whole, from the stage that feeds them
				const fed = (has) => whole ? reached("in") : has;
				g.clock.replaceChildren(V.clock({ box: b.clock, n, from: fed(hasC) ? C : null, by: fed(hasK) ? K : null, sign: -1, inputColour: "seed",
					phase: !whole || p < at("out") ? "inputs" : p === at("out") && turning ? "run" : "done", onDone: p === at("out") ? onRun : undefined, alive }));
			}
			const pb = whole ? bitsOf(P, k) : [];
			g.bits.replaceChildren(V.bits({ box: b.bits, bits: turn.map((x, j) => reached("bits") ? pb[j] : null), roles, colour: "qr" }));
			// the cards, with the bits as read: the other turns' read, this one's once its cycle reaches them
			if (header) {
				const valueAt = (j) => { const x = Math.floor(j / k); return (x === i ? reached("cards") : wholeAt(x)) ? bitsOf(plainOf(x), k)[j - x * k] : null; };
				g.cards.replaceChildren(...headerCardsOf(b, header, size, k, i, Array.from({ length: L * k }, (_, j) => valueAt(j))));
			}
			// redrawn when the paint stage or the cards stage is reached (the mask's cells show from the cards on)
			const drawKey = reached("paint") + "/" + reached("cards");
			if (paintDrawn !== drawKey) {
				paintDrawn = drawKey;
				const painted = new Map(before);
				if (reached("paint")) paintTurn(painted, i);
				// the mask's six cells, once its three bits are read: what they show
				const mk = maskKnown(reached("cards"));
				if (mk) S.maskCells(size).forEach((copy) => copy.forEach(([r, c], j) => painted.set(r * size + c, mk.seen[j])));
				g.qr.replaceChildren(V.qr({ box: b.qr, size, modules: template, turnCells, painted, cursorCells: cur.cells, maskOutline: cur.outline,
					markerLabel: cur.mask ? T().qrMask : T().qrPosition(i + 1), ...qrFixed(size, b.qr) }));
			}
			lay.arrows.forEach((a, j) => arrowGroups[j].replaceChildren(V.arrow({ points: a.points, colour: a.colour, state: arrowsOn ? arrowState(a.id, p) : "hidden" })));
		}
		// each column's rows (their y) in this drawing: what the next one measures its glide against
		const shown = { rd, turn: i, seed: lay.columns.seed.rows.map((r) => r.y), key: !pad ? null : (file ? Lay.fileColumn(b.keyColumn) : lay.columns.key).rows.map((r) => r.y) };
		let prior = null;   // the drawing before (readShown, when body() puts this one on the page)
		// the advance from turn f (FLIP, measured): each column's run starts where turn f's drawing had its places
		// (each place's old y less its new one, the same for all), the QR's marker from f's squares, the bits fading in
		function advance(f) {
			const before = prior && prior.rd === rd && prior.turn === f ? prior : { ...shown, turn: f };
			const shift = (c) => Lay.placeShift({ ys: before[c], turn: f }, { ys: shown[c], turn: i });
			const out = [V.glide(runOf(g.seed), { dy: shift("seed") || 0 })];
			if (pad) out.push(V.glide(runOf(g.key), { dy: shift("key") || 0 }));
			const q = g.qr.lastChild, marker = q && q.querySelector && q.querySelector(".v-qr-cursor");
			const was = Lay.qrCellsBox(b.qr, size, S.turnCursor(size, S.turnBits(size, f, k)).cells, { legend: b.qr.h >= 150 }), now = Lay.qrCellsBox(b.qr, size, S.turnCursor(size, turn).cells, { legend: b.qr.h >= 150 });
			if (was && now && marker) out.push(V.glide(marker, { dx: was.x - now.x, dy: was.y - now.y }));
			V.fadeIn(g.bits); V.fadeIn(g.numbers);
			return out;
		}
		let cycle = null, glides = null, hold = null;
		function body() {
			// the pieces just chosen: the cycle plays from the piece into its dictionary, a relation at a time, the clock
			// turning step by step (the first stage now, before the body is on the page; each later one
			// only while nothing has been drawn since)
			cycle = fresh ? playCycle(stages, at("piece"), draw) : null;
			if (hold) { hold.cancel(); hold = null; }
			// an arrival that glides: its arrows once the columns have stopped
			if (!fresh && from !== null) hold = afterGlide((on) => { arrowsOn = on; draw(whole ? last : 0, false); arrowsOn = true; });
			else if (!fresh) draw(whole ? last : 0, false);
			prior = readShown; readShown = shown;
			if (from !== null) glides = glideIn(from, advance);
			from = null;
			markCol();
			return h("div", { class: "dict-slide rt-slide" }, canvas(g.frame, g.seed, g.key, g.dicts, g.numbers, g.clock, g.bits, g.cards, g.qr, ...arrowGroups), ...maskTip(lay, header, i));
		}

		// the foot: what to do now; once it is read, what it gave (the header and the padding have no squares). A turn that
		// brings the mask: once its 3 bits are read (this turn and those before), what its cells would show and the mask, instead
		// the mask once its 3 bits are read, on any turn (those before, and this one's once `ofThis`)
		const maskKnown = (ofThis) => {
			if (!header) return null;
			const values = Array.from({ length: L * k }, (_, j) => { const x = Math.floor(j / k); return (x === i ? ofThis : wholeAt(x)) ? bitsOf(plainOf(x), k)[j - x * k] : null; });
			const bits = J.maskBitsKnown(i, k, S.dataModulesRowMajor(size).length, values);
			return bits ? S.maskFrom({ mask: bits }) : null;
		};
		const maskRead = () => withMask ? maskKnown(whole) : null;
		const note = header ? maskLineOf(maskRead()) || t.turnHeaderNoQr : null;
		const caption = () => !whole ? (i === 0 && !st.seen.readTap ? t.forms[form].read : keyThings ? t.readTapBoth(pos) : t.readTap(pos))
			: note || (pad ? t.readTurnPad(C, K, n, P) : t.readTurnBasic(P));
		const checking = rd !== st.read;
		// typing a piece's number: digits, Enter, Backspace for the active column; Tab switches column (a key as string only)
		const keys = (e) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return false;
			const buf = rd.typedBuf || "";
			if (e.key === "Tab") {
				if (!keyThings || e.shiftKey) return false;
				rd.keyed = true;
				rd.typedCol = rd.typedCol === "key" ? "seed" : "key"; rd.typedBuf = "";
				showPos(); markCol();
				return true;
			}
			// «+» (or «=», the same key unshifted) opens the active column's picker, when nothing is being typed
			const pick = J.plusKey({ key: e.key, mods: e.ctrlKey || e.metaKey || e.altKey, buffer: buf, keyThings, typedCol: rd.typedCol });
			if (pick) { choose(pick); return true; }
			const digit = /^[0-9]$/.test(e.key);
			if (!digit && !((e.key === "Enter" || e.key === "Backspace") && buf)) return false;
			rd.keyed = true;
			const which = typedKey() ? "key" : "seed", r = J.typedPiece(buf, e.key, (which === "key" ? keyThings : things).length);
			rd.typedBuf = r.buffer;
			if (r.value !== null) put(which, r.value);
			else { showPos(); markCol(); }
			return true;
		};
		return {
			count: `${pos}/${L}`, caption, body, keys,
			hint: () => i < 3 && keyboard() ? (keyThings ? t.keysHintTab : t.keysHint) : null,
			// Next while the advance or the cycle plays: first its end, then on
			hurry: () => { const playing = !!glides && glides.playing; if (glides) glides.finish(); const held = !!hold && hold.finish(); return (!!cycle && cycle.finish()) || held || playing; },
			help: helpOf(stepName(checking ? "make" : "read", checking ? "check" : "recover"), checking ? (pad ? t.checkHelpPad : t.checkReadHelp) : null,
				[t.forms[form].read, keyThings ? t.keysHintTab : t.keysHint, keyThings ? t.tapPadHelp : null, pad ? null : t.whyBasic(n, k), t.readLockedWhy,
					withMask ? t.hdrMaskWhy : null, withMask ? maskLineOf(maskRead()) : null, withMask ? t.turnHeaderNoQr : null, withMask ? t.hdrMaskCatalog : null].filter(Boolean)),
			shortcuts: readShortcuts(rd, L, opts.done),
			prev: i > 0 ? { go: () => readGo(rd, i - 1) } : undefined,
			next: { go: () => { if (i < L - 1) readGo(rd, i + 1); else opts.done(); }, ready: whole },
		};
	}
	// «⋯» while reading: everything typed at once, on to the end of what is read, and starting again
	function readShortcuts(rd, L, done) {
		const t = T(), frontier = readFrontier(rd);
		const typeAll = () => {
			// the pieces as they now are, to go on from
			const names = (taps, th) => taps.filter((v) => v !== undefined).map((v) => th[v].name).join("\n");
			const keyThings = rd.mode === "pad" && rd.padAs === "string" ? keyThingsOf(rd) : null;
			Object.assign(rd, { typing: true, typeError: "", text: names(rd.taps, dictFor(rd).things), keyText: keyThings ? names(rd.keyTaps, keyThings) : "" });
			render();
		};
		const restart = () => restartRead(rd);
		return [{ icon: "⌨", label: t.typeAll, go: typeAll },
			frontier > (rd.turn || 0) + 1 && rd.turn < L ? { icon: "⏩", label: t.readToEnd, go: () => { if (frontier >= L) done(); else readGo(rd, frontier); } } : null,
			rd.taps.length || rd.keyTaps.length ? { icon: "↺", label: t.readRestart, go: restart } : null].filter(Boolean);
	}
	// «⋯ › Type it all»: the names of the pieces in order, one per line (or
	// separated by commas), started from those chosen so far; then on as from the last turn
	function readTypingSlide(rd, done) {
		const t = T(), things = dictFor(rd).things, keyThings = rd.mode === "pad" && rd.padAs === "string" ? keyThingsOf(rd) : null, L = readLength(rd);
		const area = (prop, label) => {
			const a = h("textarea", { class: "input", spellcheck: "false", autocomplete: "off", "aria-label": label, on: { input: (e) => { rd[prop] = e.target.value; } } });
			a.value = rd[prop];
			return [h("div", { class: "label", text: label }), a];
		};
		const parse = (text, th) => S.readSequence(text.split(/[\n,]/).map((s) => s.replace(/^\s*\d+\.\s*/, "").trim().toLowerCase()).filter(Boolean),
			th.map((x) => x.name.toLowerCase()));
		const apply = () => {
			try {
				const taps = parse(rd.text, things), keyTaps = keyThings ? parse(rd.keyText, keyThings) : rd.keyTaps;
				if (taps.length > L || (keyThings && keyTaps.length > L)) { rd.typeError = t.errTyped(Math.max(taps.length, keyTaps.length), L); render(); return; }
				Object.assign(rd, { taps, keyTaps, typing: false, text: "", keyText: "", typeError: "", turn: L });
				done();
			} catch (e) {
				if (!(e instanceof S.DecodeError)) throw e;
				rd.typeError = t.errUnknown(e.message.match(/"(.*)"/)?.[1] || "");
				render();
			}
		};
		const cancel = () => { Object.assign(rd, { typing: false, text: "", keyText: "", typeError: "" }); render(); };
		return {
			question: t.typeQ, caption: () => rd.typeError || t.typeHelp,
			prev: { label: "◀ " + t.tapInstead, go: cancel }, next: { label: t.typeRead + " ▶", go: apply },
			body: () => h("div", { class: "slide-form type-form" }, ...area("text", t.stringSeq), ...(keyThings ? area("keyText", t.stringPad) : [])),
		};
	}

	// ---- read, 2: the turns; 3: the seed ---------------------------------------
	// Recovering: a turn per slide, then the seed. Recovering never touches the
	// backup being made (st.make, st.plan, st.dict): it reads with its own.
	function recoverSlide() {
		const rd = st.read, L = readLength(rd);
		const done = () => { readOut(rd); if (rd.out) goSlide("read", "seed"); else { rd.turn = L; render(); } };
		if (rd.typing) return readTypingSlide(rd, done);
		readOut(rd);
		if (rd.turn >= L && rd.out) rd.turn = L - 1;
		if (rd.turn >= L && readFrontier(rd) >= L) return noFitSlide(rd, done);
		return readTurnSlide(rd, { done });
	}
	// every piece read, and nothing decodes: the QR code as read, and back to the pieces
	function noFitSlide(rd, done) {
		const t = T(), n = dictFor(rd).things.length, k = Math.log2(n), L = readLength(rd), size = S.sizeFor(L, k), cells = S.dataModulesRowMajor(size), key = readKey(rd);
		const painted = new Map(), b = Lay.seedQr({ toWords: true }).boxes;
		for (let j = 0; j < L; j++) bitsOf(key ? S.clockStep(rd.taps[j], key[j], n, -1).value : rd.taps[j], k).forEach((bit, x) => { const c = cells[j * k + x]; if (c) painted.set(c[0] * size + c[1], bit); });
		return {
			question: "✗ " + t.readNoFit, caption: () => t.readLockedWhy, shortcuts: readShortcuts(rd, L, done),
			prev: { go: () => readGo(rd, L - 1) }, next: null,
			body: () => h("div", { class: "dict-slide" }, canvas(V.qr({ box: b.qr, size, modules: (r, c) => S.templateModule(size, r, c), painted, ...qrFixed(size, b.qr) }))),
		};
	}
	// The seed found: the same path as «Your QR» backwards (layouts.js's seedQr):
	// the QR code painted from the pieces, its number, its words, with the
	// fingerprint; how it was read, if not as given; the pieces the QR code had
	// to put right, each a way back to its turn.
	let recSeen = 0;   // the step the end was last drawn at: the number fades in only when a step grew
	function recoverEnd() {
		const t = T(), rd = st.read, out = rd.out, qr = S.compactSeedQR(out.entropy), lay = Lay.seedQr({ toWords: true, end: true }), b = lay.boxes, L = readLength(rd), k = Math.log2(dictFor(rd).things.length);
		const words = S.entropyToMnemonic(out.entropy).split(" ");
		const wrong = out.fixed ? wrongTurns(out, L, k, rd.mode === "pad") : null;
		const how = [out.reversed ? t.reversed : null, out.swapped ? t.padSwapped : null].filter(Boolean);
		const toTurn = (j) => { rd.turn = j; goSlide("read", "recover"); };
		// everything read here forgotten (the backup being made aside), and to the start
		const forget = () => {
			if (!confirm(t.readForgetAsk)) return;
			fingerprints.delete([...out.entropy].join());
			Object.assign(st, { read: freshRead(), at: { ...st.at, read: "mode" }, step: { ...st.step, read: "have" }, ways: { ...st.ways, read: {} } });
			go("intro");
		};
		const note = wrong && wrong.length ? [h("span", { text: t.readWrong(wrong.length) + " " }), ...wrong.slice(0, 4).map((j) => h("button", { type: "button", class: "btn ghost small", on: { click: () => toTurn(j) } }, t.readPiece(j + 1)))]
			: out.fixed ? [h("span", { text: t.readFixed })] : [seedAlert()];
		return {
			question: "✓ " + t.seedFound, steps: 3, caption: (s) => [t.qrBackStepQr, t.qrBackStepNumber, t.handDone][s], next: null,
			prev: { go: () => toTurn(L - 1) },
			shortcuts: [{ icon: "↺", label: t.readAgain, go: () => { st.read = freshRead(st.read); toStep("read", "have"); } },
				{ icon: "✕", label: t.readForget, go: forget }],
			body: (step) => {
				const grew = step > recSeen && !calm();
				recSeen = step;
				const parts = seedQrParts(lay, { words, entropy: out.entropy, qr, step, toWords: true, fade: step === 1 && grew, plain: true });
				if (how.length) parts.over.push(place(h("div", { class: "qr-how" }, how.map((x) => h("small", { text: x }))), { x: 240, y: 62, w: 200, h: 36 }));
				if (step >= 2) parts.over.push(place(h("div", { class: "qr-print" }, fingerprintLine(out.entropy)), b.fingerprint),
					place(h("div", { class: "qr-note" + (out.fixed ? " warn" : "") }, ...note), b.note));
				return h("div", { class: "dict-slide" }, canvas(...parts.kids), ...parts.over);
			},
		};
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
			// a backup under way with another dictionary: asked first, and no keeps it all
			if (!changeDict({ things: thingsOf(set, st.plan.n), checked: false, way: "ready" })) return;
			st.ways.make.dict = "ready";
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
