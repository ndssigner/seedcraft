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

	// The turn while making the copy. Bottom to top, left to right: the seed
	// string being built (full width), its position → the QR → its bits → their
	// number; with a key, the key string's piece → its dictionary → its number,
	// both numbers → the clock → the seed's dictionary → the slot. The slot is the
	// middle of the seed string, so arrows leave and reach it at x 334 and 346.
	function makeTurn({ pad, n }) {
		const bits = bitsOf(n);
		const b = {
			qr: box(20, 45, 95, 95),
			bits: box(130, 60, bits * BIT, BIT),
			number: box(130, 95, 60, 36),
			seedString: box(20, 300, 640, 40),
		};
		const arrows = [
			arrow("position", "seedString", "qr", "qr", [[334, 300], [334, 292], [67, 292], [67, 140]]),
			arrow("bits", "qr", "bits", "qr", [[115, 71], [130, 71]]),
			arrow("number", "bits", "number", "qr", [[150, 82], [150, 95]]),
		];
		if (!pad) {
			b.seedDict = box(297, 77, 86, 72);
			arrows.push(
				arrow("dict", "number", "seedDict", "qr", [[190, 113], [297, 113]]),
				arrow("slot", "seedDict", "seedString", "qr", [[346, 149], [346, 300]]));
			return { boxes: b, arrows };
		}
		// the key string is a reference: vertical, its turn piece in the middle (y 160)
		Object.assign(b, {
			keyString: box(268, 45, 34, 230),
			keyDict: box(316, 124, 86, 72),
			keyNumber: box(316, 204, 86, 30),
			clock: box(444, 32, 140, 170),
			seedDict: box(470, 212, 86, 70),
		});
		arrows.push(
			arrow("keyPiece", "keyString", "keyDict", "key", [[302, 160], [316, 160]]),
			arrow("keyNumber", "keyDict", "keyNumber", "key", [[359, 196], [359, 204]]),
			// the seed's number climbs above everything and enters the input band's side
			arrow("clockSeed", "number", "clock", "qr", [[190, 113], [255, 113], [255, 28], [430, 28], [430, 40], [444, 40]]),
			// the key's number runs up the corridor between its dictionary and the module
			arrow("clockKey", "keyNumber", "clock", "key", [[402, 219], [423, 219], [423, 52], [444, 52]]),
			arrow("output", "clock", "seedDict", "qr", [[513, 202], [513, 212]]),
			arrow("slot", "seedDict", "seedString", "qr", [[513, 282], [513, 292], [346, 292], [346, 300]]));
		return { boxes: b, arrows };
	}

	// The turn while recovering: what is built is the QR, large on the right.
	// The strings read are vertical and side by side on the left, 7 pieces each,
	// the turn's row (the middle one) framed; every arrow leaves from that frame.
	function readTurn({ pad, n }) {
		const bits = bitsOf(n), piece = 41, top = 40;
		const b = {
			seedColumn: box(20, top, 70, 7 * piece),
			qr: box(480, 70, 180, 180),
		};
		const rowY = top + 3 * piece;
		if (!pad) {
			b.row = box(14, rowY, 82, piece);
			b.bits = box(220, rowY + 12, bits * BIT, BIT);
			const y = rowY + 23, right = b.bits.x + b.bits.w;
			return { boxes: b, arrows: [
				arrow("position", "row", "qr", "qr", [[96, rowY + 9], [110, rowY + 9], [110, 40], [570, 40], [570, 70]]),
				arrow("bits", "row", "bits", "qr", [[96, y], [220, y]]),
				arrow("paint", "bits", "qr", "qr", [[right, y], [480, y]]),
			] };
		}
		Object.assign(b, {
			keyColumn: box(100, top, 70, 7 * piece),
			row: box(14, rowY, 162, piece),
			clock: box(220, 90, 140, 170),
		});
		const out = clockModule(b.clock).output, outY = out.y + out.h / 2;
		b.bits = box(368, outY - BIT / 2, bits * BIT, BIT);
		return { boxes: b, arrows: [
			arrow("position", "row", "qr", "qr", [[176, rowY + 9], [192, rowY + 9], [192, 40], [570, 40], [570, 70]]),
			arrow("clockSeed", "row", "clock", "qr", [[176, rowY + 23], [204, rowY + 23], [204, 100], [220, 100]]),
			arrow("clockKey", "row", "clock", "key", [[176, rowY + 33], [210, rowY + 33], [210, 112], [220, 112]]),
			arrow("bits", "clock", "bits", "qr", [[360, outY], [368, outY]]),
			arrow("paint", "bits", "qr", "qr", [[368 + bits * BIT, outY], [480, outY]]),
		] };
	}

	// The key's throw: the faces as buttons on the left (a coin's 2 up to a
	// d20's 20, in a grid as square as the space allows), the instruction under
	// them, the bit tower in the middle with the thrown faces on its left, then
	// brace → number → the key's dictionary → the piece → its slot in the key
	// string being built, at the bottom and full width.
	function keyThrow({ sides, bits = 5 }) {
		const cols = sides <= 2 ? 2 : sides <= 6 ? 3 : sides <= 12 ? 4 : 5;
		const rows = Math.ceil(sides / cols), gap = 6, area = { w: 180, h: 190 };
		const size = Math.floor(Math.min(56, (area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows));
		const faces = box(20, 48, cols * size + (cols - 1) * gap, rows * size + (rows - 1) * gap);
		const tower = box(330, 48, 28, bits * BIT), mid = Math.round(tower.y + tower.h / 2);
		const b = {
			question: box(190, 4, 300, 34),
			faces,
			instruction: box(20, faces.y + faces.h + 10, 180, 24),
			dice: box(222, 48, 100, tower.h),
			tower,
			brace: box(362, 48, 16, tower.h),
			number: box(386, mid - 20, 56, 40),
			keyDict: box(460, mid - 36, 86, 72),
			piece: box(566, mid - 25, 80, 50),
			keyString: box(20, 290, 640, 50),
		};
		return { boxes: b, faces: { cols, rows, size, gap }, arrows: [
			arrow("number", "brace", "number", "key", [[378, mid], [386, mid]]),
			arrow("dict", "number", "keyDict", "key", [[442, mid], [460, mid]]),
			arrow("piece", "keyDict", "piece", "key", [[546, mid], [566, mid]]),
			arrow("slot", "piece", "keyString", "key", [[606, mid + 25], [606, 270], [340, 270], [340, 290]]),
		] };
	}

	return { VIEW, route, segmentHitsBox, clockModule, makeTurn, readTurn, keyThrow };
})();
