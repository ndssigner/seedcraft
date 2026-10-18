// Seedcraft Sequences, the web tool's slides: the two journeys as lists of
// slides (which ones there are, in which order, under which step of the
// guide), how many pieces of each kind to get, and the rules of naming and
// checking your own dictionary. Pure: no DOM, no texts,
// so web/test.mjs can check it in Node. app.js draws each slide.
"use strict";

const SeedcraftJourneys = (() => {
	// pieces of each kind that cover 99.9 % of seeds, plus one spare, in
	// packs of 5 (SPEC §6; simulated with the reference implementation)
	const BUY = { 12: { 2: 130, 4: 45, 8: 25, 16: 15, 32: 10 }, 24: { 2: 215, 4: 70, 8: 35, 16: 20, 32: 15 } };
	// the same for both strings of pad mode (SPEC §10.6); for a pad-mode
	// sequence alone, the table above, except N = 2 with 12 words: 135
	const PAD_BUY = { 12: { 2: 250, 4: 80, 8: 35, 16: 20, 32: 15 }, 24: { 2: 410, 4: 125, 8: 55, 16: 30, 32: 20 } };
	const buyFor = (words, n, mode, padAs) => mode === "pad" && padAs === "string" ? PAD_BUY[words][n]
		: mode === "pad" && words === 12 && n === 2 ? 135 : BUY[words][n];
	// how many pieces a seed takes (SPEC §2)
	const symbolsFor = (words, n) => Math.ceil((words === 12 ? 213 : 364) / Math.log2(n));

	// Every slide each journey can have, in order, with its step in the guide.
	const MAKE = [["mode", "plan"], ["form", "plan"], ["words", "plan"], ["size", "plan"], ["keyAs", "plan"], ["keyColl", "plan"], ["keyForm", "plan"],
		["pieces", "gather"],
		["dict", "dict"], ["dictHave", "dict"], ["keyDict", "dict"], ["keyDictHave", "dict"],
		["keyWho", "key"], ["keyTool", "key"], ["keyThrow", "key"],
		["seed", "seq"], ["qr", "seq"], ["seq", "seq"], ["check", "check"], ["store", "store"]];
	const READ = [["mode", "have"], ["form", "have"], ["size", "have"], ["dict", "have"], ["dictHave", "have"],
		["keyAs", "have"], ["keyColl", "have"], ["keyForm", "have"], ["keyDict", "have"], ["keyDictHave", "have"], ["keyFile", "have"],
		["words", "have"], ["recover", "recover"], ["seed", "seed"]];

	// The slides there are now. s: { mode, padAs ("string" | "file"),
	// padForm (the key's own collection, or null), dict, padDict (whether
	// each dictionary is there yet) and, making one, keyWho ("me" | "device"),
	// keyBy (what the key is being drawn with, once chosen) and made (whether
	// the sequence is made: its turns follow the seed's words) }.
	function slides(flow, s) {
		const pad = s.mode === "pad", things = pad && s.padAs === "string", own = things && !!s.padForm;
		const there = {
			keyAs: pad, keyColl: things, keyForm: own, dictHave: !!s.dict, keyDict: own, keyDictHave: own && !!s.padDict,
			keyWho: pad, keyTool: pad && s.keyWho === "me", keyThrow: pad && !!s.keyBy, seq: !!s.made, qr: !!s.made, keyFile: pad && s.padAs === "file",
		};
		// recovering, the seed's length is asked unless a key file tells it
		if (flow === "read") there.words = !(pad && s.padAs === "file");
		return (flow === "make" ? MAKE : READ).filter(([id]) => there[id] !== false).map(([id, step]) => ({ id, step }));
	}
	// The slide to show for `at`: itself if it is there, else the nearest one
	// before it that is (a slide that went: a dictionary forgotten, a key's
	// method changed), else the first.
	function resolve(flow, list, at) {
		const order = (flow === "make" ? MAKE : READ).map(([id]) => id), ids = list.map((x) => x.id);
		if (ids.includes(at)) return at;
		for (let i = order.indexOf(at) - 1; i >= 0; i--) if (ids.includes(order[i])) return order[i];
		return ids[0];
	}
	// Where a jump to a step of the guide lands: its first slide, or the first
	// one before it that is not done yet (done(id)), which it needs first.
	function jump(list, step, done) {
		const to = list.findIndex((x) => x.step === step);
		if (to < 0) return null;
		for (let i = 0; i < to; i++) if (!done(list[i].id)) return list[i].id;
		return list[to].id;
	}

	// What to gather: a group per collection. p: { words, n, mode, padAs,
	// form, padForm }; dictPieces(form): the pieces a dictionary of that form
	// takes of each kind (0 for an address book's conventional order, else 1).
	// Each group: { kinds: ["seed"], ["key"] or both, form, each (for the
	// strings), copies (for the dictionaries), what: "seq" | "key" | "both" }.
	// A key as a file is no collection: keyFile says it is there.
	// assemblyOf(form): whether the form has an assembly card (it has materials, and is not written)
	function pieces(p, dictPieces = () => 1, assemblyOf = () => false) {
		const pad = p.mode === "pad", things = pad && p.padAs === "string";
		if (things && !p.padForm) return { keyFile: false, groups: [
			{ kinds: ["seed", "key"], form: p.form, each: buyFor(p.words, p.n, "pad", "string"), copies: 2 * dictPieces(p.form), what: "both", assembly: !!assemblyOf(p.form) }] };
		const groups = [{ kinds: ["seed"], form: p.form, each: buyFor(p.words, p.n, p.mode, "file"), copies: (pad && !things ? 2 : 1) * dictPieces(p.form), what: "seq", assembly: !!assemblyOf(p.form) }];
		if (things) groups.push({ kinds: ["key"], form: p.padForm, each: buyFor(p.words, p.n, "pad", "file"), copies: dictPieces(p.padForm), what: "key", assembly: !!assemblyOf(p.padForm) });
		return { keyFile: pad && !things, groups };
	}

	// The pieces slide is done once every group's pieces are ticked, and the
	// assembly of each group that has one ("assembly:" + what).
	const gatherDone = (gathered, groups) => groups.every((g) => !!gathered[g.what] && (!g.assembly || !!gathered["assembly:" + g.what]));
	// The materials text of a form, with the length or quantity apart to draw
	// big: the first number (with its «cm»), or null when the text has none.
	function splitMaterials(text) {
		const m = /\d+(?:[.,]\d+)?(?:\s?cm)?/.exec(text || "");
		return { big: m ? m[0] : null, text: text || "" };
	}

	// ---- your own dictionary, a piece per slide ----------------------------
	// What stops piece i's name: "empty", "dup" (another piece has it, case
	// and spaces aside), or null.
	function nameProblem(things, i) {
		const name = String((things[i] && things[i].name) || "").trim().toLowerCase();
		if (!name) return "empty";
		return things.some((y, j) => j !== i && String(y.name || "").trim().toLowerCase() === name) ? "dup" : null;
	}
	// The order the pieces are checked in: every number below n once, shuffled
	// (random(): [0, 1)), so the next one's number is never the obvious one.
	function checkOrder(n, random) {
		const out = Array.from({ length: n }, (_, i) => i);
		for (let i = n - 1; i > 0; i--) {
			const j = Math.min(i, Math.floor(random() * (i + 1)));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	}

	// ---- the key's throw ----------------------------------------------------
	// The throws of a piece as they are read (SPEC §10.2; the same reading as
	// throwsToNumber): a die of `sides` gives b bits a throw and a face from
	// keep up is thrown again (S.diceBits). bits: those
	// given so far (at most k); used: [{ at, face, from, to }], each throw that
	// counts and the bits it gave (from … to − 1); rejected: the throws thrown
	// again; done: k bits. Throws after the piece is done are ignored.
	function throwParts(throws, sides, k) {
		const { b, keep } = SeedcraftSequences.diceBits(sides), bits = [], used = [], rejected = [];
		throws.forEach((face, at) => {
			if (bits.length >= k) return;
			if (face >= keep) { rejected.push(at); return; }
			const from = bits.length;
			for (let j = b - 1; j >= 0 && bits.length < k; j--) bits.push((face >> j) & 1);
			used.push({ at, face, from, to: bits.length });
		});
		return { bits, used, rejected, done: bits.length >= k };
	}

	// ---- a turn of the sequence, a relation at a time ------------------------
	// The stages of a turn being made, in the cycle's order (the spec's «first
	// turns explained»): each its id (what its caption says) and the arrows of
	// layouts.js's makeTurn it reveals. pad: with a key; file: the key is a file
	// (its number is read straight from its row: no key dictionary). The clock's
	// two inputs are one stage, and so is what comes out of it (no arrow).
	function turnStages({ pad = false, file = false } = {}) {
		const st = (id, ...arrows) => ({ id, arrows });
		if (!pad) return [st("position", "position"), st("bits", "bits"), st("number", "number"), st("dict", "dict"), st("slot", "slot")];
		return [st("position", "position"), st("bits", "bits"), st("number", "number"),
			...(file ? [st("key", "keyNumber")] : [st("key", "keyPiece"), st("keyNumber", "keyNumber")]),
			st("clock", "clockSeed", "clockKey"), st("out"), st("dict", "output"), st("slot", "slot")];
	}
	// How many first turns are explained a relation at a time
	const EXPLAINED = 3;

	// ---- a turn read back (recovering, checking a copy) ----------------------
	// The stages of a turn once its pieces are in, in the cycle's order, each
	// with the arrows of layouts.js's readTurn it shows: the position (over the
	// top to the turn's squares, while the pieces are chosen), the seed's piece
	// into its dictionary and its number; with a key its piece (none for a key
	// file) and number, the two numbers into the clock and what comes out of it
	// (no arrow); then the bits, then the squares painted.
	function readStages({ pad = false, file = false } = {}) {
		const st = (id, ...arrows) => ({ id, arrows });
		const seed = [st("position", "position"), st("piece", "piece"), st("number", "number")];
		return pad ? [...seed, ...(file ? [] : [st("keyPiece", "keyPiece")]), st("keyNumber", "keyNumber"), st("in", "clockSeed", "clockKey"), st("out"), st("bits", "bits"), st("paint", "paint")]
			: [...seed, st("bits", "bits"), st("paint", "paint")];
	}
	// A copy read back against the one just made, piece by piece. taps and
	// keys: what was read, turn by turn (keys: the key's column, null with no
	// key); symbols and pad: the strings made. keyRead: the key was read as a
	// string (so it, too, may have been read from its other end, or the two
	// strings swapped); a key file is read as it is. The reading that fits
	// best (the fewest pieces wrong; as given first): reversed (the sequence
	// from its other end), keyReversed, swapped; seed and key, what was read
	// at each place of the strings; wrong, the pieces that differ, in the order
	// they were read: { pos (its place in the strings), turn (when it was
	// read), column ("seed" or "key": where it was read) }.
	function checkRead({ taps, keys = null, symbols, pad = null, keyRead = false }) {
		const L = symbols.length, flips = [false, true];
		let best = null;
		for (const swapped of keyRead && keys ? flips : [false]) for (const reversed of flips) for (const keyReversed of keyRead && keys ? flips : [false]) {
			const seedCol = swapped ? keys : taps, keyCol = swapped ? taps : keys, wrong = [], seed = [], key = [];
			for (let p = 0; p < L; p++) {
				const st = reversed ? L - 1 - p : p, kt = keyReversed ? L - 1 - p : p;
				seed.push(seedCol[st]);
				if (seedCol[st] !== symbols[p]) wrong.push({ pos: p, turn: st, column: swapped ? "key" : "seed" });
				if (pad && keyCol) {
					key.push(keyCol[kt]);
					if (keyCol[kt] !== pad[p]) wrong.push({ pos: p, turn: kt, column: swapped ? "seed" : "key" });
				}
			}
			if (!best || wrong.length < best.wrong.length)
				best = { reversed, keyReversed, swapped, seed, key: pad && keyCol ? key : null, wrong: wrong.sort((a, b) => a.turn - b.turn || (a.column === "seed" ? -1 : 1)) };
		}
		return best;
	}

	return { BUY, PAD_BUY, EXPLAINED, turnStages, readStages, checkRead, buyFor, symbolsFor, slides, resolve, jump, pieces, gatherDone, splitMaterials, nameProblem, checkOrder, throwParts };
})();
