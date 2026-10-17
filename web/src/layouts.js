// Seedcraft Sequences, the web tool's slides: the pure geometry of each slide
// (boxes and arrows on a 680×350 canvas), with no DOM, so web/test.mjs can
// check that everything fits and that no arrow crosses a box or another arrow.
// vocab.js draws the visual vocabulary on these boxes.
"use strict";

const SeedcraftLayouts = (() => {
	const VIEW = { w: 680, h: 350 };
	const box = (x, y, w, h) => ({ x, y, w, h });
	const BIT = 22;                                   // a bit's little box, binary row and tower
	const bitsOf = (n) => Math.max(1, Math.ceil(Math.log2(n)));
	// a face thrown again (keyThrow's rejected): its cell (w × h), its face's
	// side, its order badge's height; BADGE: the size of a badge's number
	const REJECT = { w: 31, h: 42, face: 26, badge: 14 }, BADGE = 10, USED_BADGE = { w: 20, h: 14 };

	// an arrow is dashed, straight and turns only at right angles
	function route(points) {
		for (let i = 1; i < points.length; i++) {
			const [x1, y1] = points[i - 1], [x2, y2] = points[i];
			if (x1 !== x2 && y1 !== y2) throw new Error(`diagonal segment ${x1},${y1} → ${x2},${y2}`);
		}
		return points.map(([x, y], i) => (i ? "L" : "M") + x + " " + y).join(" ");
	}

	// whether a horizontal or vertical segment goes through a box's inside;
	// running along or ending on its border does not count
	function segmentHitsBox([x1, y1], [x2, y2], b) {
		return Math.max(x1, x2) > b.x && Math.min(x1, x2) < b.x + b.w
			&& Math.max(y1, y2) > b.y && Math.min(y1, y2) < b.y + b.h
			&& (x1 === x2 ? x1 > b.x && x1 < b.x + b.w : y1 > b.y && y1 < b.y + b.h);
	}

	// Sum or difference mod N, always the same: the two inputs in a band on
	// top, the clock in the middle, the output in a band at the bottom.
	function clockModule(b) {
		const band = Math.round(b.h * 0.18), half = b.w / 2;
		const r = Math.min(b.w, b.h - 2 * band) / 2 - 6;
		return {
			inputs: [box(b.x, b.y, half, band), box(b.x + half, b.y, half, band)],
			dial: { cx: b.x + half, cy: b.y + b.h / 2, r },
			output: box(b.x, b.y + b.h - band, b.w, band),
		};
	}

	const arrow = (id, from, to, colour, points) => ({ id, from, to, colour, points });

	// The string being built (the seed in its turn, the key in its throw) is one
	// element: bottom, full width, 13 pieces, the turn's slot in the middle.
	const BUILT = box(16, 276, 648, 58), SLOT = box(316, 276, 48, 58);
	// the y where the arrows run before dropping into the slot
	const RAIL = 262;
	// the slide's fixed top band, the guide on the left and «?» «⋯» on the right: nothing else goes there
	const GUIDE = box(0, 0, VIEW.w, 26);

	// The turn while making the copy. Bottom to top, left to right: the seed
	// string being built, its slot's position → the QR → its bits → their
	// number; with a key, the key string's piece → its dictionary → its number,
	// both numbers → the clock → the seed's dictionary → the slot.
	// file: the key is a file, so its column holds the file's characters and
	// its number comes straight from the turn's row (no key dictionary).
	function makeTurn({ pad, n, file = false }) {
		const bits = bitsOf(n);
		const b = {
			qr: box(16, 36, 180, 180),
			bits: box(212, 56, bits * BIT, BIT),
			number: box(212, 94, 72, 40),
			seedString: { ...BUILT },
			seedSlot: { ...SLOT },
			guide: { ...GUIDE },
		};
		const arrows = [
			arrow("position", "seedSlot", "qr", "qr", [[328, 276], [328, 264], [106, 264], [106, 216]]),
			arrow("bits", "qr", "bits", "qr", [[196, 67], [212, 67]]),
			arrow("number", "bits", "number", "qr", [[232, 78], [232, 94]]),
		];
		if (!pad) {
			b.seedDict = box(400, 76, 140, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[284, 112], [400, 112]]),
				arrow("slot", "seedDict", "seedSlot", "qr", [[470, 148], [470, RAIL], [352, RAIL], [352, SLOT.y]]));
			return { boxes: b, arrows };
		}
		// the key string is a reference: vertical, its turn piece in the middle (y 126)
		Object.assign(b, {
			keyString: box(336, 36, 34, 180),
			clock: box(520, 44, 128, 136),
			seedDict: box(520, 196, 128, 60),
		});
		const keyIn = clockModule(b.clock).inputs[1], keyX = keyIn.x + keyIn.w / 2;
		// The key's number sits above its dictionary, so its route to the clock
		// goes over the top and never crosses the seed's, which goes under the
		// key string and up the outer corridor into the left cell.
		const clockSeed = arrow("clockSeed", "number", "clock", "qr", [[248, 134], [248, 236], [506, 236], [506, 56], [520, 56]]);
		const clockKey = (y) => arrow("clockKey", "keyNumber", "clock", "key", [[456, y], [456, 30], [keyX, 30], [keyX, keyIn.y]]);
		if (file) {
			// the file's row → its number, level with it
			b.keyNumber = box(388, 110, 112, 32);
			arrows.push(arrow("keyNumber", "keyString", "keyNumber", "key", [[370, 126], [388, 126]]), clockSeed, clockKey(110));
		} else {
			Object.assign(b, { keyDict: box(386, 96, 116, 72), keyNumber: box(388, 44, 112, 32) });
			arrows.push(
				arrow("keyPiece", "keyString", "keyDict", "key", [[370, 126], [386, 126]]),
				arrow("keyNumber", "keyDict", "keyNumber", "key", [[430, 96], [430, 76]]),
				clockSeed, clockKey(44));
		}
		arrows.push(
			arrow("output", "clock", "seedDict", "qr", [[584, 180], [584, 196]]),
			arrow("slot", "seedDict", "seedSlot", "qr", [[584, 256], [584, RAIL], [352, RAIL], [352, SLOT.y]]));
		return { boxes: b, arrows };
	}

	// A string read, vertical (vocab.js's "read" role), 7 places (count): each place's
	// row split in three, side by side, never one over the other: its position
	// on the column's outer side (outer "left": the seed's, the leftmost; "right":
	// the key's, beside it), the piece in the middle, its number on the inner
	// side, beside the piece. top: the icon's room at each end (as the string's);
	// r: the piece's radius; icon: the icon's centre, over the pieces.
	const POS_W = 18, VALUE_W = 22;
	function readColumn(b, { outer = "left", top = Math.min(14, b.h * 0.08), count = 7 } = {}) {
		const pitch = (b.h - 2 * top) / count, pieceW = b.w - POS_W - VALUE_W, left = outer === "left";
		const posX = left ? b.x : b.x + b.w - POS_W, pieceX = left ? b.x + POS_W : b.x + VALUE_W, valueX = left ? b.x + POS_W + pieceW : b.x;
		const rows = Array.from({ length: count }, (_, j) => {
			const y = b.y + top + pitch * (j + 0.5), y0 = y - pitch / 2;
			return { y, pos: box(posX, y0, POS_W, pitch), piece: box(pieceX, y0, pieceW, pitch), value: box(valueX, y0, VALUE_W, pitch) };
		});
		return { outer, top, pitch, r: Math.max(3, Math.min(pitch / 2 - 3, 16, pieceW / 2 - 1)), icon: [pieceX + pieceW / 2, b.y + top / 2], rows };
	}

	// The turn while recovering: what is built is the QR, large on the right.
	// The strings read are vertical and side by side on the left, 7 pieces each,
	// the turn's row (the middle one) framed, with a "+" slot per string; every
	// arrow leaves from that frame, each down its own corridor (x 188, 200, 212).
	function readTurn({ pad, n }) {
		const bits = bitsOf(n), piece = 41, top = 40, rowY = top + 3 * piece;
		const seedColumn = box(20, top, 70, 7 * piece), seed = readColumn(seedColumn, { outer: "left" });
		const slotIn = (c) => box(c.rows[3].piece.x, rowY + 2, c.rows[3].piece.w, piece - 4);
		const b = {
			seedColumn,
			seedSlot: slotIn(seed),
			qr: box(490, 75, 170, 170),
			guide: { ...GUIDE },
		};
		const columns = { seed };
		const toQr = (x) => [[x, 40], [b.qr.x + 16, 40], [b.qr.x + 16, b.qr.y]];   // into the QR near its left edge: the shortest way over the clock
		if (!pad) {
			b.row = box(16, rowY, 80, piece);
			const y = rowY + 27;
			b.bits = box(220, y - BIT / 2, bits * BIT, BIT);
			return { boxes: b, columns, arrows: [
				arrow("position", "row", "qr", "qr", [[96, rowY + 9], [110, rowY + 9], ...toQr(110)]),
				arrow("bits", "row", "bits", "qr", [[96, y], [220, y]]),
				arrow("paint", "bits", "qr", "qr", [[220 + bits * BIT, y], [b.qr.x, y]]),
			] };
		}
		const keyColumn = box(100, top, 70, 7 * piece);
		columns.key = readColumn(keyColumn, { outer: "right" });
		Object.assign(b, {
			keyColumn,
			keySlot: slotIn(columns.key),
			row: box(16, rowY, 160, piece),
			clock: box(228, 90, 120, 150),
		});
		const m = clockModule(b.clock), [seedIn, keyIn] = m.inputs;
		const outY = Math.round(m.output.y + m.output.h / 2), keyX = keyIn.x + keyIn.w / 2;
		b.bits = box(364, outY - BIT / 2, bits * BIT, BIT);
		// the key's number goes over the top into its own (right) cell
		return { boxes: b, columns, arrows: [
			arrow("position", "row", "qr", "qr", [[176, rowY + 9], [188, rowY + 9], ...toQr(188)]),
			arrow("clockSeed", "row", "clock", "qr", [[176, rowY + 33], [212, rowY + 33], [212, seedIn.y + 15], [228, seedIn.y + 15]]),
			arrow("clockKey", "row", "clock", "key", [[176, rowY + 21], [200, rowY + 21], [200, 74], [keyX, 74], [keyX, keyIn.y]]),
			arrow("bits", "clock", "bits", "qr", [[348, outY], [364, outY]]),
			arrow("paint", "bits", "qr", "qr", [[364 + bits * BIT, outY], [b.qr.x, outY]]),
		] };
	}

	// Choosing a piece while reading (a "+" tapped): the string's dictionary
	// opened as buttons in a popup, under its question; its own canvas (view),
	// lower the fewer kinds there are, so every button stays big enough to tap.
	function pickerPopup({ n }) {
		const view = { w: 420, h: n <= 4 ? 130 : n <= 8 ? 200 : 240 };
		return { view, boxes: { picker: box(2, 2, view.w - 4, view.h - 4) } };
	}
	// Checking a copy, the end: the QR code of your words and the one you read,
	// side by side with = or ≠ between them, each named under it, and under
	// both what it means. When they differ, on the right the strings as read
	// around the piece that does not match, the row of each (as readTurn's) to frame it.
	function checkFinal({ pad }) {
		const piece = 41, top = 40, rowY = top + 3 * piece, b = {
			guide: { ...GUIDE },
			made: box(24, 44, 200, 200), sign: box(232, 119, 50, 50), read: box(290, 44, 200, 200),
			madeLabel: box(24, 248, 200, 18), readLabel: box(290, 248, 200, 18),
			result: box(24, 272, 466, 62),
			seedColumn: box(510, top, 70, 7 * piece), seedRow: box(510, rowY, 70, piece),
		};
		if (pad) Object.assign(b, { keyColumn: box(590, top, 70, 7 * piece), keyRow: box(590, rowY, 70, piece) });
		const columns = { seed: readColumn(b.seedColumn, { outer: "left" }) };
		if (pad) columns.key = readColumn(b.keyColumn, { outer: "right" });
		return { boxes: b, columns, arrows: [] };
	}

	// The key's throw: the faces as buttons on the left (a coin's 2 up to a
	// d20's 20, in a grid as square as the space allows), the instruction and
	// the tools (undo, fix) under them, the bit tower in the middle with the
	// faces that count on its left (dice) and those thrown again aside
	// (rejected), the info line under it (info), then brace → number → the key's
	// dictionary → the piece → its slot in the key string being built. That
	// row stays at the middle of a 5-bit tower, whatever N, so it never climbs
	// into the question. tool "bag": the key's dictionary as buttons (picker)
	// instead of faces, and no tower; "device": one die (die) instead of the
	// faces. file: the key is a file, so the number goes straight to its slot
	// in the file (no dictionary, no piece).
	function keyThrow({ sides = 6, bits = 5, tool = "dice", file = false, n = 2 ** bits, value = null }) {
		const mid = 70 + 5 * BIT / 2, h = bits * BIT, y = mid - h / 2;
		const b = { guide: { ...GUIDE }, question: box(190, 30, 300, 30), keyString: { ...BUILT }, keySlot: { ...SLOT } };
		const number = () => { b.number = box(394, mid - 20, 56, 40); };
		let faces = null;
		const arrows = [];
		if (tool === "bag") {
			// the bag: the key's dictionary as buttons; from the piece picked (value's
			// cell), a key as a string takes it straight to its slot (down from under
			// its column); a key file takes its number (right from its row), then
			// the number to its place in the file. What to do now, on the right.
			b.picker = box(20, 64, 320, 172);
			const cell = pickerCell(b.picker, n, value === null ? 0 : value), cx = Math.round(cell.x + cell.w / 2), cy = Math.round(cell.y + cell.h / 2);
			const bottom = b.picker.y + b.picker.h, right = b.picker.x + b.picker.w;
			if (file) {
				number();
				b.instruction = box(460, 170, 190, 24); b.tools = box(460, 200, 190, 24);
				arrows.push(arrow("number", "picker", "number", "key", cy === mid ? [[right, mid], [394, mid]] : [[right, cy], [370, cy], [370, mid], [394, mid]]),
					arrow("slot", "number", "keySlot", "key", [[422, mid + 20], [422, RAIL], [352, RAIL], [352, SLOT.y]]));
			} else {
				b.instruction = box(380, 120, 260, 24); b.tools = box(380, 150, 260, 24);
				arrows.push(arrow("slot", "picker", "keySlot", "key", [[cx, bottom], [cx, RAIL], [352, RAIL], [352, SLOT.y]]));
			}
			return { boxes: b, faces, arrows };
		}
		number();
		Object.assign(b, { tower: box(330, y, 28, h), brace: box(362, y, 16, h) });
		if (tool === "device") Object.assign(b, { die: box(60, 72, 100, 100), instruction: box(20, 182, 180, 24), tools: box(20, 210, 180, 24) });
		else {
			const cols = sides <= 2 ? 2 : sides <= 6 ? 3 : sides <= 12 ? 4 : 5;
			const rows = Math.ceil(sides / cols), gap = 6, area = { w: 180, h: 170 };
			const size = Math.floor(Math.min(56, (area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows));
			faces = { cols, rows, size, gap };
			b.faces = box(20, 70, cols * size + (cols - 1) * gap, rows * size + (rows - 1) * gap);
			b.instruction = box(20, b.faces.y + b.faces.h + 10, 180, 24);
			b.tools = box(20, b.instruction.y + b.instruction.h + 4, 180, 24);
			// the faces thrown again: a grid of REJECT cells (a face, its order badge
			// under it), as many rows as fit between the question and the info line
			b.dice = box(264, y, 58, h);
			b.rejected = box(200, 64, 2 * REJECT.w, 4 * REJECT.h);
			b.info = box(200, Math.max(y + h, b.rejected.y + b.rejected.h) + 6, 156, 14);
		}
		arrows.push(arrow("number", "brace", "number", "key", [[378, mid], [394, mid]]));
		if (file) arrows.push(arrow("slot", "number", "keySlot", "key", [[422, mid + 20], [422, RAIL], [352, RAIL], [352, SLOT.y]]));
		else {
			Object.assign(b, { keyDict: box(466, mid - 36, 116, 72), piece: box(598, mid - 25, 56, 50) });
			arrows.push(
				arrow("dict", "number", "keyDict", "key", [[450, mid], [466, mid]]),
				arrow("piece", "keyDict", "piece", "key", [[582, mid], [598, mid]]),
				arrow("slot", "piece", "keySlot", "key", [[626, mid + 25], [626, RAIL], [352, RAIL], [352, SLOT.y]]));
		}
		return { boxes: b, faces, arrows };
	}
	// A dictionary opened as buttons (vocab.js's picker): inside its card, under
	// its book's tab, a grid as square as the box allows; pickerCell: piece v's.
	function pickerGrid(b, N) {
		const tabH = Math.max(8, Math.min(14, Math.round(b.h * 0.18)));
		const inner = box(b.x + 2, b.y + tabH + 2, b.w - 4, b.h - tabH - 4);
		const cols = Math.max(1, Math.min(N, Math.ceil(Math.sqrt(N * inner.w / inner.h)))), rows = Math.max(1, Math.ceil(N / cols));
		return { tabH, inner, cols, rows, cw: inner.w / cols, ch: inner.h / rows };
	}
	function pickerCell(b, N, v) {
		const g = pickerGrid(b, N);
		return box(g.inner.x + (v % g.cols) * g.cw, g.inner.y + Math.floor(v / g.cols) * g.ch, g.cw, g.ch);
	}
	// face i's button in the faces' grid (row by row)
	function faceBox(lay, i) {
		const g = lay.faces, f = lay.boxes.faces;
		return box(f.x + (i % g.cols) * (g.size + g.gap), f.y + Math.floor(i / g.cols) * (g.size + g.gap), g.size, g.size);
	}
	// Where the thrown faces go. used: [{ at, from, to }] (the throw, and the
	// bits it gave: from … to − 1 of the tower), each on the tower's left beside
	// its bits, its order badge (badge: a ring round its number, two digits wide) before it and
	// a line joining it to them (join); rejected: [at], aside in a grid of REJECT
	// cells, the last ones that fit, each face (at least 24 units) with its order
	// badge and ↻ under it (badge, at least 14 units tall: its number BADGE units).
	function throwMarks(lay, { bits, used = [], rejected = [] }) {
		const t = lay.boxes.tower, d = lay.boxes.dice, r = lay.boxes.rejected, pitch = t.h / bits, B = USED_BADGE;
		const out = { used: used.map(({ at, from, to }) => {
			const y1 = t.y + from * pitch, y2 = t.y + to * pitch, cy = (y1 + y2) / 2, size = Math.min(30, y2 - y1 - 2);
			const fx = d.x + d.w - 6 - size, jx = t.x - 3;
			return { at, face: box(fx, cy - size / 2, size, size), badge: box(fx - 2 - B.w, cy - B.h / 2, B.w, B.h),
				join: [[fx + size, cy], [jx, cy]], span: [[jx, y1 + 2], [jx, y2 - 2]] };
		}), rejected: [] };
		const cols = Math.floor(r.w / REJECT.w), rows = Math.floor(r.h / REJECT.h), shown = rejected.slice(-cols * rows);
		out.rejected = shown.map((at, i) => {
			const x = r.x + (i % cols) * REJECT.w, y = r.y + Math.floor(i / cols) * REJECT.h;
			return { at, face: box(x + (REJECT.w - REJECT.face) / 2, y, REJECT.face, REJECT.face), badge: box(x, y + REJECT.face + 2, REJECT.w, REJECT.badge) };
		});
		return out;
	}
	// The key file's row with position pos in it, as it grows (the format of
	// writePadFile: `row` numbers a row in groups of `group`, then its check
	// character; S.PAD_ROW and S.PAD_GROUP): the x of each of its places and of
	// its check (the last), so that pos's place is under the middle of the
	// slot. pitch: one place; a space between groups and before the check.
	function fileRow(pos, { row = 16, group = 4, pitch = 14 } = {}) {
		const col = pos % row, gx = (j) => (j + Math.floor(j / group)) * pitch;
		const x0 = SLOT.x + SLOT.w / 2 - gx(col);
		return { row: Math.floor(pos / row), col, xs: Array.from({ length: row + 1 }, (_, j) => x0 + gx(j)) };
	}

	// A key file's characters around the turn, a column of 7 places like a
	// vertical string's (the same room at each end, so the middle place is
	// level with the turn's row): the icon on top; role "read" (recovering,
	// checking): each character on the left, its number beside it and its
	// place under that, and a ring to show the focus (ring); role
	// "reference" (making the copy): the place on the left, the character on
	// the right, the turn's place framed (frame).
	function fileColumn(b, { role = "read" } = {}) {
		const top = 14, pitch = (b.h - 2 * top) / 7, rows = [];
		if (role === "read") {
			// as a string read beside the seed's (readColumn, outer "right"): its number
			// on the inner side, the character in the middle, its place on the outer side
			const c = readColumn(b, { outer: "right", top });
			c.rows.forEach((r) => {
				const y = r.y, mid = (x) => x.x + x.w / 2;
				rows.push({ y, digit: [mid(r.piece), y + 6], value: [mid(r.value), y + 4.5], pos: [mid(r.pos), y + 3],
					digitBox: r.piece, valueBox: r.value, posBox: r.pos, ring: box(b.x + 2, y - pitch / 2 + 1, b.w - 4, pitch - 2) });
			});
			return { icon: [c.icon[0], b.y + 7], pitch, rows };
		}
		for (let j = 0; j < 7; j++) {
			const y = b.y + top + pitch * (j + 0.5);
			rows.push({ y, pos: [b.x + 9, y + 3], digit: [b.x + 25, y + 5], frame: box(b.x, y - pitch / 2 + 0.5, b.w, pitch - 1) });
		}
		return { icon: [b.x + b.w / 2, b.y + 11], pitch, rows };
	}

	// Storing it. With a key, two places (a, b) apart, a red dashed border
	// between them (border) and «never together» over it (apart); each place
	// its title, its string (or the key file), its dictionary, a note and
	// «Saved». With no key, the string's place (a) and the dictionary's,
	// apart (d: no string, its dictionary under its title). At the foot,
	// «Forget everything on this device» (forget). file: a key file in B's
	// string box, as it starts: its icon, its sheet, and where each of its
	// first three lines goes (lines: their start, left and baseline).
	function store({ pad }) {
		const top = 82, h = 214;
		const b = { guide: { ...GUIDE }, question: box(150, 28, 380, 32), forget: box(190, 314, 300, 28) };
		const place = (id, p) => Object.assign(b, { [id]: p,
			[id + "Title"]: box(p.x + 10, p.y + 6, p.w - 20, 20),
			[id + "String"]: box(p.x + 10, p.y + 30, p.w - 20, 46),
			[id + "Dict"]: box(p.x + 10, p.y + 84, 110, 96),
			[id + "Note"]: box(p.x + 130, p.y + 84, p.w - 140, 96),
			[id + "Saved"]: box(p.x + 10, p.y + h - 30, p.w - 20, 24) });
		if (pad) {
			place("a", box(20, top, 300, h));
			place("b", box(360, top, 300, h));
			Object.assign(b, { border: box(338, top, 4, h), apart: box(280, 62, 120, 16) });
			const f = b.bString, sheet = box(f.x + 20, f.y + 1, f.w - 22, f.h - 2);
			const file = { icon: box(f.x, f.y + f.h / 2 - 9, 16, 18), sheet, lines: [0, 1, 2].map((j) => [sheet.x + 8, sheet.y + 13 + j * 13]) };
			return { boxes: b, file, arrows: [] };
		}
		place("a", box(20, top, 400, h));
		const d = box(450, top, 210, h);
		Object.assign(b, { d, dTitle: box(d.x + 10, d.y + 6, d.w - 20, 20), dDict: box(d.x + 10, d.y + 30, d.w - 20, 110),
			dNote: box(d.x + 10, d.y + 146, d.w - 20, 34), dSaved: box(d.x + 10, d.y + h - 30, d.w - 20, 24) });
		return { boxes: b, arrows: [] };
	}

	// ---- your own dictionary ---------------------------------------------
	// v's bits, as many as a number below n takes (bitsOf), the first the highest
	const binary = (v, n) => { const k = bitsOf(n); return Array.from({ length: k }, (_, j) => (v >> (k - 1 - j)) & 1); };
	// the question, big and centred under the guide
	const QUESTION = box(150, 28, 380, 32);
	// Naming a piece: on the left the dictionary's box filling up; in the centre
	// the number, big, and its bits under it; on the right the piece, and under
	// it the form (its name, Colour, Photo, what is wrong).
	function dictName({ n }) {
		const bw = bitsOf(n) * 28 + 8;
		return { boxes: {
			guide: { ...GUIDE }, question: { ...QUESTION },
			dict: box(24, 70, 196, 268),
			number: box(244, 104, 184, 72),
			bits: box(336 - bw / 2, 188, bw, 28),
			piece: box(452, 66, 204, 128),
			form: box(452, 202, 204, 132),
			tipPiece: box(236, 276, 204, 58),
			tipOrder: box(236, 224, 204, 44),
		}, arrows: [] };
	}
	// Checking a piece: the box on the left, the piece in the centre, its
	// number to tap on the right (a grid: cols × rows), and what is wrong under it.
	function dictCheck({ n }) {
		const cols = n <= 4 ? n : n <= 16 ? 4 : 8;
		return { boxes: {
			guide: { ...GUIDE }, question: { ...QUESTION },
			dict: box(24, 70, 196, 268),
			piece: box(236, 76, 196, 230),
			answers: box(452, 70, 206, 268),
		}, answers: { cols, rows: Math.ceil(n / cols) }, arrows: [] };
	}
	// The dictionary as it is: its box on the left (in two columns past 16
	// pieces, so every row shows), then whether it is checked, and its actions.
	function dictAsIs({ n }) {
		// two equal columns margin to margin: the list on the left (two inner ones past 16), the notice and the buttons on the right
		const columns = n > 16 ? 2 : 1, w = (648 - 24) / 2, x = 16 + w + 24, top = 70, room = 334 - top;
		const statusH = 44, gap = 12, actionsH = 200, y0 = top + (room - (statusH + gap + actionsH)) / 2;
		return { boxes: {
			guide: { ...GUIDE }, question: { ...QUESTION },
			dict: box(16, top, w, room),
			status: box(x, y0, w, statusH),
			actions: box(x, y0 + statusH + gap, w, actionsH),
		}, columns, arrows: [] };
	}

	// the spacing of a string's pieces in a box (vocab.js's string)
	function pitch(b, count, { vertical = false, room } = {}) {
		const pad = room !== undefined ? room : vertical ? Math.min(14, b.h * 0.08) : Math.min(20, b.w * 0.04);
		return ((vertical ? b.h : b.w) - 2 * pad) / count;
	}
	// the bounding rectangle of QR cells [r, c] in a box, as vocab.js's qr places
	// them (side = min(w, h), centred), 2 units out on each side; null if none
	function qrCellsBox(b, size, cells) {
		if (!cells.length) return null;
		const side = Math.min(b.w, b.h), cs = side / size, x0 = b.x + (b.w - side) / 2, y0 = b.y + (b.h - side) / 2;
		const rs = cells.map((c) => c[0]), cols = cells.map((c) => c[1]);
		const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cols), c1 = Math.max(...cols);
		return box(x0 + c0 * cs - 2, y0 + r0 * cs - 2, (c1 - c0 + 1) * cs + 4, (r1 - r0 + 1) * cs + 4);
	}
	// The seed as a QR: its words, their number, the QR, left to right (toWords:
	// the other way round); end: with the fingerprint and a note under the words.
	// the font (in canvas units) for the seed's number in its box: its lines (of `chars` characters each) and
	// the «bits» line under them fit the box, never bigger than 16
	function digitFont(b, chars, lines) {
		return Math.floor(Math.min(16, (b.w - 8) / (chars * 0.62), b.h / ((lines + 1.6) * 1.25)) * 10) / 10;
	}
	function seedQr({ toWords = false, end = false } = {}) {
		// the question on one line over everything; the words and the number centred on the arrows' line (y 165)
		const b = { guide: { ...GUIDE }, question: box(16, 28, 648, 32),
			words: box(16, 75, 200, 180),
			number: box(240, 100, 184, 130), qr: box(448, 68, 216, 216) };
		if (end) Object.assign(b, { fingerprint: box(16, 256, 200, 28), note: box(16, 290, 408, 44) });
		const arrows = toWords
			? [arrow("qr>number", "qr", "number", "qr", [[448, 165], [424, 165]]), arrow("number>words", "number", "words", "qr", [[240, 165], [216, 165]])]
			: [arrow("words>number", "words", "number", "qr", [[216, 165], [240, 165]]), arrow("number>qr", "number", "qr", "qr", [[424, 165], [448, 165]])];
		return { boxes: b, arrows };
	}

	return { BUILT, SLOT, RAIL, pitch, qrCellsBox, digitFont, seedQr, VIEW, BIT, bitsOf, binary, route, segmentHitsBox, clockModule, makeTurn, readColumn, readTurn, pickerPopup, checkFinal, keyThrow, pickerGrid, pickerCell, faceBox, throwMarks, REJECT, BADGE, fileRow, fileColumn, store, dictName, dictCheck, dictAsIs };
})();
