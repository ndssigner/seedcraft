// SeedCraft, the web tool's slides: the pure geometry of each slide
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
			// the centre of the formula's line, under the box
			formula: { x: b.x + half, y: b.y + b.h + 9 },
		};
	}

	const arrow = (id, from, to, colour, points) => ({ id, from, to, colour, points });

	// The string being built (the seed in its turn, the key in its throw) is one
	// element: bottom, full width, 13 pieces, the turn's slot in the middle.
	const BUILT = box(16, 276, 648, 58), SLOT = box(316, 276, 48, 58);
	// the y where the arrows run before dropping into the slot
	const RAIL = 262;
	// the turn's position, in its own box above the slot's left; the cycle starts here
	const POSBOX = box(326, 258, 28, 16);
	// the slide's fixed top band, the guide on the left and «?» «⋯» on the right: nothing else goes there
	const GUIDE = box(0, 0, VIEW.w, 26);

	// The last turns' cards (spec §8): where their bits come from when they are no
	// longer squares of the QR, in a column x … x + w: the format version on top, the
	// QR's mask in the middle (level with the QR's format row 8: the QRs of
	// makeHeaderTurn and readTurn's header keep it there), the padding under it. parts: those the turn brings (they always
	// follow one another); one alone takes the middle place, so the column's middle
	// (CARDS_MID) always has a card. cards: the column, as tall as its cards.
	const HEADER_PARTS = ["version", "mask", "padding"];
	const CARD_SLOT = { version: [27, 48], mask: [78, 72], padding: [154, 52] }, CARDS_MID = 116;
	const cardId = (p) => "card" + p[0].toUpperCase() + p.slice(1);
	function headerCards(b, x, w, header) {
		const parts = HEADER_PARTS.filter((p) => header === true || header.includes(p));
		parts.forEach((p) => { const [y, h] = parts.length === 1 ? CARD_SLOT.mask : CARD_SLOT[p]; b[cardId(p)] = box(x, y, w, h); });
		const top = Math.min(...parts.map((p) => b[cardId(p)].y)), bottom = Math.max(...parts.map((p) => b[cardId(p)].y + b[cardId(p)].h));
		b.cards = box(x, top, w, bottom - top);
		return parts;
	}
	// the mask's arrow: out of the QR's right edge level with its format row 8 (where the
	// mask is written, the cursor on it: S.turnCursor), touching no square, straight into
	// its card's left edge (amber, as the QR's fixed areas)
	const maskArrow = (b, size) => arrow("mask", "qr", "cardMask", "key", [[b.qr.x + b.qr.w, b.qr.y + 8.5 * b.qr.h / size], [b.cardMask.x, b.qr.y + 8.5 * b.qr.h / size]]);

	// The one-time bubble that says why the mask is what it is (a turn that brings it): over a free place
	// near the cards (it may cover an arrow while it is open), its tail to the cards' column: dir the side
	// the tail is on, at where along that side (from the bubble's top or left).
	const MASK_TIP = {
		make: { box: box(284, 36, 330, 60), dir: "left", at: 54 }, makePad: { box: box(16, 208, 300, 52), dir: "up", at: 134 },
		read: { box: box(444, 208, 220, 70), dir: "up", at: 156 }, readPad: { box: box(504, 208, 160, 90), dir: "up", at: 96 },
	};
	const withMaskTip = (lay, header, tip) => { if (header === true || (header && header.includes("mask"))) lay.maskTip = { ...tip, box: { ...tip.box } }; return lay; };

	// The turn while making the copy. Bottom to top, left to right: the seed
	// string being built, its slot's position → the QR → its bits → their
	// number; with a key, the key string's piece → its dictionary → its number,
	// both numbers → the clock → the seed's dictionary → the slot.
	// file: the key is a file, so its column holds the file's characters and
	// its number comes straight from the turn's row (no key dictionary).
	// header: a last turn (true, or the parts it brings: "version", "mask",
	// "padding"): makeHeaderTurn's. data, size: there.
	function makeTurn({ pad, n, file = false, header = false, data = false, size = 21 }) {
		if (header) return withMaskTip(makeHeaderTurn({ pad, n, file, header, data, size }), header, pad ? MASK_TIP.makePad : MASK_TIP.make);
		const bits = bitsOf(n);
		const b = {
			qr: box(16, 36, 180, 180),
			bits: box(212, 56, bits * BIT, BIT),
			number: box(212, 94, 72, 40),
			seedString: { ...BUILT },
			seedSlot: { ...SLOT },
			posBox: { ...POSBOX },
			guide: { ...GUIDE },
		};
		const arrows = [
			arrow("position", "posBox", "qr", "pos", underQr(b.qr, 266)),
			arrow("bits", "qr", "bits", "qr", [[196, 67], [212, 67]]),
			arrow("number", "bits", "number", "qr", [[232, 78], [232, 94]]),
		];
		if (!pad) {
			b.seedDict = box(400, 76, 140, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[284, 112], [400, 112]]),
				arrow("slot", "seedDict", "seedSlot", "qr", [[470, 148], [470, RAIL], [360, RAIL], [360, SLOT.y]]));
			return { boxes: b, arrows };
		}
		// the key string is a reference: vertical, its turn piece in the middle (y 126)
		Object.assign(b, {
			keyString: box(336, 36, 34, 180),
			clock: box(520, 44, 128, 124),
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
			arrow("output", "clock", "seedDict", "qr", [[645, 168], [645, 196]]),
			arrow("slot", "seedDict", "seedSlot", "qr", [[584, 256], [584, RAIL], [360, RAIL], [360, SLOT.y]]));
		return { boxes: b, arrows };
	}

	// A last turn while making the copy: its bits are no longer (all) squares of the
	// QR. The QR smaller, on the left; the cards in a column between it and the
	// bits, the mask's from the QR's format band; the column → the bits (level with
	// the middle card). data: the turn also has its last data squares, so the
	// position still goes to the QR (to its bottom, as always) and the QR's bits
	// go over the top into the bits. Then as usual: the number under the bits,
	// → the dictionary (with a key, the clock) → the slot. size: the QR's (21 or 25).
	function makeHeaderTurn({ pad, n, file, header, data, size }) {
		const bw = bitsOf(n) * BIT;
		// (with a key the bits must end before its string: all of it narrower)
		// (the arrows between the QR, the cards and the bits run at least 24 to be seen)
		const [qr, cx, cw, bx] = pad ? [box(16, 70, 60, 60), 100, 100, 224] : [box(16, 50, 112, 112), 152, 108, 284];
		const b = { qr, bits: box(bx, CARDS_MID - BIT / 2, bw, BIT), number: box(bx, 143, 72, 40),
			seedString: { ...BUILT }, seedSlot: { ...SLOT }, posBox: { ...POSBOX }, guide: { ...GUIDE } };
		const parts = headerCards(b, cx, cw, header), qx = qr.x + qr.w / 2, mid = bx + bw / 2;
		const arrows = [];
		if (data) arrows.push(arrow("position", "posBox", "qr", "pos", [[326, 266], [qx, 266], [qx, qr.y + qr.h]]));
		if (parts.includes("mask")) arrows.push(maskArrow(b, size));
		arrows.push(arrow("cards", "cards", "bits", "qr", [[cx + cw, CARDS_MID], [bx, CARDS_MID]]));
		if (data) arrows.push(arrow("bits", "qr", "bits", "qr", [[qx, qr.y], [qx, 30], [mid, 30], [mid, b.bits.y]]));
		arrows.push(arrow("number", "bits", "number", "qr", [[bx + 20, b.bits.y + BIT], [bx + 20, 143]]));
		if (!pad) {
			b.seedDict = box(400, 127, 140, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[bx + 72, 163], [400, 163]]),
				arrow("slot", "seedDict", "seedSlot", "qr", [[470, 199], [470, RAIL], [360, RAIL], [360, SLOT.y]]));
			return { boxes: b, arrows };
		}
		// with a key, as makeTurn's (the seed's number leaves from its own place, under the bits)
		const usual = makeTurn({ pad, n, file });
		for (const id of ["keyString", "clock", "seedDict", "keyNumber", "keyDict"]) if (usual.boxes[id]) b[id] = usual.boxes[id];
		const keep = (id) => usual.arrows.find((a) => a.id === id);
		arrows.push(...usual.arrows.filter((a) => ["keyPiece", "keyNumber"].includes(a.id)),
			arrow("clockSeed", "number", "clock", "qr", [[bx + 36, 183], [bx + 36, 236], [506, 236], [506, 56], [520, 56]]),
			keep("clockKey"), keep("output"), keep("slot"));
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
	// The glide between two drawings of a column (an adjacent Next or Back), measured, not assumed:
	// was, now: { ys: each row's y in that drawing, turn: the turn it showed, current: the turn's row (3) };
	// place x is in row x − turn + current. For every place both drawings show, its old y less its new y:
	// the one shift the run starts at, so each piece is first drawn where it was (0: it does not move);
	// null if the places do not all agree (the run cannot glide as one: it does not glide).
	function placeShift(was, now) {
		const cw = was.current === undefined ? 3 : was.current, cn = now.current === undefined ? 3 : now.current;
		let shift = null;
		for (let j = 0; j < was.ys.length; j++) {
			const x = j - cw + was.turn, k = x - now.turn + cn;
			if (k < 0 || k >= now.ys.length) continue;
			const d = was.ys[j] - now.ys[k];
			if (shift === null) shift = d;
			else if (Math.abs(d - shift) > 1e-6) return null;
		}
		return shift;
	}

	// The turn read back (recovering, checking): what is built is the QR, on
	// the right. The strings read are vertical on the left, 7 pieces each, the
	// turn's row (the middle one) framed; the turn's position in its own box
	// (posBox) beside the seed's row, from where «position» goes over the top
	// (y 32, under the guide band) and down into the QR's top edge above the
	// cursor. The row's piece goes straight into its dictionary, then its
	// number, then the bits, which go under the QR and up its outer side
	// (x 654) into its right edge as drawn, level with the cursor. cursor: the turn's
	// qrCellsBox in the qr box (null for the header and the padding, which
	// have no squares: no «position», no «paint»).
	// With a key: its column beside the seed's (the posBox between the two,
	// on the seed's row); its piece into its dictionary, stacked over the
	// seed's, its number over the top into the clock's right cell, the seed's
	// straight into the left one; the clock's output → the bits. The seed's
	// piece leaves from its own side of the row (x 90), down the seed column's
	// edge and under the key's (y 331), up into its dictionary. The key's
	// dictionary goes over the seed's: the key's chain must run outside the
	// seed's, or one would cross the other (or the bits' way to the QR).
	// file: the key is a file, its number straight from the row (no key dictionary).
	// header: a last turn (true, or the parts it brings), as makeTurn's: the QR
	// smaller (90, at x 410) with the cards' column on its right, the mask's from
	// its format band; the bits at the bottom right (with a key, out of the clock
	// as usual), from where they go up into the column (bits → cards: reading,
	// they go to their cards, not to the QR). With data squares (cursor), the
	// position over the top as usual, and «paint» up a corridor between the QR
	// and the column into the QR's right edge beside the cursor. With a key the
	// key's number goes under the QR into the clock. size: the QR's.
	function readTurn(o) {
		return withMaskTip(readTurnBase(o), o.header, o.pad ? MASK_TIP.readPad : MASK_TIP.read);
	}
	function readTurnBase({ pad, n, file = false, cursor = null, header = false, size = 21 }) {
		const bits = bitsOf(n), bw = bits * BIT, piece = 41, top = 40, rowY = top + 3 * piece, TOP = 32, OUTER = 654;
		const seedColumn = box(20, top, 70, 7 * piece), seed = readColumn(seedColumn, { outer: "left" });
		const slotIn = (c) => box(c.rows[3].piece.x, rowY + 2, c.rows[3].piece.w, piece - 4);
		const b = { seedColumn, seedSlot: slotIn(seed), guide: { ...GUIDE } };
		const columns = { seed };
		// over the top into the QR above the cursor; under it and up its outer side into it beside the cursor
		const position = () => {
			const x = b.posBox.x + b.posBox.w / 2, cx = Math.round(cursor.x + cursor.w / 2);
			return arrow("position", "posBox", "qr", "pos", [[x, b.posBox.y], [x, TOP], [cx, TOP], [cx, b.qr.y]]);
		};
		// (into the QR as drawn: with its legend, the rule V.qr follows from 150 high, it is narrower than its box)
		const paint = (from) => {
			const q = qrSquare(b.qr, { legend: b.qr.h >= 150 }), cy = Math.round(cursor.y + cursor.h / 2), right = q.x + q.w;
			return arrow("paint", "bits", "qr", "qr", [from, [OUTER, from[1]], [OUTER, cy], [right, cy]]);
		};
		const HB = { x: 520, y: 304 };   // a last turn's bits: under the cards' column (with a key, beside the clock's output)
		const ends = (list) => {
			if (!header) return cursor ? [position(), ...list, paint(list.end)] : list;
			// the cards' column on the QR's right; the bits under it, into its bottom
			b.qr = box(410, 60, 90, 90);
			b.bits = box(HB.x, HB.y, bw, BIT);
			const parts = headerCards(b, 540, 116, header), by = HB.y + BIT / 2, up = HB.x + bw / 2, qrRight = b.qr.x + b.qr.w;
			const out = cursor ? [position(), ...list] : [...list];
			if (cursor) {
				const cy = Math.round(cursor.y + cursor.h / 2);
				out.push(arrow("paint", "bits", "qr", "qr", [[up, HB.y], [up, 280], [qrRight + 16, 280], [qrRight + 16, cy], [qrRight, cy]]));
			}
			out.push(arrow("cards", "bits", "cards", "qr", [[HB.x + bw, by], [648, by], [648, b.cards.y + b.cards.h]]));
			if (parts.includes("mask")) out.push(maskArrow(b, size));
			return out;
		};
		if (!pad) {
			Object.assign(b, {
				row: box(16, rowY, 80, piece),
				posBox: box(100, rowY + 2, 28, 18),
				seedDict: box(224, 176, 110, 66),
				number: box(350, 191, 52, 36),
				qr: box(460, 46, 180, 180),
			});
			b.bits = box(376 - bw / 2, 260, bw, BIT);   // centred under the number
			const list = [
				arrow("piece", "row", "seedDict", "qr", [[96, rowY + 29], [224, rowY + 29]]),
				arrow("number", "seedDict", "number", "qr", [[334, 209], [350, 209]]),
				// (a last turn: its bits at the bottom right, under the cards)
				header ? arrow("bits", "number", "bits", "qr", [[376, 227], [376, HB.y + BIT / 2], [HB.x, HB.y + BIT / 2]])
					: arrow("bits", "number", "bits", "qr", [[376, 227], [376, 260]]),
			];
			list.end = [376 + bw / 2, 260 + BIT / 2];
			return { boxes: b, columns, arrows: ends(list) };
		}
		const keyColumn = box(128, top, 70, 7 * piece);
		columns.key = readColumn(keyColumn, { outer: "right" });
		Object.assign(b, {
			keyColumn,
			keySlot: slotIn(columns.key),
			row: box(16, rowY, 186, piece),
			posBox: box(96, rowY + 2, 28, 18),
			seedDict: box(224, 176, 110, 66),
			number: box(350, 191, 52, 36),
			keyNumber: box(350, 111, 52, 36),
			clock: box(418, 200, 80, 114),
			qr: box(490, 46, 150, 150),
		});
		if (!file) b.keyDict = box(224, 96, 110, 66);
		const m = clockModule(b.clock), [seedIn, keyIn] = m.inputs;
		const keyX = keyIn.x + keyIn.w / 2, outY = Math.round(m.output.y + m.output.h / 2), seedRight = seedColumn.x + seedColumn.w, BOTTOM = 331;
		b.bits = box(514, outY - BIT / 2, bw, BIT);
		const list = [
			// the seed's piece from its own side of the row: down the seed column's edge, under the key's, up into its dictionary
			arrow("piece", "row", "seedDict", "qr", [[seedRight, rowY + piece], [seedRight, BOTTOM], [279, BOTTOM], [279, b.seedDict.y + b.seedDict.h]]),
			arrow("number", "seedDict", "number", "qr", [[334, 209], [350, 209]]),
			...(file ? [arrow("keyNumber", "row", "keyNumber", "key", [[202, rowY + 9], [212, rowY + 9], [212, 129], [350, 129]])]
				: [arrow("keyPiece", "row", "keyDict", "key", [[202, rowY + 9], [212, rowY + 9], [212, 129], [224, 129]]),
					arrow("keyNumber", "keyDict", "keyNumber", "key", [[334, 129], [350, 129]])]),
			arrow("clockSeed", "number", "clock", "qr", [[402, 209], [seedIn.x, 209]]),
			// (a last turn: under its QR, which stands where this way usually runs)
			header ? arrow("clockKey", "keyNumber", "clock", "key", [[390, 147], [390, 170], [keyX, 170], [keyX, keyIn.y]])
				: arrow("clockKey", "keyNumber", "clock", "key", [[402, 129], [keyX, 129], [keyX, keyIn.y]]),
			arrow("bits", "clock", "bits", "qr", [[b.clock.x + b.clock.w, outY], [header ? HB.x : 514, outY]]),
		];
		list.end = [514 + bw, outY];
		return { boxes: b, columns, arrows: ends(list) };
	}

	// Choosing a piece while reading (a "+" tapped): the string's dictionary
	// opened as buttons in a popup, under its question; its own canvas (view),
	// lower the fewer kinds there are, so every button stays big enough to tap.
	function pickerPopup({ n }) {
		const view = { w: 420, h: n <= 4 ? 110 : n <= 8 ? 160 : 200 };
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
			// the result; in it, when there are things to do, its line and under it the actions (or a note)
			result: box(24, 272, 466, 62), resultLine: box(24, 272, 466, 28), actions: box(24, 302, 466, 32),
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
	// faces. file: the key is a file, so the number goes through the file's
	// dictionary (number → character) to its place in the file (no piece).
	// tips: the intro's bubbles, when the faces are thrown by hand.
	function keyThrow({ sides = 6, bits = 5, tool = "dice", file = false, n = 2 ** bits, value = null }) {
		const mid = 70 + 5 * BIT / 2, h = bits * BIT, y = mid - h / 2;
		const b = { guide: { ...GUIDE }, question: box(190, 30, 300, 30), keyString: { ...BUILT }, keySlot: { ...SLOT }, posBox: { ...POSBOX } };
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
					arrow("slot", "number", "keySlot", "key", [[422, mid + 20], [422, RAIL], [360, RAIL], [360, SLOT.y]]));
			} else {
				b.instruction = box(380, 120, 260, 24); b.tools = box(380, 150, 260, 24);
				// (its rail runs above the posBox, which the picker is to the left of)
				arrows.push(arrow("slot", "picker", "keySlot", "key", [[cx, bottom], [cx, POSBOX.y - 4], [360, POSBOX.y - 4], [360, SLOT.y]]));
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
		// (a file's is wider, for its longer label: «Diccionario del archivo» whole on its tab)
		b.keyDict = box(466, mid - 36, file ? 168 : 116, 72);
		arrows.push(arrow("dict", "number", "keyDict", "key", [[450, mid], [466, mid]]));
		if (file) {
			// the file's dictionary (number → character), then down to its place in the
			// file; the file's box a little taller, for the line under its row
			b.keyString = box(BUILT.x, BUILT.y, BUILT.w, 70);
			arrows.push(arrow("slot", "keyDict", "keySlot", "key", [[550, mid + 36], [550, RAIL], [360, RAIL], [360, SLOT.y]]));
		} else {
			b.piece = box(598, mid - 25, 56, 50);
			arrows.push(
				arrow("piece", "keyDict", "piece", "key", [[582, mid], [598, mid]]),
				arrow("slot", "piece", "keySlot", "key", [[626, mid + 25], [626, RAIL], [360, RAIL], [360, SLOT.y]]));
		}
		// the intro's bubbles, thrown by hand (spec §6): beside the faces (what to do; with
		// faces thrown again, why), under the tower and under the piece (or the file's
		// dictionary), each its tail («left», or «up» at `at` from its left) at what it explains.
		// Before the first throw the room beside the faces (the faces thrown again) is empty.
		let tips;
		if (faces) {
			const to = b.piece || b.keyDict, tw = b.tower;
			tips = { faces: { box: box(208, 64, 116, 54), side: "left" },
				tower: { box: box(tw.x, 192, 150, 44), side: "up", at: tw.w / 2 },
				piece: { box: box(486, 172, 178, 56), side: "up", at: to.x + to.w / 2 - 486 } };
			if (2 ** Math.floor(Math.log2(sides)) < sides) tips.reroll = { box: box(208, 124, 116, 92), side: "left" };
		}
		return { boxes: b, faces, arrows, tips };
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
			return { icon: [c.icon[0], b.y + 7], pitch, top, rows };
		}
		for (let j = 0; j < 7; j++) {
			const y = b.y + top + pitch * (j + 0.5);
			rows.push({ y, pos: [b.x + 9, y + 3], digit: [b.x + 25, y + 5], frame: box(b.x, y - pitch / 2 + 0.5, b.w, pitch - 1) });
		}
		return { icon: [b.x + b.w / 2, b.y + 11], pitch, top, rows };
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
	// The position's route into a QR from below, along the row y: a QR with its legend (from 150 high) keeps
	// the legend centred under its square, so the arrow rises on the left, clear of it (a QR without one:
	// its middle), ending on the drawn square's bottom edge.
	function underQr(b, y) {
		const legend = b.h >= 150, q = qrSquare(b, { legend }), x = legend ? Math.round(q.x + 18) : b.x + b.w / 2;
		return [[326, y], [x, y], [x, q.y + q.h]];
	}
	// the QR's square as V.qr draws it in its box b (14 smaller with a legend under it)
	function qrSquare(b, { legend = false } = {}) {
		const side = Math.min(b.w, b.h) - (legend ? 14 : 0);
		return box(b.x + (b.w - side) / 2, b.y + (b.h - side - (legend ? 14 : 0)) / 2, side, side);
	}
	function qrCellsBox(b, size, cells, { legend = false } = {}) {
		if (!cells.length) return null;
		const q = qrSquare(b, { legend }), side = q.w, cs = side / size, x0 = q.x, y0 = q.y;
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
		if (end) Object.assign(b, { fingerprint: box(16, 256, 200, 28), note: box(16, 290, 408, 44), screen: box(440, 290, 224, 44) });
		const arrows = toWords
			? [arrow("qr>number", "qr", "number", "qr", [[448, 165], [424, 165]]), arrow("number>words", "number", "words", "qr", [[240, 165], [216, 165]])]
			: [arrow("words>number", "words", "number", "qr", [[216, 165], [240, 165]]), arrow("number>qr", "number", "qr", "qr", [[424, 165], [448, 165]])];
		return { boxes: b, arrows };
	}

	// Before the first turn (spec §5): the QR on the left with its bubble beside
	// it, the exact count in a card on the right, the string to build at the
	// bottom (as a turn's, its position box over it) with its bubble above it,
	// and the position's arrow up into the QR (as makeTurn's). pad: the key's
	// string (a reference, vertical, as a turn's) between them, its bubble beside it.
	function seqIntro({ pad }) {
		const b = { guide: { ...GUIDE }, question: box(16, 28, 648, 32), qr: box(16, 66, 180, 180),
			string: { ...BUILT }, posBox: { ...POSBOX }, stringTip: box(440, 218, 224, 36) };
		if (pad) Object.assign(b, { qrTip: box(212, 70, 150, 64), keyString: box(380, 66, 34, 180), count: box(430, 66, 234, 96), keyTip: box(430, 170, 234, 40) });
		else Object.assign(b, { qrTip: box(212, 80, 180, 56), count: box(424, 66, 240, 120) });
		const y = b.posBox.y + b.posBox.h / 2;
		return { boxes: b, arrows: [arrow("position", "posBox", "qr", "pos", [[b.posBox.x, y], ...underQr(b.qr, y).slice(1)])] };
	}
	// Before checking (spec §7): the string to read, a column as readTurn's
	// (and the key's beside it, a gap for the seed's bubble between them), each
	// with its bubble; the QR, blank, on the right with its bubble on its left.
	function checkIntro({ pad }) {
		const top = 66, h = 266, b = { guide: { ...GUIDE }, question: box(16, 28, 648, 32), column: box(20, top, 70, h) };
		if (pad) Object.assign(b, { columnTip: box(106, 80, 150, 64), keyColumn: box(272, top, 70, h), keyTip: box(358, 240, 200, 52),
			qr: box(490, top, 150, 150), qrTip: box(358, 90, 116, 80) });
		else Object.assign(b, { columnTip: box(106, 150, 180, 52), qr: box(460, top, 180, 180), qrTip: box(260, 80, 184, 52) });
		const columns = { seed: readColumn(b.column, { outer: "left" }) };
		if (pad) columns.key = readColumn(b.keyColumn, { outer: "right" });
		return { boxes: b, columns, arrows: [] };
	}

	// The start page's slides (spec «La portada» §1, §3): the drawing (vocab.js's
	// introArt) on the left, its text on the right, under the question. "modes": a
	// row per mode (introRows: the drawing's rows, each level with its text block);
	// "blend": its two labels drawn in the art; "start": the example string and the
	// doors; "notice": its text, the doors and a foot.
	const introRows = (b) => { const h = (b.h - 20) / 2; return [box(b.x, b.y, b.w, h), box(b.x, b.y + h + 20, b.w, h)]; };
	function introSlide(kind) {
		const b = { guide: { ...GUIDE } };
		if (kind === "modes") {
			const art = box(16, 66, 300, 268), [top, bottom] = introRows(art);
			Object.assign(b, { art, textBasic: box(332, top.y, 332, top.h), textKey: box(332, bottom.y, 332, bottom.h) });
		} else if (kind === "start") Object.assign(b, { art: box(16, 66, 648, 176), doors: box(16, 254, 648, 80) });
		else if (kind === "notice") Object.assign(b, { text: box(56, 66, 568, 164), doors: box(16, 238, 648, 56), more: box(16, 302, 648, 32) });
		else Object.assign(b, { art: box(16, 66, 300, 268), text: box(332, 66, 332, 268) });
		return { boxes: b, arrows: [] };
	}

	// a crop square (image pixels) kept inside the photo, no smaller than 32 nor larger than the photo's short side
	function cropClamp({ iw, ih, x, y, side }) {
		const s = Math.max(1, Math.min(Math.max(32, side), iw, ih));
		return { x: Math.min(Math.max(0, x), iw - s), y: Math.min(Math.max(0, y), ih - s), side: s };
	}
	// the crop square: one keyboard/button step, the factor a key asks for, and a pinch (fingers spreading grow it)
	const CROP_STEP = 0.9;
	const cropKeyScale = (key) => key === "+" || key === "=" ? 1 / CROP_STEP : key === "-" ? CROP_STEP : 0;
	const cropPinch = (side, last, span) => side * span / last;
	// The cropper's view of the base photo: a zoom (screen px per photo px) and where the photo's
	// top-left corner sits in the viewport (ox, oy). dims: the photo (iw, ih) and the viewport (vw, vh).
	// The zoom goes from the whole photo fitting to the smallest square (32 px) filling a third of it.
	const cropZoomRange = ({ iw, ih, vw, vh }) => { const min = Math.min(vw / iw, vh / ih); return { min, max: Math.max(min, Math.min(vw, vh) / 3 / 32) }; };
	// on each axis: centred where the photo is smaller than the viewport, else no empty margin
	function cropViewClamp({ iw, ih, vw, vh, zoom, ox, oy }) {
		const r = cropZoomRange({ iw, ih, vw, vh }), z = Math.min(r.max, Math.max(r.min, zoom));
		const axis = (o, size, room) => size <= room ? (room - size) / 2 : Math.min(0, Math.max(room - size, o));
		return { zoom: z, ox: axis(ox, iw * z, vw), oy: axis(oy, ih * z, vh) };
	}
	const cropViewFit = (dims) => cropViewClamp({ ...dims, zoom: 0, ox: 0, oy: 0 });
	// the photo point under a viewport point, and the view with a photo point in the viewport's middle
	const cropToImage = (view, { px, py }) => ({ ix: (px - view.ox) / view.zoom, iy: (py - view.oy) / view.zoom });
	const cropViewOn = (dims, zoom, { ix, iy }) => cropViewClamp({ ...dims, zoom, ox: dims.vw / 2 - ix * zoom, oy: dims.vh / 2 - iy * zoom });
	// zoomed by factor about a viewport point: the photo point under it stays there (as far as the clamp lets it)
	function cropZoomAt(view, { px, py }, factor, dims) {
		const { ix, iy } = cropToImage(view, { px, py }), r = cropZoomRange(dims), z = Math.min(r.max, Math.max(r.min, view.zoom * factor));
		return cropViewClamp({ ...dims, zoom: z, ox: px - ix * z, oy: py - iy * z });
	}
	// the crop square resized by one corner (nw, ne, sw, se) dragged to a photo point: square, the opposite corner
	// fixed, inside the photo, no smaller than 32 (at the photo's edge, cropClamp moves it in)
	function cropCorner(crop, corner, { ix, iy }, { iw, ih }) {
		const west = corner[1] === "w", north = corner[0] === "n";
		const fx = west ? crop.x + crop.side : crop.x, fy = north ? crop.y + crop.side : crop.y;
		const room = Math.min(west ? fx : iw - fx, north ? fy : ih - fy);
		// (signed: dragged past the fixed corner, it stops at 32 rather than growing the other way)
		const side = Math.max(32, Math.min(room, Math.max(west ? fx - ix : ix - fx, north ? fy - iy : iy - fy)));
		return cropClamp({ iw, ih, x: west ? fx - side : fx, y: north ? fy - side : fy, side });
	}
	return { introSlide, introRows, cropClamp, cropZoomRange, cropViewClamp, cropViewFit, cropToImage, cropViewOn, cropZoomAt, cropCorner, CROP_STEP, cropKeyScale, cropPinch, BUILT, SLOT, POSBOX, RAIL, pitch, qrSquare, qrCellsBox, digitFont, seedQr, seqIntro, underQr, checkIntro, VIEW, BIT, bitsOf, binary, route, segmentHitsBox, clockModule, makeTurn, readColumn, placeShift, readTurn, pickerPopup, checkFinal, keyThrow, pickerGrid, pickerCell, faceBox, throwMarks, REJECT, BADGE, fileRow, fileColumn, store, dictName, dictCheck, dictAsIs };
})();
