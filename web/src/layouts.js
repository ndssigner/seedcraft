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
	const BUILT = box(20, 280, 640, 60), SLOT = box(316, 280, 48, 60);
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
			qr: box(20, 45, 95, 95),
			bits: box(135, 56, bits * BIT, BIT),
			number: box(135, 94, 60, 36),
			seedString: { ...BUILT },
			seedSlot: { ...SLOT },
			guide: { ...GUIDE },
		};
		const arrows = [
			arrow("position", "seedSlot", "qr", "qr", [[328, 280], [328, 268], [67, 268], [67, 140]]),
			arrow("bits", "qr", "bits", "qr", [[115, 67], [135, 67]]),
			arrow("number", "bits", "number", "qr", [[155, 78], [155, 94]]),
		];
		if (!pad) {
			b.seedDict = box(297, 76, 86, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[195, 112], [297, 112]]),
				arrow("slot", "seedDict", "seedSlot", "qr", [[352, 148], [352, 280]]));
			return { boxes: b, arrows };
		}
		// the key string is a reference: vertical, its turn piece in the middle (y 131)
		Object.assign(b, {
			keyString: box(268, 40, 34, 182),
			clock: box(452, 50, 140, 136),
			seedDict: box(479, 202, 86, 62),
		});
		const keyIn = clockModule(b.clock).inputs[1], keyX = keyIn.x + keyIn.w / 2;
		// The key's number must reach its own (right) cell, so it goes over the
		// top; the key string stands between the seed's number and the module, so
		// the seed's can only go under it and up the outer corridor into the left
		// cell: any route over the top would cross the key's.
		const clockSeed = arrow("clockSeed", "number", "clock", "qr", [[165, 130], [165, 240], [436, 240], [436, 63], [452, 63]]);
		const clockKey = (y) => arrow("clockKey", "keyNumber", "clock", "key", [[406, y], [420, y], [420, 38], [keyX, 38], [keyX, keyIn.y]]);
		if (file) {
			// the file's row → its number, level with it
			b.keyNumber = box(320, 116, 86, 30);
			arrows.push(arrow("keyNumber", "keyString", "keyNumber", "key", [[302, 131], [320, 131]]), clockSeed, clockKey(131));
		} else {
			Object.assign(b, { keyDict: box(320, 95, 86, 72), keyNumber: box(320, 183, 86, 30) });
			arrows.push(
				arrow("keyPiece", "keyString", "keyDict", "key", [[302, 131], [320, 131]]),
				arrow("keyNumber", "keyDict", "keyNumber", "key", [[363, 167], [363, 183]]),
				clockSeed, clockKey(198));
		}
		arrows.push(
			arrow("output", "clock", "seedDict", "qr", [[522, 186], [522, 202]]),
			arrow("slot", "seedDict", "seedSlot", "qr", [[522, 264], [522, 266], [352, 266], [352, 280]]));
		return { boxes: b, arrows };
	}

	// The turn while recovering: what is built is the QR, large on the right.
	// The strings read are vertical and side by side on the left, 7 pieces each,
	// the turn's row (the middle one) framed, with a "+" slot per string; every
	// arrow leaves from that frame, each down its own corridor (x 188, 200, 212).
	function readTurn({ pad, n }) {
		const bits = bitsOf(n), piece = 41, top = 40, rowY = top + 3 * piece;
		const b = {
			seedColumn: box(20, top, 70, 7 * piece),
			seedSlot: box(24, rowY + 2, 36, piece - 4),
			qr: box(490, 75, 170, 170),
			guide: { ...GUIDE },
		};
		const toQr = (x) => [[x, 40], [b.qr.x + 16, 40], [b.qr.x + 16, b.qr.y]];   // into the QR near its left edge: the shortest way over the clock
		if (!pad) {
			b.row = box(14, rowY, 82, piece);
			const y = rowY + 27;
			b.bits = box(220, y - BIT / 2, bits * BIT, BIT);
			return { boxes: b, arrows: [
				arrow("position", "row", "qr", "qr", [[96, rowY + 9], [110, rowY + 9], ...toQr(110)]),
				arrow("bits", "row", "bits", "qr", [[96, y], [220, y]]),
				arrow("paint", "bits", "qr", "qr", [[220 + bits * BIT, y], [b.qr.x, y]]),
			] };
		}
		Object.assign(b, {
			keyColumn: box(100, top, 70, 7 * piece),
			keySlot: box(104, rowY + 2, 36, piece - 4),
			row: box(14, rowY, 162, piece),
			clock: box(228, 90, 120, 150),
		});
		const m = clockModule(b.clock), [seedIn, keyIn] = m.inputs;
		const outY = Math.round(m.output.y + m.output.h / 2), keyX = keyIn.x + keyIn.w / 2;
		b.bits = box(364, outY - BIT / 2, bits * BIT, BIT);
		// the key's number goes over the top into its own (right) cell
		return { boxes: b, arrows: [
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
	// Recovering, the end: the seed's QR code, whole and large, on the left; on
	// the right what was found (and how it was read), its words, its fingerprint,
	// and a note (where it is, what was put right).
	function readFinal() {
		return { boxes: {
			guide: { ...GUIDE },
			qr: box(24, 36, 290, 290),
			title: box(340, 40, 316, 30),
			words: box(340, 76, 316, 176),
			fingerprint: box(340, 258, 316, 40),
			note: box(340, 302, 316, 44),
		}, arrows: [] };
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
			result: box(24, 272, 466, 70),
			seedColumn: box(510, top, 70, 7 * piece), seedRow: box(510, rowY, 70, piece),
		};
		if (pad) Object.assign(b, { keyColumn: box(590, top, 70, 7 * piece), keyRow: box(590, rowY, 70, piece) });
		return { boxes: b, arrows: [] };
	}

	// The key's throw: the faces as buttons on the left (a coin's 2 up to a
	// d20's 20, in a grid as square as the space allows), the instruction and
	// the tools (undo, fix) under them, the bit tower in the middle with the
	// faces that count on its left (dice) and those thrown again aside
	// (rejected), the ⓘ under it (info), then brace → number → the key's
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
					arrow("slot", "number", "keySlot", "key", [[422, mid + 20], [422, 266], [352, 266], [352, 280]]));
			} else {
				b.instruction = box(380, 120, 260, 24); b.tools = box(380, 150, 260, 24);
				arrows.push(arrow("slot", "picker", "keySlot", "key", [[cx, bottom], [cx, 266], [352, 266], [352, 280]]));
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
			b.dice = box(270, y, 52, h);
			b.rejected = box(222, Math.min(y, mid - 33), 44, Math.max(h, 66));
			b.info = box(222, Math.max(y + h, b.rejected.y + b.rejected.h) + 6, 136, 14);
		}
		arrows.push(arrow("number", "brace", "number", "key", [[378, mid], [394, mid]]));
		if (file) arrows.push(arrow("slot", "number", "keySlot", "key", [[422, mid + 20], [422, 266], [352, 266], [352, 280]]));
		else {
			Object.assign(b, { keyDict: box(466, mid - 36, 86, 72), piece: box(568, mid - 25, 76, 50) });
			arrows.push(
				arrow("dict", "number", "keyDict", "key", [[450, mid], [466, mid]]),
				arrow("piece", "keyDict", "piece", "key", [[552, mid], [568, mid]]),
				arrow("slot", "piece", "keySlot", "key", [[606, mid + 25], [606, 266], [352, 266], [352, 280]]));
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
	// its bits, its order number (label: its end, right-aligned) before it and a
	// line joining it to them (join); rejected: [at], aside in a grid of 22 ×
	// 22, the last ones that fit, each with its order number under it (label).
	function throwMarks(lay, { bits, used = [], rejected = [] }) {
		const t = lay.boxes.tower, d = lay.boxes.dice, r = lay.boxes.rejected, pitch = t.h / bits;
		const out = { used: used.map(({ at, from, to }) => {
			const y1 = t.y + from * pitch, y2 = t.y + to * pitch, cy = (y1 + y2) / 2, size = Math.min(30, y2 - y1 - 2);
			const fx = d.x + d.w - 8 - size, jx = t.x - 3;
			return { at, face: box(fx, cy - size / 2, size, size), label: [fx - 2, cy + 3.5],
				join: [[fx + size, cy], [jx, cy]], span: [[jx, y1 + 2], [jx, y2 - 2]] };
		}), rejected: [] };
		const cols = Math.floor(r.w / 22), rows = Math.floor(r.h / 22), shown = rejected.slice(-cols * rows);
		out.rejected = shown.map((at, i) => {
			const x = r.x + (i % cols) * 22, y = r.y + Math.floor(i / cols) * 22;
			return { at, face: box(x + 4, y, 14, 14), label: [x + 11, y + 21] };
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
			form: box(452, 202, 204, 140),
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
		const columns = n > 16 ? 2 : 1, w = 196 * columns, x = 24 + w + 24;
		return { boxes: {
			guide: { ...GUIDE }, question: { ...QUESTION },
			dict: box(24, 70, w, 268),
			status: box(x, 70, VIEW.w - 24 - x, 44),
			actions: box(x, 126, VIEW.w - 24 - x, 212),
		}, columns, arrows: [] };
	}

	return { VIEW, BIT, bitsOf, binary, route, segmentHitsBox, clockModule, makeTurn, readTurn, pickerPopup, readFinal, checkFinal, keyThrow, pickerGrid, pickerCell, faceBox, throwMarks, fileRow, dictName, dictCheck, dictAsIs };
})();
