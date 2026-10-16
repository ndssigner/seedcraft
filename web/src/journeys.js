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
		["seq", "seq"], ["check", "check"], ["store", "store"]];
	const READ = [["mode", "have"], ["form", "have"], ["size", "have"], ["dict", "have"], ["dictHave", "have"],
		["keyAs", "have"], ["keyColl", "have"], ["keyForm", "have"], ["keyDict", "have"], ["keyDictHave", "have"], ["keyFile", "have"],
		["recover", "recover"], ["seed", "seed"]];

	// The slides there are now. s: { mode, padAs ("string" | "file"),
	// padForm (the key's own collection, or null), dict, padDict (whether
	// each dictionary is there yet) and, making one, keyWho ("me" | "device")
	// and keyBy (what the key is being drawn with, once chosen) }.
	function slides(flow, s) {
		const pad = s.mode === "pad", things = pad && s.padAs === "string", own = things && !!s.padForm;
		const there = {
			keyAs: pad, keyColl: things, keyForm: own, dictHave: !!s.dict, keyDict: own, keyDictHave: own && !!s.padDict,
			keyWho: pad, keyTool: pad && s.keyWho === "me", keyThrow: pad && !!s.keyBy, keyFile: pad && s.padAs === "file",
		};
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
	function pieces(p, dictPieces = () => 1) {
		const pad = p.mode === "pad", things = pad && p.padAs === "string";
		if (things && !p.padForm) return { keyFile: false, groups: [
			{ kinds: ["seed", "key"], form: p.form, each: buyFor(p.words, p.n, "pad", "string"), copies: 2 * dictPieces(p.form), what: "both" }] };
		const groups = [{ kinds: ["seed"], form: p.form, each: buyFor(p.words, p.n, p.mode, "file"), copies: (pad && !things ? 2 : 1) * dictPieces(p.form), what: "seq" }];
		if (things) groups.push({ kinds: ["key"], form: p.padForm, each: buyFor(p.words, p.n, "pad", "file"), copies: dictPieces(p.padForm), what: "key" });
		return { keyFile: pad && !things, groups };
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

	return { BUY, PAD_BUY, buyFor, symbolsFor, slides, resolve, jump, pieces, nameProblem, checkOrder };
})();
