// Seedcraft Sequences, the web tool's slides: the visual vocabulary every
// slide is built from (strings, dictionaries, bits, the clock module, the QR
// code, arrows, decision cards, dice), drawn on the boxes layouts.js gives.
// It draws with the svg() and h() it is given, so web/test.mjs can check its
// structure without a DOM. Colours are classes (style.css: --qr blue for what
// comes from the QR code, --key amber for what comes from the key, --err red);
// nothing here writes a style attribute or an inline handler.
"use strict";

// ids for clip paths and masks: one counter for the page, so two vocabularies never clash
let seedcraftVocabIds = 0;
// L: layouts.js (the clock module's bands, the canvas)
function SeedcraftVocab(svg, h, L = SeedcraftLayouts) {
	const nextId = (p) => `v-${p}-${++seedcraftVocabIds}`;
	const live = (el) => el && typeof el.setAttribute === "function";
	const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
	const animates = (el) => live(el) && typeof setTimeout === "function" && !reducedMotion();
	const later = (fn) => { Promise.resolve().then(fn); };
	const mod = (x, n) => ((x % n) + n) % n;
	const r1 = (x) => Math.round(x * 10) / 10;
	const colourClass = (c) => "v-c-" + (c || "seed");
	const text = (x, y, size, s, attrs = {}) => svg("text", { x: r1(x), y: r1(y), "font-size": r1(size), ...attrs, class: "v-t" + (attrs.class ? " " + attrs.class : "") }, String(s));
	// a text cut to a width, roughly (an average glyph is about 0.56 em)
	const fit = (s, width, size) => {
		const chars = Array.from(String(s || "")), max = Math.max(1, Math.floor(width / (size * 0.56)));
		return chars.length > max ? chars.slice(0, Math.max(1, max - 1)).join("") + "…" : chars.join("");
	};
	// a straight path that turns only at right angles
	const pathOf = (points) => points.map(([x, y], i) => {
		if (i && x !== points[i - 1][0] && y !== points[i - 1][1]) throw new Error(`diagonal segment ${points[i - 1]} → ${x},${y}`);
		return (i ? "L" : "M") + x + " " + y;
	}).join(" ");
	const press = (el, fn) => {
		el.addEventListener("click", fn);
		el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
		return el;
	};

	// ---- icons: the seed's 🌱 (an emoji every system draws), the rest drawn ----
	// (no symbol a system's fonts may lack: the key, home, save, the circled
	// numbers' code points). Each icon is lines in a
	// 24-unit square around its centre, in absolute coordinates (no transform).
	// key: a bow, a shaft, two teeth; save: an arrow down onto a tray; home: a
	// house; info: a ring round an «i».
	const SHAPES = {
		key: (c, u) => [svg("circle", { cx: r1(c[0] - 5 * u), cy: r1(c[1]), r: r1(4 * u) }),
			svg("path", { d: `M${r1(c[0] - u)} ${r1(c[1])} H${r1(c[0] + 10 * u)} M${r1(c[0] + 6.5 * u)} ${r1(c[1])} V${r1(c[1] + 3.5 * u)} M${r1(c[0] + 10 * u)} ${r1(c[1])} V${r1(c[1] + 4.5 * u)}` })],
		save: (c, u) => [svg("path", { d: `M${r1(c[0])} ${r1(c[1] - 9 * u)} V${r1(c[1] + 3 * u)} M${r1(c[0] - 5 * u)} ${r1(c[1] - 2 * u)} L${r1(c[0])} ${r1(c[1] + 3 * u)} L${r1(c[0] + 5 * u)} ${r1(c[1] - 2 * u)} M${r1(c[0] - 8 * u)} ${r1(c[1] + 8 * u)} H${r1(c[0] + 8 * u)}` })],
		home: (c, u) => [svg("path", { d: `M${r1(c[0] - 9 * u)} ${r1(c[1])} L${r1(c[0])} ${r1(c[1] - 8 * u)} L${r1(c[0] + 9 * u)} ${r1(c[1])} M${r1(c[0] - 6 * u)} ${r1(c[1] - 2 * u)} V${r1(c[1] + 8 * u)} H${r1(c[0] + 6 * u)} V${r1(c[1] - 2 * u)}` })],
		info: (c, u) => [svg("circle", { cx: r1(c[0]), cy: r1(c[1]), r: r1(9 * u) }),
			svg("path", { d: `M${r1(c[0])} ${r1(c[1] - 1.5 * u)} V${r1(c[1] + 5 * u)} M${r1(c[0])} ${r1(c[1] - 5 * u)} V${r1(c[1] - 4 * u)}` })],
	};
	// in an SVG drawing: the icon centred on (x, y), size units across
	function icon(kind, x, y, size) {
		if (kind === "seed" || !SHAPES[kind]) return text(x, y + size * 0.35, size, "🌱", { "text-anchor": "middle", class: "v-icon", "data-icon": "seed" });
		const u = size / 24;
		return svg("g", { class: `v-icon v-icon-drawn v-icon-${kind}`, "data-icon": kind, "stroke-width": r1(Math.max(1, 2.2 * u)) }, SHAPES[kind]([x, y], u));
	}
	// in a text (HTML): the icon as a little inline drawing (the seed's, its emoji), beside the words
	function iconTag(kind) {
		if (kind === "seed" || !SHAPES[kind]) return h("span", { class: "v-ico", "aria-hidden": "true", "data-icon": "seed" }, "🌱");
		return h("span", { class: "v-ico", "aria-hidden": "true", "data-icon": kind },
			svg("svg", { class: `v-ico-svg v-icon-${kind}`, viewBox: "0 0 24 24", width: "24", height: "24" }, icon(kind, 12, 12, 24)));
	}
	// an order number in a ring (drawn: the circled digits are missing from
	// many fonts), centred on (x, y), its number size units high (≥ 10 to read):
	// a circle for one digit, a pill as wide as it takes for more (badgeSize)
	const badgeSize = (n, size = 10) => { const len = String(n).length; return { w: r1(Math.max(1.4 * size, 0.6 * size * len + 0.8 * size)), h: r1(1.4 * size) }; };
	function badge(n, x, y, size = 10, cls = "") {
		const s = String(n), { w, h: hh } = badgeSize(n, size);
		return svg("g", { class: "v-badge" + (cls ? " " + cls : ""), "data-n": s },
			svg("rect", { x: r1(x - w / 2), y: r1(y - hh / 2), width: w, height: hh, rx: r1(hh / 2), class: "v-badge-ring" }),
			text(x, y + size * 0.36, size, s, { "text-anchor": "middle", class: "v-badge-n" }));
	}

	// ---- one piece -------------------------------------------------------
	// centred on (x, y): its photo, else its emoji, else its symbol on its
	// colour, else its initials; no piece: a dashed hole.
	const PICTOGRAPH = /\p{Extended_Pictographic}/u;
	const initialsOf = (name) => {
		const words = (name || "").trim().split(/\s+/).filter(Boolean);
		return !words.length ? "" : words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 2).toUpperCase() : words[0].slice(0, 3);
	};
	const lightColour = (hex) => {
		const v = parseInt((hex || "#ffffff").slice(1), 16);
		return ((v >> 16) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 > 150;
	};
	function bead(thing, x, y, r, current) {
		x = r1(x); y = r1(y); r = r1(r);
		if (!thing) return svg("g", { class: "v-bead" }, svg("circle", { cx: x, cy: y, r, class: "v-hole" }));
		const ring = "v-bead-ring" + (current ? " v-ring-current" : "");
		const parts = [];
		if (thing.photo) {
			const id = nextId("clip");
			parts.push(svg("clipPath", { id }, svg("circle", { cx: x, cy: y, r })),
				svg("image", { href: thing.photo, x: x - r, y: y - r, width: 2 * r, height: 2 * r, "clip-path": `url(#${id})`, preserveAspectRatio: "xMidYMid slice" }),
				svg("circle", { cx: x, cy: y, r, class: ring, fill: "none" }));
		} else {
			const fill = thing.colour || undefined, base = fill ? ring : ring + " v-bead-bg";
			if (thing.brick) {
				const hh = r1(r * 1.4);
				parts.push(svg("rect", { x: x - r, y: r1(y - hh / 2), width: 2 * r, height: hh, rx: 3, fill, class: base }));
			} else parts.push(svg("circle", { cx: x, cy: y, r, fill, class: base }));
			const ink = fill ? (lightColour(fill) ? "v-ink-dark" : "v-ink-light") : "v-ink";
			if (thing.emoji && PICTOGRAPH.test(thing.emoji)) parts.push(text(x, y + r * 0.36, r * 1.05, thing.emoji, { "text-anchor": "middle", class: "v-glyph" }));
			else if (thing.symbol && !thing.emoji) parts.push(text(x, y + r * 0.34, r * 0.95, thing.symbol + "︎", { "text-anchor": "middle", class: "v-glyph v-mono v-bold " + ink }));
			else {
				const initials = thing.emoji || initialsOf(thing.name) || "?";
				parts.push(text(x, y + r * 0.3, r * (initials.length > 3 ? 0.5 : initials.length > 2 ? 0.62 : 0.8), initials, { "text-anchor": "middle", class: "v-glyph v-bold " + ink }));
			}
		}
		return svg("g", { class: "v-bead" }, parts);
	}

	// ---- a string: pieces on a thread --------------------------------------
	// items: each position's piece (an index in things), null for an empty
	// position (a dashed hole), undefined where the string has no position
	// (before its start, after its end). firstPosition: items[0]'s position,
	// from 1. current: the index in items of the turn's piece. kind: "seed"
	// (neutral) or "key" (amber). role "build": the big one, its names under the
	// pieces, the turn's piece bigger and ringed; "reference": thin, dotted,
	// dimmed, its turn's piece framed; "read": each piece's number beside it in
	// its string's colour (showValues). onSlot(i): a hole is a «+» to tap.
	// room: the icon's room at each end, if not the usual (a small drawing on a card).
	// titleOf(i): what hovering piece i says, if not its position and name.
	// column (role "read", vertical): layouts.js's readColumn for this box (readTurn's and
	// checkFinal's columns); else one is made with outer: the side its positions go on.
	let maskN = 0;
	function string({ box, orientation = "h", role = "build", kind = "seed", things = [], items = [], firstPosition = 1, current = -1, showValues = role === "read", onSlot, onPiece, room, titleOf, column, outer = "left", posBox }) {
		const n = Math.max(1, items.length), vertical = orientation === "v";
		// the icon's room at the start, the same at the end, so the middle position stays at the box's middle
		const pad = room !== undefined ? room : vertical ? Math.min(14, box.h * 0.08) : Math.min(20, box.w * 0.04);
		const pitch = L.pitch(box, n, { vertical, room: pad });
		const parts = [];
		let place, r, label, curR = null, start = null, iconEl = null;   // start: where the thread begins when the first positions are empty (right of its icon)
		const posClass = (i) => "v-pos" + (i === current ? " v-pos-current v-c-qr v-bold" : "");
		if (!vertical && role === "build") {
			// the turn's piece by far the largest, its position (blue) and name under it, ~3 pitches wide;
			// the other pieces smaller, each with its position above it and no name
			const NAME = Math.min(13, box.h * 0.22), R = Math.max(4, Math.min(pitch / 2 - 2, (box.h - NAME - 6) / 2));
			const cy = box.y + 2 + R;
			r = Math.max(3, Math.min(pitch / 2 - 6, R / 1.55));
			curR = R;
			place = (i) => [box.x + pad + pitch * (i + 0.5), cy];
			// every position above its bead; the turn's, in the posBox, above the slot; its name under its bead
			label = (i, x, y, thing, pos) => i === current
				? [thing ? svg("text", { x: r1(x), y: r1(box.y + box.h - 3), "font-size": r1(NAME), "text-anchor": "middle", class: "v-t v-name" }, fit(thing.name, 3 * pitch - NAME * 2, NAME)) : null]
				: [text(x, cy - r - 1.5, 9, pos, { "text-anchor": "middle", class: "v-pos" })];
			iconEl = icon(kind, box.x + pad / 2, cy, Math.min(pad * 0.95, 19));
			start = box.x + pad;
		} else if (!vertical) {
			const cy = box.y + box.h * 0.38;
			r = Math.max(3, Math.min(pitch / 2 - 6, box.h * 0.27) * (role === "reference" ? 0.7 : 1));
			place = (i) => [box.x + pad + pitch * (i + 0.5), cy];
			label = (i, x, y, thing, pos, value) => [
				text(x, box.y + box.h - 2, 9, pos, { "text-anchor": "middle", class: posClass(i) }),
				value !== null && showValues ? text(x + pitch / 2 - 2, box.y + 10, 9, value, { "text-anchor": "end", class: "v-value " + colourClass(kind) }) : null];
			iconEl = icon(kind, box.x + pad / 2, cy, Math.min(pad * 0.95, 19));
			start = box.x + pad;
		} else if (role === "read") {
			// layouts.js's readColumn: each row's position on the column's outer side (outer),
			// the piece in the middle, its number (big, in its string's colour) beside it, never one over the other
			const col = column && column.rows.length === n ? column : L.readColumn(box, { outer, top: pad, count: n }), mid = (b) => b.x + b.w / 2;
			r = col.r;
			place = (i) => [mid(col.rows[i].piece), col.rows[i].y];
			const fs = Math.min(13, pitch * 0.38), small = 9;
			label = (i, x, y, thing, pos, value) => [
				value !== null && showValues ? text(mid(col.rows[i].value), y + fs * 0.36, fs, value, { "text-anchor": "middle", class: "v-value v-bold " + colourClass(kind) }) : null,
				text(mid(col.rows[i].pos), y + small * 0.36, small, pos, { "text-anchor": "middle", class: posClass(i) })];
			iconEl = icon(kind, col.icon[0], col.icon[1], pad * 1.0);
			start = col.icon[1] + pad * 0.4;
		} else {
			// the position on the left, the piece on the right
			const numW = 12;
			r = Math.max(3, Math.min(pitch / 2 - 2, (box.w - numW) / 2 - 2) * (role === "reference" ? 0.85 : 1));
			const cx = box.x + numW + (box.w - numW) / 2;
			place = (i) => [cx, box.y + pad + pitch * (i + 0.5)];
			const fs = 9;
			label = (i, x, y, thing, pos, value) => [
				text(box.x + numW / 2, y + fs * 0.35, i === current ? 10 : fs, pos, { "text-anchor": "middle", class: posClass(i) }),
				value !== null && showValues ? text(box.x + numW / 2, y + fs * 1.4, fs, value, { "text-anchor": "middle", class: "v-value " + colourClass(kind) }) : null];
			iconEl = icon(kind, cx, box.y + pad / 2, pad * 1.0);
			start = box.y + pad;
		}
		// the thread, from the first position there is to the last
		const there = items.map((x, i) => x === undefined ? -1 : i).filter((i) => i >= 0);
		if (there.length) {
			const a = place(there[0]), b = place(there[there.length - 1]), ext = (i) => i === 0 || i === items.length - 1 ? pitch / 2 : 0;
			const [x1, y1] = vertical ? [a[0], there[0] > 0 ? start : a[1] - ext(there[0])] : [there[0] > 0 ? start : a[0] - ext(there[0]), a[1]];
			const [x2, y2] = vertical ? [b[0], b[1] + ext(there[there.length - 1])] : [b[0] + ext(there[there.length - 1]), b[1]];
			parts.push(svg("line", { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: "v-thread" + (role === "reference" ? " v-thread-ref" : role === "build" ? " v-thread-build" : "") }));
		}
		items.forEach((idx, i) => {
			if (idx === undefined) return;
			const [x, y] = place(i), pos = firstPosition + i, thing = idx === null ? null : things[idx] || null, isCur = i === current;
			const rr = isCur && role === "build" ? (curR !== null ? curR : Math.min(r * 1.6, box.w / 2 - 1)) : r;
			const kids = [];
			if (isCur && role === "reference") kids.push(svg("rect", { x: r1(x - rr - 2), y: r1(y - pitch / 2 + 0.5), width: r1(2 * rr + 4), height: r1(pitch - 1), rx: 3, class: "v-turn-frame" }));
			kids.push(bead(thing, x, y, rr, isCur && role === "build"));
			if (idx === null && onSlot) kids.push(text(x, y + rr * 0.4, rr * 1.1, "+", { "text-anchor": "middle", class: "v-plus" }));
			if (thing) kids.push(svg("title", {}, (titleOf && titleOf(i)) || `${pos}: ${thing.name || ""}`));
			kids.push(...label(i, x, y, thing, pos, idx === null ? null : idx).filter(Boolean));
			const tap = idx === null ? onSlot : thing ? onPiece : null;
			const g = svg("g", { class: "v-piece" + (isCur ? " v-current" : "") + (idx === null ? " v-empty" : "") + (idx === null && onSlot ? " v-slot" : ""),
				role: tap ? "button" : undefined, tabindex: tap ? "0" : undefined }, kids);
			if (tap) press(g, () => tap(i));
			parts.push(g);
		});
		if (role === "build" && !vertical) {
			// build: the icon apart; the beads and thread in the run (faded at both ends, in a wrapper
			// so a glided run does not drag its mask); the slot's frame and the posBox, fixed
			const id = "sm" + (++maskN), x0 = box.x, w = box.w, fade = Math.min(pitch / w, 0.5);
			const stop = (o, c) => svg("stop", { offset: r1(o * 100) + "%", "stop-color": c });
			const defs = svg("defs", {}, [
				svg("linearGradient", { id: id + "g", gradientUnits: "userSpaceOnUse", x1: x0, y1: 0, x2: x0 + w, y2: 0 }, [stop(0, "#000"), stop(fade, "#fff"), stop(1 - fade, "#fff"), stop(1, "#000")]),
				svg("mask", { id, maskUnits: "userSpaceOnUse", x: x0, y: box.y - 6, width: w, height: box.h + 12 },
					svg("rect", { x: x0, y: box.y - 6, width: w, height: box.h + 12, fill: `url(#${id}g)` }))]);
			const fixed = [];
			if (posBox) {
				const cx = place(current)[0];
				fixed.push(svg("rect", { x: r1(cx - pitch / 2), y: box.y, width: r1(pitch), height: box.h, rx: 4, class: "v-slot-frame" }));
				fixed.push(svg("rect", { x: posBox.x, y: posBox.y, width: posBox.w, height: posBox.h, rx: 4, class: "v-pos-box" }),
					text(posBox.x + posBox.w / 2, posBox.y + posBox.h / 2 + 4, 11, firstPosition + current, { "text-anchor": "middle", class: "v-pos v-pos-current v-c-qr v-bold" }));
			}
			return svg("g", { class: `v v-string v-${role} v-${kind}` }, [defs, svg("g", { class: "v-string-fixed" }, fixed),
				svg("g", { class: "v-string-icon" }, iconEl),
				svg("g", { mask: `url(#${id})` }, svg("g", { class: "v-string-run" }, parts))]);
		}
		// the others: the icon apart too, so a glided run (the key's reference string) leaves it in place;
		// a vertical one fades its top and bottom pitch (the mask in a wrapper, so the glided run does not drag it)
		if (vertical && (role === "read" || role === "reference")) return svg("g", { class: `v v-string v-${role} v-${kind}` }, [svg("g", { class: "v-string-icon" }, iconEl), ...fadeRun(box, pitch, parts)]);
		return svg("g", { class: `v v-string v-${role} v-${kind}` }, [svg("g", { class: "v-string-icon" }, iconEl), svg("g", { class: "v-string-run" }, parts)]);
	}
	// a vertical run (class v-string-run) in a wrapper whose mask fades the box's first and last pitch;
	// returns [defs, masked wrapper]
	function fadeRun(box, pitch, parts) {
		const id = "sm" + (++maskN), y0 = box.y, h = box.h, fade = Math.min(pitch / h, 0.5);
		const stop = (o, c) => svg("stop", { offset: r1(o * 100) + "%", "stop-color": c });
		return [svg("defs", {}, [
			svg("linearGradient", { id: id + "g", gradientUnits: "userSpaceOnUse", x1: 0, y1: y0, x2: 0, y2: y0 + h }, [stop(0, "#000"), stop(fade, "#fff"), stop(1 - fade, "#fff"), stop(1, "#000")]),
			svg("mask", { id, maskUnits: "userSpaceOnUse", x: box.x - 6, y: y0, width: box.w + 12, height: h },
				svg("rect", { x: box.x - 6, y: y0, width: box.w + 12, height: h, fill: `url(#${id}g)` }))]),
			svg("g", { mask: `url(#${id})` }, svg("g", { class: "v-string-run" }, parts))];
	}

	// ---- a dictionary: a little card with a book's tab ----------------------
	// rows «number · piece». "static": every row (or, if they do not fit, the
	// ones around value), value's framed. "reel": a window of 3 rows over a
	// strip of every row, turned (a transform) until value's row is in the
	// middle; from: the value it turns from (animated unless reduced motion).
	// "picker": every piece as a button; onPick(v). columns ("static"): side by
	// side, so that every row shows (the first column 0 …, the next on from there).
	function dictionary({ box, things = [], mode = "static", value = null, icon: kind = "seed", onPick, from, columns = 1, label = null }) {
		const N = things.length, tabH = L.pickerGrid(box, N).tabH;
		const card = { x: box.x, y: box.y + tabH, w: box.w, h: box.h - tabH }, inner = { x: card.x + 2, y: card.y + 2, w: card.w - 4, h: card.h - 4 };
		const wide = !!label && box.w >= 110, lfs = Math.max(8, Math.min(10, tabH * 0.7));
		const tabW = wide ? Math.min(box.w, 28 + 0.55 * lfs * (String(label).length + 3) + 6) : Math.min(30, box.w * 0.4);
		const parts = [
			svg("rect", { x: box.x, y: box.y, width: r1(tabW), height: tabH + 2, rx: 3, class: "v-dict-tab" }),
			icon(kind, box.x + (wide ? 15 : tabW / 2), box.y + tabH * 0.82 - Math.max(9, tabH * 0.8) * 0.35, Math.max(9, tabH * 0.8)),
			wide ? text(box.x + 28, box.y + tabH * 0.82, lfs, "📖 " + label, { class: "v-dict-label" }) : label ? svg("title", {}, label) : null,
			svg("rect", { x: card.x, y: card.y, width: card.w, height: card.h, rx: 4, class: "v-dict-card" }),
		];
		const row = (v, y, rowH, on, col = inner) => {
			// the number, the bead, the name: a name of up to 16 characters is drawn whole (its font steps down to fit)
			const fs = Math.min(col.w < 130 ? 10 : 12, rowH * 0.62), numW = fs * 1.25, br = Math.min(Math.max(2, rowH * 0.36), col.w < 130 ? 5 : 99), thing = things[v];
			const bx = col.x + numW + 3 + br, tx = bx + br + 3, room = col.x + col.w - tx - 2;
			const nfs = Math.max(Math.min(fs, 9), Math.min(Math.min(12, rowH * 0.62), room / (16 * 0.56)));
			return svg("g", { class: "v-dict-row" + (on ? " on" : ""), "data-value": String(v), "data-y": String(r1(y)) },
				text(col.x + numW, y + rowH / 2 + fs * 0.35, fs, v, { "text-anchor": "end", class: "v-mono v-dict-num" }),
				bead(thing && (thing.name || thing.emoji || thing.photo || thing.colour) ? thing : null, bx, y + rowH / 2, br),
				text(tx, y + rowH / 2 + nfs * 0.35, nfs, thing ? fit(thing.name, room, nfs) : "", { class: "v-name" }));
		};
		if (mode === "picker") {
			// the grid is layouts.js's, so an arrow can leave from the piece picked
			const { cols, cw, ch } = L.pickerGrid(box, N), gap = 2;
			things.forEach((thing, v) => {
				// its number on top, the piece, its name under it
				const x = inner.x + (v % cols) * cw, y = inner.y + Math.floor(v / cols) * ch, fs = Math.max(9, Math.min(11, ch * 0.2));
				const br = Math.max(3, Math.min(cw / 2 - 4, (ch - 2 * fs - 8) / 2));
				parts.push(press(svg("g", { class: "v-pick" + (v === value ? " on" : ""), role: "button", tabindex: "0", "aria-label": `${v}: ${thing.name || ""}`, "aria-pressed": String(v === value) },
					svg("rect", { x: r1(x + gap / 2), y: r1(y + gap / 2), width: r1(cw - gap), height: r1(ch - gap), rx: 4, class: "v-pick-bg" }),
					text(x + 4, y + fs + 1, fs, v, { class: "v-mono v-dict-num" }),
					bead(thing, x + cw / 2, y + fs + 3 + br, br),
					text(x + cw / 2, y + ch - 3, fs, fit(thing.name, cw - 6, fs), { "text-anchor": "middle", class: "v-name" }),
					svg("title", {}, `${v}: ${thing.name || ""}`)), () => onPick && onPick(v)));
			});
			return svg("g", { class: `v v-dict v-dict-${kind} v-picker` }, parts);
		}
		if (mode === "reel") {
			const rowH = inner.h / 3, at = (v) => inner.y + rowH - (v === null ? 0 : v) * rowH, id = nextId("reel");
			const strip = svg("g", { class: "v-reel-strip", transform: `translate(0 ${r1(at(value))})`, "data-value": value === null ? "" : String(value) },
				things.map((_, v) => row(v, v * rowH, rowH, v === value)));
			parts.push(svg("clipPath", { id }, svg("rect", { x: inner.x, y: inner.y, width: inner.w, height: inner.h })),
				value === null ? null : svg("rect", { x: inner.x, y: r1(inner.y + rowH), width: inner.w, height: r1(rowH), rx: 3, class: "v-dict-on" }),
				svg("g", { "clip-path": `url(#${id})` }, strip),
				svg("rect", { x: inner.x, y: inner.y, width: inner.w, height: r1(inner.h), class: "v-reel-window" }));
			// turning from the last value: CSS transitions the style's transform (style.css; none with reduced motion)
			if (from !== undefined && from !== null && from !== value && live(strip) && strip.style && typeof requestAnimationFrame === "function") {
				strip.style.transform = `translate(0px, ${r1(at(from))}px)`;
				requestAnimationFrame(() => requestAnimationFrame(() => { strip.style.transform = `translate(0px, ${r1(at(value))}px)`; }));
			}
			return svg("g", { class: `v v-dict v-dict-${kind} v-reel` }, parts);
		}
		// static: every row if each gets 15 px (a 9 px name), in its columns
		const per = Math.ceil(N / Math.max(1, columns));
		if (columns > 1 && inner.h / per >= 15) {
			const rowH = Math.min(20, inner.h / per), cw = inner.w / columns;
			for (let v = 0; v < N; v++) {
				const c = Math.floor(v / per), y = inner.y + (v % per) * rowH, col = { x: inner.x + c * cw, w: cw };
				if (v === value) parts.push(svg("rect", { x: r1(col.x), y: r1(y), width: r1(cw), height: r1(rowH), rx: 3, class: "v-dict-on" }));
				parts.push(row(v, y, rowH, v === value, col));
			}
			return svg("g", { class: `v v-dict v-dict-${kind} v-static` }, parts);
		}
		// else the rows around value
		const show = Math.max(1, Math.min(N, Math.floor(inner.h / 15))), rowH = Math.min(20, inner.h / show);
		const first = show >= N ? 0 : Math.max(0, Math.min(N - show, (value === null ? 0 : value) - Math.floor(show / 2)));
		for (let v = first; v < first + show && v < N; v++) {
			const y = inner.y + (v - first) * rowH;
			if (v === value) parts.push(svg("rect", { x: inner.x, y: r1(y), width: inner.w, height: r1(rowH), rx: 3, class: "v-dict-on" }));
			parts.push(row(v, y, rowH, v === value));
		}
		return svg("g", { class: `v v-dict v-dict-${kind} v-static` }, parts);
	}

	// ---- binary: each bit in its little box, with «₂» --------------------
	// bits: 0, 1 or null (still to come: an empty box). roles[i]: where bit i
	// comes from (S.turnBits's part): "data" (a square), or the border of its
	// header card: "version" neutral, "mask" amber, "padding" dashed ("header",
	// the version and the mask together, dashed too). colour: "qr" or "key".
	function bits({ box, bits = [], orientation = "row", roles = [], colour = "qr", now = null, pending = false }) {
		const n = Math.max(1, bits.length), SUB = 8, parts = [], tower = orientation === "tower";
		const pitch = tower ? box.h / n : (box.w - SUB) / n;
		const size = Math.max(4, Math.min(tower ? box.w - SUB : box.h, pitch - 2));
		bits.forEach((b, i) => {
			const x = tower ? box.x + (box.w - SUB - size) / 2 : box.x + i * pitch + (pitch - size) / 2;
			const y = tower ? box.y + i * pitch + (pitch - size) / 2 : box.y + (box.h - size) / 2;
			const role = roles[i] && roles[i] !== "data" ? (roles[i] === "padding" || roles[i] === "header" ? " v-bit-dashed" : "") + " v-bit-" + roles[i] : "";
			parts.push(svg("g", { class: "v-bit" + (b === 0 ? " v-bit-0" : b === 1 ? " v-bit-1" : "") + (b === null || b === undefined ? " v-bit-empty" : "") + role
				+ (now ? (now[i] ? " v-bit-now" : " v-bit-dim") : "") },
				now && now[i] ? svg("rect", { x: r1(x - 2.5), y: r1(y - 2.5), width: r1(size + 5), height: r1(size + 5), rx: 5, class: "v-bit-ring" }) : null,
				svg("rect", { x: r1(x), y: r1(y), width: r1(size), height: r1(size), rx: 3, class: "v-bit-box" }),
				b === null || b === undefined ? (pending ? text(x + size / 2, y + size * 0.72, size * 0.62, "·", { "text-anchor": "middle", class: "v-mono" }) : null)
					: text(x + size / 2, y + size * 0.72, size * 0.62, b, { "text-anchor": "middle", class: "v-mono" })));
		});
		const last = n - 1, sx = tower ? box.x + box.w - SUB / 2 : box.x + box.w - SUB / 2;
		const sy = tower ? box.y + last * pitch + (pitch + size) / 2 : box.y + (box.h + size) / 2;
		parts.push(text(sx, Math.min(sy, box.y + box.h), 9, "₂", { "text-anchor": "middle", class: "v-sub" }));
		return svg("g", { class: `v v-bits v-bits-${orientation} ${colourClass(colour)}` }, parts);
	}

	// ---- a last turn's card: where bits that are no squares come from ------
	// kind "version" (neutral), "mask" (amber, as the QR's fixed areas: its
	// value beside its bits) or "padding" (dashed, with a die: by chance).
	// title over the bits (0, 1 or null: not known yet), note under them.
	function headerCard({ box: b, title, bits: values = [], now = null, note = null, kind = "version", value = null, face = 3 }) {
		const BW = 14, row = { x: b.x + 6, y: b.y + 18, w: values.length * BW + 8, h: 14 };
		const parts = [svg("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 5, class: "v-hcard-box" }),
			text(b.x + 6, b.y + 12, 8.5, fit(title, b.w - 12, 8.5), { class: "v-bold" }),
			bits({ box: row, bits: values, roles: values.map(() => kind), colour: kind === "mask" ? "key" : "seed", now, pending: true })];
		if (kind === "mask" && value !== null && value !== undefined) parts.push(text(row.x + row.w + 6, row.y + 12, 14, "= " + value, { class: "v-bold v-c-key v-hcard-value" }));
		if (kind === "padding") {
			parts.push(die({ sides: 6, face, size: 22, x: b.x + b.w - 28, y: b.y + 15 }));
		}
		if (note) {
			// the note over as many lines as it needs, the last one at the foot of the card
			const wrap = (size) => {
				const max = Math.max(1, Math.floor((b.w - 12) / (size * 0.56))), lines = [];
				for (const word of String(note).split(/\s+/)) {
					if (lines.length && (lines[lines.length - 1] + " " + word).length <= max) lines[lines.length - 1] += " " + word;
					else lines.push(word);
				}
				return lines;
			};
			let size = 8, lines = wrap(size);
			if (lines.length > 1) { size = 7.5; lines = wrap(size); }
			lines.forEach((l, j) => parts.push(text(b.x + 6, b.y + b.h - 7 - (lines.length - 1 - j) * 8.5, size, fit(l, b.w - 12, size), { class: "v-sub" })));
		}
		return svg("g", { class: `v v-hcard v-hcard-${kind}` }, parts);
	}

	// ---- decimal: a big number, no box ------------------------------------
	const number = ({ box, value, colour = "seed" }) => {
		const fs = Math.min(box.h * 0.8, 28);
		return svg("g", { class: `v v-number ${colourClass(colour)}` },
			text(box.x + box.w / 2, box.y + box.h / 2 + fs * 0.36, fs, value === null || value === undefined ? "" : value, { "text-anchor": "middle", class: "v-bold" }));
	};
	// ---- one piece with its name under it, filling a box --------------------
	// named false: the piece alone, as big as the box allows (a kind of piece, with its count beside it)
	const piece = ({ box, thing, current = false, named = true }) => {
		if (!named) return svg("g", { class: "v v-one" }, bead(thing || null, box.x + box.w / 2, box.y + box.h / 2, Math.max(3, Math.min(box.w, box.h) / 2 - 2), current));
		const fs = Math.min(10, box.h * 0.2), r = Math.max(3, Math.min(box.w / 2, (box.h - fs - 3) / 2) - 2);
		return svg("g", { class: "v v-one" }, bead(thing || null, box.x + box.w / 2, box.y + 2 + r, r, current),
			text(box.x + box.w / 2, box.y + box.h - 2, fs, thing ? fit(thing.name, box.w, fs) : "", { "text-anchor": "middle", class: "v-name" }));
	};
	// ---- a frame around a row (the turn's, when reading) ---------------------
	const frame = ({ box, colour = "qr" }) => svg("rect", { x: box.x, y: box.y, width: box.w, height: box.h, rx: 6, class: `v v-frame ${colourClass(colour)}` });

	// ---- the clock module: inputs on top, the dial, the output at the bottom ----
	// The bands and the dial are layouts.js's clockModule (the arrows enter its
	// cells). phase "inputs": the two numbers only; "run": the token goes round
	// step by step (220 ms a step, at most RUN_MS in all: with N = 32 a step is
	// quicker), then the output; directly with reduced motion; "done": the token
	// at the result, the arc, the output.
	// inputColour: the first number's colour ("qr" making a copy, "seed" reading).
	// onDone ("run"): called once the output shows, always after clock() has returned.
	// alive ("run"): whether the run still counts (the drawing it is in still the
	// latest): once it says no, the token stops where it is and onDone never comes.
	// from or by null: that number is not there yet (reading, a piece still to
	// choose): its band empty, the ring with its numbers, nothing turning.
	// a step of the token: 220 ms, quicker when there are many, so a run lasts at most RUN_MS
	const RUN_MS = 1200, clockStepMs = (steps) => Math.min(220, RUN_MS / Math.max(1, steps));
	function clock({ box, n, from, by, sign = 1, phase = "done", inputColour = "qr", onDone, alive }) {
		const m = L.clockModule(box), { cx, cy, r } = m.dial;
		const angle = (v) => 2 * Math.PI * v / n - Math.PI / 2;
		const at = (v, rr = r) => [r1(cx + rr * Math.cos(angle(v))), r1(cy + rr * Math.sin(angle(v)))];
		const cell = (c) => svg("rect", { x: c.x, y: c.y, width: c.w, height: c.h, class: "v-clock-cell" });
		const bandText = (c, s, cls) => text(c.x + c.w / 2, c.y + c.h / 2 + Math.min(c.h * 0.62, 18) * 0.36, Math.min(c.h * 0.62, 18), s, { "text-anchor": "middle", class: "v-bold " + cls });
		if (from === null || from === undefined || by === null || by === undefined) {
			const fs = n <= 4 ? 11 : n <= 8 ? 10 : 9, lr = r - fs - 2, every = Math.max(1, n / 8), parts = [];
			parts.push(svg("rect", { x: box.x, y: box.y, width: box.w, height: box.h, rx: 6, class: "v-clock-box" }), ...[...m.inputs, m.output].map(cell),
				bandText(m.inputs[0], from === null || from === undefined ? "" : from, "v-clock-in " + colourClass(inputColour)),
				bandText(m.inputs[1], by === null || by === undefined ? "" : (sign > 0 ? "+" : "−") + by, "v-clock-in v-c-key"),
				svg("circle", { cx, cy, r, class: "v-clock-ring" }));
			for (let v = 0; v < n; v++) { const [x, y] = at(v); parts.push(svg("circle", { cx: x, cy: y, r: n > 16 ? 1.5 : 2.5, class: "v-clock-tick" })); }
			for (let v = 0; v < n; v += every) { const [x, y] = at(v, lr); parts.push(text(x, y + fs * 0.35, fs, v, { "text-anchor": "middle", class: "v-clock-n" })); }
			return svg("g", { class: "v v-clock v-clock-waiting", role: "img", "aria-label": `mod ${n}` }, parts);
		}
		const to = mod(from + sign * by, n), wrapped = sign > 0 ? from + by > n - 1 : from - by < 0;
		const parts = [svg("rect", { x: box.x, y: box.y, width: box.w, height: box.h, rx: 6, class: "v-clock-box" }), ...[...m.inputs, m.output].map(cell),
			bandText(m.inputs[0], from, "v-clock-in " + colourClass(inputColour)),
			bandText(m.inputs[1], (sign > 0 ? "+" : "−") + by, "v-clock-in v-c-key"),
			svg("circle", { cx, cy, r, class: "v-clock-ring" })];
		// what shows first: everything with "done" (and "run" when it cannot or must not move), the inputs only otherwise
		const moving = phase === "run" && by % n > 0 && animates(parts[0]), final = phase !== "inputs" && !moving;
		// the arc from `from` round to the result, the way it goes
		let arc = null;
		if (by % n) {
			const [x0, y0] = at(from), [x1, y1] = at(to);
			arc = svg("path", { class: "v-clock-arc", d: `M${x0},${y0} A${r1(r)},${r1(r)} 0 ${by / n > 0.5 ? 1 : 0} ${sign > 0 ? 1 : 0} ${x1},${y1}`, visibility: final ? undefined : "hidden" });
			parts.push(arc);
		}
		// every number has its tick. Written, in this order, each where it does
		// not touch one already written (on the ring's inner track, else a track
		// further in): the sum's two and, when the step goes round, the 0 (always)
		// and N − 1 (if it fits); then the regular ones (up to 8 every number, with
		// 16 every 2nd, with 32 every 4th) where they fit on the inner track.
		const fs = n <= 4 ? 11 : n <= 8 ? 10 : 9, lr = r - fs - 2, every = Math.max(1, n / 8);
		const roleOf = (v) => v === to ? " to" : v === from ? " from" : wrapped && (v === 0 || v === n - 1) ? " wrap" : "";
		for (let v = 0; v < n; v++) {
			const [x, y] = at(v);
			parts.push(svg("circle", { cx: x, cy: y, r: n > 16 ? 1.5 : 2.5, class: "v-clock-tick" + roleOf(v) }));
		}
		const written = [], clear = ([x, y]) => written.every(([, wx, wy]) => Math.hypot(x - wx, y - wy) >= fs);
		const write = (v, tracks) => {
			if (written.some(([w]) => w === v)) return true;
			for (const rr of tracks) { const p = at(v, rr); if (clear(p)) { written.push([v, ...p]); return true; } }
			return false;
		};
		const both = [lr, lr - fs - 1];
		write(from, both);
		if (wrapped && !write(0, both)) written.push([0, ...at(0, both[1])]);   // the pass from N − 1 to 0 is always shown
		write(to, both);
		if (wrapped) write(n - 1, both);
		for (let v = 0; v < n; v += every) write(v, [lr]);
		for (const [v, lx, ly] of written.sort((a, b) => a[0] - b[0]))
			parts.push(text(lx, ly + fs * 0.35, fs, v, { "text-anchor": "middle", class: "v-clock-n" + roleOf(v) }));
		const cfs = Math.min(r * 0.45, 18), ofs = Math.min(m.output.h * 0.7, 20), byText = (k) => (sign > 0 ? "+" : "−") + k;
		const [tx, ty] = at(final ? to : from);
		const token = svg("circle", { cx: tx, cy: ty, r: n > 16 ? 4 : 5, class: "v-clock-token" });
		const counter = svg("text", { x: r1(cx), y: r1(cy + cfs * 0.36), "font-size": r1(cfs), "text-anchor": "middle", class: "v-t v-bold v-clock-by" }, final ? byText(by) : "");
		const output = svg("text", { x: r1(m.output.x + m.output.w / 2), y: r1(m.output.y + m.output.h / 2 + ofs * 0.36), "font-size": r1(ofs), "text-anchor": "middle", class: "v-t v-bold v-clock-out" }, final ? String(to) : "");
		parts.push(token, counter, output);
		const g = svg("g", { class: "v v-clock", role: "img", "aria-label": `${from} ${byText(by)} → ${to} (mod ${n})` }, parts);
		if (moving) {
			// the token goes round a step at a time, the counter counting; then the arc and the output
			let k = 0;
			const step = clockStepMs(by);
			const tick = () => {
				if (alive ? !alive() : k > 0 && g.isConnected === false) return;
				k++;
				const [x, y] = at(mod(from + sign * k, n));
				token.setAttribute("cx", x); token.setAttribute("cy", y); counter.textContent = byText(k);
				if (k < by) { setTimeout(tick, step); return; }
				output.textContent = String(to);
				if (arc) arc.setAttribute("visibility", "visible");
				if (onDone) later(onDone);
			};
			setTimeout(tick, step);
		} else if (phase === "run" && onDone) later(onDone);
		return g;
	}

	// ---- the QR code: a grid, the turn's squares in blue -----------------
	// modules(r, c): true dark, false light, null not known yet (or a 2D array);
	// painted: Map(r * size + c → 0 | 1), what has been painted (over modules);
	// turnCells: [[r, c]], the turn's squares (also ringed by a marker, the last child); wrong: [[r, c]], squares in red;
	// reveal: { order: [[r, c]], ms }, the dark data cells in order appear one after the other over ms.
	// fixed: Set of r * size + c (the function modules), drawn apart in amber/brown with a hatch (they cost no pieces);
	// legend: a short string under the QR (the QR is then 14 smaller); markerLabel: a blue tab on the marker,
	// both in one g.v-qr-cursor (the last child) so that they glide together
	function qr({ box, size, modules, turnCells = [], painted = new Map(), wrong = [], reveal = null, fixed = null, legend = null, markerLabel = null }) {
		const LEG = 14, side = Math.min(box.w, box.h) - (legend ? LEG : 0), cs = side / size, x0 = box.x + (box.w - side) / 2, y0 = box.y + (box.h - side - (legend ? LEG : 0)) / 2;
		const get = typeof modules === "function" ? modules : (r, c) => modules ? modules[r][c] : null;
		const turn = new Set(turnCells.map(([r, c]) => r * size + c)), bad = new Set(wrong.map(([r, c]) => r * size + c));
		const order = reveal && reveal.order && !reducedMotion() ? new Map(reveal.order.map(([r, c], j) => [r * size + c, j])) : null;
		const parts = [svg("rect", { x: r1(x0), y: r1(y0), width: r1(side), height: r1(side), class: "v-qr-bg" })];
		const hatchId = fixed ? nextId("hatch") : null, hatched = [];
		if (fixed) parts.push(svg("pattern", { id: hatchId, width: 3, height: 3, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
			svg("path", { d: "M0 0.5H3", class: "v-qr-hatch-line" })));
		for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
			const k = r * size + c, v = painted.has(k) ? painted.get(k) === 1 : get(r, c), isFixed = !!fixed && fixed.has(k);
			const cls = bad.has(k) ? "v-qr-err" : turn.has(k) ? "v-qr-turn" + (v ? " on" : "") : isFixed ? "v-qr-fixed " + (v === true ? "on" : v === false ? "off" : "unk") : v === true ? "v-qr-dark" : v === false ? null : "v-qr-unknown";
			if (!cls) continue;
			const revealed = order && cls === "v-qr-dark" && order.has(k);
			const el = svg("rect", { x: r1(x0 + c * cs), y: r1(y0 + r * cs), width: r1(cs), height: r1(cs), class: revealed ? cls + " v-qr-reveal" : cls });
			if (revealed && el.style) el.style.animationDelay = (order.get(k) / reveal.order.length * reveal.ms) + "ms";
			parts.push(el);
			if (isFixed && !bad.has(k) && !turn.has(k)) hatched.push(`M${r1(x0 + c * cs)} ${r1(y0 + r * cs)}h${r1(cs)}v${r1(cs)}h${r1(-cs)}z`);
		}
		if (hatched.length) parts.push(svg("path", { d: hatched.join(""), fill: `url(#${hatchId})`, class: "v-qr-hatched" }));
		if (legend) {
			const ly = box.y + box.h - LEG / 2 + 3, sw = 10, tw = 0.5 * 9 * String(legend).length, lx = box.x + (box.w - (sw + 4 + tw)) / 2;
			parts.push(svg("g", { class: "v-qr-legend" },
				svg("rect", { x: r1(lx), y: r1(box.y + box.h - LEG / 2 - 4), width: sw, height: 8, rx: 1.5, class: "v-qr-fixed off" }),
				svg("rect", { x: r1(lx), y: r1(box.y + box.h - LEG / 2 - 4), width: sw, height: 8, rx: 1.5, fill: `url(#${hatchId || "none"})`, class: "v-qr-hatched" }),
				text(lx + sw + 4, ly, 9, legend, { class: "v-qr-legend-text" })));
		}
		const m = L.qrCellsBox(box, size, turnCells, { legend: !!legend });
		if (m) {
			const kids = [svg("rect", { x: m.x, y: m.y, width: m.w, height: m.h, rx: 2, class: "v-qr-marker" })];
			if (markerLabel) {
				const fs = 8, th = 12, tw = Math.min(box.w, 0.55 * fs * String(markerLabel).length + 10);
				const below = m.y - th < box.y;
				const tx = Math.max(box.x, Math.min(box.x + box.w - tw, m.x + m.w / 2 - tw / 2)), ty = below ? m.y + m.h : m.y - th;
				kids.push(svg("rect", { x: r1(tx), y: r1(ty), width: r1(tw), height: th, rx: 3, class: "v-qr-tab" }),
					text(tx + tw / 2, ty + th - 3.5, fs, markerLabel, { "text-anchor": "middle", class: "v-qr-tab-text" }));
			}
			parts.push(svg("g", { class: "v-qr-cursor" }, kids));
		}
		return svg("g", { class: "v v-qr" }, parts);
	}

	// ---- moving and appearing, all in ADVANCE_MS (nothing under reduced motion) ----
	const ADVANCE_MS = 450;
	// el starts at translate(dx, dy) and glides to its own place; finish() settles it at once
	function glide(el, { dx = 0, dy = 0, ms = ADVANCE_MS } = {}) {
		if (!live(el) || !el.style || reducedMotion() || (!dx && !dy)) return { finish() {} };
		el.style.transition = "none";
		el.style.transform = `translate(${dx}px, ${dy}px)`;
		el.getBoundingClientRect();
		el.style.transition = `transform ${ms}ms cubic-bezier(.3,.7,.3,1)`;
		el.style.transform = "";
		// once there (or finished at once), the element is left as it was: no transition kept on it
		const done = (e) => {
			if (e && (e.target !== el || e.propertyName !== "transform")) return;
			if (el.removeEventListener) el.removeEventListener("transitionend", done);
			el.style.transition = "";
		};
		if (el.addEventListener) el.addEventListener("transitionend", done);
		return { finish() { done(); el.style.transform = ""; } };
	}
	const fadeIn = (el) => {
		if (live(el) && !reducedMotion()) {
			el.classList.add("v-fade-in");
			// once faded in the class goes: a node kept across redraws would replay it when re-inserted
			if (el.addEventListener) el.addEventListener("animationend", function done(e) {
				if (e && e.target !== el) return;
				el.classList.remove("v-fade-in");
				el.removeEventListener("animationend", done);
			});
		}
		return el;
	};

	// ---- an arrow: dashed, straight, turning at right angles ---------------
	// "current": drawn along its path (CSS; at once with reduced motion);
	// "past": faint; "hidden": not shown.
	function arrow({ points, colour = "qr", state = "current" }) {
		const d = pathOf(points), [ex, ey] = points[points.length - 1], [px, py] = points[points.length - 2] || points[0];
		const len = Math.hypot(ex - px, ey - py) || 1, ux = (ex - px) / len, uy = (ey - py) / len;
		const head = [[ex, ey], [ex - 7 * ux + 4 * uy, ey - 7 * uy - 4 * ux], [ex - 7 * ux - 4 * uy, ey - 7 * uy + 4 * ux]].map((p) => p.map(r1).join(",")).join(" ");
		const body = [svg("path", { d, class: "v-arrow-line" }), svg("polygon", { points: head, class: "v-arrow-head" })];
		const attrs = { class: `v v-arrow v-arrow-${state} ${colourClass(colour)}` };
		if (state === "past") attrs.opacity = "0.25";
		if (state === "hidden") attrs.visibility = "hidden";
		if (state !== "current") return svg("g", attrs, body);
		const id = nextId("draw");
		return svg("g", attrs,
			svg("mask", { id, maskUnits: "userSpaceOnUse", x: -20, y: -20, width: L.VIEW.w + 40, height: L.VIEW.h + 40 }, svg("path", { d, pathLength: 1, class: "v-arrow-draw" })),
			svg("g", { mask: `url(#${id})` }, body));
	}

	// ---- a decision: a card per option ----------------------------------
	// options: [{ id, art (a drawing), title, pros, cons }], at most two ✓ and
	// two ✕ each. A tap chooses (onChoose(id)); the chosen one has the accent.
	function cards({ options = [], chosen = null, onChoose }) {
		// every card keeps all four slots (an empty list stays as a placeholder) so the rows line up
		const list = (kind, cls, mark, xs) => h("ul", { class: "v-card-" + kind + " v-card-list" + (xs.length ? "" : " empty"), "aria-hidden": xs.length ? null : "true" },
			xs.slice(0, 2).map((x) => h("li", { class: cls }, h("span", { class: "v-mark", "aria-hidden": "true" }, mark), " ", x)));
		return h("div", { class: "v-cards" }, options.map((o) => h("button", {
			type: "button", class: "v-card" + (o.id === chosen ? " on" : ""), "aria-pressed": String(o.id === chosen),
			on: { click: () => onChoose && onChoose(o.id) },
		}, h("div", { class: "v-card-art", "aria-hidden": "true" }, o.art || null),
		h("b", { class: "v-card-title" }, o.title),
		list("pros", "v-pro", "✓", o.pros || []), list("cons", "v-con", "✕", o.cons || []))));
	}

	// ---- dice: a face in relief (a coin is round) --------------------------
	// face: from 0 (shown as 1 … sides, a d10's 0 … 9), null: «?». label: the
	// face's own name instead (a coin's heads and tails). A d4's and a d6's
	// faces are pips, as on the dice themselves; from a d8 on, digits.
	const faceLabel = (sides, face, label) => label !== undefined ? label : face === null || face === undefined ? "?" : String(sides === 10 ? face : face + 1);
	// where the pips of 1 … 6 go, on a 3 × 3 grid (column, row) round the face's centre
	const PIPS = [null, [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [2, 0], [0, 2], [2, 2]],
		[[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];
	const pipped = (sides, face, label) => label === undefined && (sides === 4 || sides === 6) && face !== null && face !== undefined && face >= 0 && face < sides;
	// x, y: where it goes inside another drawing
	function die({ sides, face = null, size = 56, label, rolling = false, x, y }) {
		const coin = sides === 2, s = faceLabel(sides, face, label);
		const body = coin
			? [svg("circle", { cx: 50, cy: 53, r: 42, class: "v-die-edge" }), svg("circle", { cx: 50, cy: 48, r: 42, class: "v-die-body" }), svg("circle", { cx: 50, cy: 48, r: 33, class: "v-die-rim" })]
			: [svg("rect", { x: 8, y: 13, width: 84, height: 84, rx: 18, class: "v-die-edge" }), svg("rect", { x: 8, y: 6, width: 84, height: 84, rx: 18, class: "v-die-body" })];
		const fs = s.length > 2 ? 30 : 44;
		const mark = pipped(sides, face, label)
			? svg("g", { class: "v-die-pips", "data-face": s }, PIPS[face + 1].map(([c, r]) => svg("circle", { cx: 28 + 22 * c, cy: 26 + 22 * r, r: 9, class: "v-die-pip" })))
			: svg("text", { x: 50, y: 48 + fs * 0.36, "font-size": fs, "text-anchor": "middle", class: "v-t v-bold v-die-face" }, s);
		return svg("svg", { class: "v-die" + (coin ? " v-coin" : "") + (rolling ? " v-rolling" : ""), width: size, height: size, viewBox: "0 0 100 100", "aria-hidden": "true", ...(x !== undefined ? { x: r1(x), y: r1(y) } : {}) },
			body, mark);
	}
	const faceButton = ({ sides, face, onPress, disabled = false, label, size = 48 }) =>
		h("button", { type: "button", class: "v-face", disabled: disabled || undefined, "aria-label": faceLabel(sides, face, label), on: { click: () => onPress && onPress(face) } },
			die({ sides, face, size, label }));

	return { RUN_MS, clockStepMs, icon, iconTag, badge, badgeSize, string, fadeRun, dictionary, bits, headerCard, number, piece, frame, clock, qr, ADVANCE_MS, glide, fadeIn, arrow, cards, die, faceButton };
}
