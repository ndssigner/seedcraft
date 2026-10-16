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
	const BUILT = box(20, 296, 640, 44), SLOT = box(316, 296, 48, 44);

	// The turn while making the copy. Bottom to top, left to right: the seed
	// string being built, its slot's position → the QR → its bits → their
	// number; with a key, the key string's piece → its dictionary → its number,
	// both numbers → the clock → the seed's dictionary → the slot.
	function makeTurn({ pad, n }) {
		const bits = bitsOf(n);
		const b = {
			qr: box(20, 45, 95, 95),
			bits: box(135, 56, bits * BIT, BIT),
			number: box(135, 94, 60, 36),
			seedString: { ...BUILT },
			seedSlot: { ...SLOT },
		};
		const arrows = [
			arrow("position", "seedSlot", "qr", "qr", [[328, 296], [328, 284], [67, 284], [67, 140]]),
			arrow("bits", "qr", "bits", "qr", [[115, 67], [135, 67]]),
			arrow("number", "bits", "number", "qr", [[155, 78], [155, 94]]),
		];
		if (!pad) {
			b.seedDict = box(297, 76, 86, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[195, 112], [297, 112]]),
				arrow("slot", "seedDict", "seedSlot", "qr", [[352, 148], [352, 296]]));
			return { boxes: b, arrows };
		}
		// the key string is a reference: vertical, its turn piece in the middle (y 145)
		Object.assign(b, {
			keyString: box(268, 45, 34, 200),
			keyDict: box(320, 109, 86, 72),
			keyNumber: box(320, 197, 86, 30),
			clock: box(452, 32, 140, 154),
			seedDict: box(479, 204, 86, 48),
		});
		const keyIn = clockModule(b.clock).inputs[1], keyX = keyIn.x + keyIn.w / 2;
		arrows.push(
			arrow("keyPiece", "keyString", "keyDict", "key", [[302, 145], [320, 145]]),
			arrow("keyNumber", "keyDict", "keyNumber", "key", [[363, 181], [363, 197]]),
			// the seed's number goes under the key and up the outer corridor into its
			// (left) input cell; the key's runs up the inner corridor and over the top
			// into its own (right) cell: so the two never cross
			arrow("clockSeed", "number", "clock", "qr", [[165, 130], [165, 260], [436, 260], [436, 46], [452, 46]]),
			arrow("clockKey", "keyNumber", "clock", "key", [[406, 212], [420, 212], [420, 14], [keyX, 14], [keyX, keyIn.y]]),
			arrow("output", "clock", "seedDict", "qr", [[522, 186], [522, 204]]),
			arrow("slot", "seedDict", "seedSlot", "qr", [[522, 252], [522, 272], [352, 272], [352, 296]]));
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
		};
		const toQr = (x) => [[x, 40], [575, 40], [575, b.qr.y]];
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

	// The key's throw: the faces as buttons on the left (a coin's 2 up to a
	// d20's 20, in a grid as square as the space allows), the instruction under
	// them, the bit tower in the middle with the thrown faces on its left, then
	// brace → number → the key's dictionary → the piece → its slot in the key
	// string being built. That row stays at the middle of a 5-bit tower,
	// whatever N, so it never climbs into the question.
	function keyThrow({ sides, bits = 5 }) {
		const cols = sides <= 2 ? 2 : sides <= 6 ? 3 : sides <= 12 ? 4 : 5;
		const rows = Math.ceil(sides / cols), gap = 6, area = { w: 180, h: 190 };
		const size = Math.floor(Math.min(56, (area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows));
		const faces = box(20, 48, cols * size + (cols - 1) * gap, rows * size + (rows - 1) * gap);
		const mid = 48 + 5 * BIT / 2, h = bits * BIT, y = mid - h / 2;
		const b = {
			question: box(190, 4, 300, 34),
			faces,
			instruction: box(20, faces.y + faces.h + 10, 180, 24),
			dice: box(222, y, 100, h),
			tower: box(330, y, 28, h),
			brace: box(362, y, 16, h),
			number: box(394, mid - 20, 56, 40),
			keyDict: box(466, mid - 36, 86, 72),
			piece: box(568, mid - 25, 76, 50),
			keyString: { ...BUILT },
			keySlot: { ...SLOT },
		};
		return { boxes: b, faces: { cols, rows, size, gap }, arrows: [
			arrow("number", "brace", "number", "key", [[378, mid], [394, mid]]),
			arrow("dict", "number", "keyDict", "key", [[450, mid], [466, mid]]),
			arrow("piece", "keyDict", "piece", "key", [[552, mid], [568, mid]]),
			arrow("slot", "piece", "keySlot", "key", [[606, mid + 25], [606, 276], [352, 276], [352, 296]]),
		] };
	}

	return { VIEW, route, segmentHitsBox, clockModule, makeTurn, readTurn, keyThrow };
})();
