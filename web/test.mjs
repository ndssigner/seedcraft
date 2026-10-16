// Tests of the web tools' JavaScript against the reference test vectors
// (vectors/sequences-v0.json, vectors/sequences-pad.json) and Node.js's own
// crypto.
//     node web/test.mjs
import { createECDH, createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder }); // the browser's crypto.getRandomValues and TextEncoder
for (const f of ["third_party/qrcodegen.js", "src/bip39-english.js", "src/seedcraft-sequences.js", "src/layouts.js"])
	vm.runInContext(read(f), ctx, { filename: f });
vm.runInContext("globalThis.S = SeedcraftSequences; globalThis.SeedcraftLayouts = SeedcraftLayouts;", ctx); // top-level consts are not properties of the context
const S = ctx.S;

let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL", what); } };
const hex = (b) => Buffer.from(b).toString("hex");

// crypto primitives against Node
for (const len of [0, 1, 55, 56, 63, 64, 65, 200]) {
	const data = Uint8Array.from({ length: len }, (_, i) => (i * 7 + 3) & 255);
	check(hex(S.sha256(data)) === createHash("sha256").update(data).digest("hex"), "sha256 len " + len);
}
// the fingerprint's primitives against Node: SHA-512, HMAC-SHA512, PBKDF2, RIPEMD-160
for (const len of [0, 1, 111, 112, 127, 128, 129, 300]) {
	const data = Uint8Array.from({ length: len }, (_, i) => (i * 13 + 5) & 255);
	check(hex(S.sha512(data)) === createHash("sha512").update(data).digest("hex"), "sha512 len " + len);
	check(hex(S.ripemd160(data)) === createHash("ripemd160").update(data).digest("hex"), "ripemd160 len " + len);
	const key = data.slice(0, Math.min(len, 200));
	check(hex(S.hmac512(S.hmacKey(key), data)) === createHmac("sha512", key).update(data).digest("hex"), "hmac-sha512 len " + len);
}
check(hex(S.pbkdf2Sha512(new TextEncoder().encode("password"), new TextEncoder().encode("salt"), 7))
	=== pbkdf2Sync("password", "salt", 7, 64, "sha512").toString("hex"), "pbkdf2-sha512");
// the well-known fingerprint of the pretend seed "abandon … about"
check(S.fingerprint("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about") === "73c5da0a", "fingerprint abandon…about");
// a fingerprint as Node computes it, for a mnemonic and a passphrase
const nodeFingerprint = (mnemonic, passphrase = "") => {
	const seed = pbkdf2Sync(mnemonic.normalize("NFKD"), ("mnemonic" + passphrase).normalize("NFKD"), 2048, 64, "sha512");
	const I = createHmac("sha512", "Bitcoin seed").update(seed).digest();
	const ecdh = createECDH("secp256k1");
	ecdh.setPrivateKey(I.subarray(0, 32));
	const pub = ecdh.getPublicKey(null, "compressed");
	return createHash("ripemd160").update(createHash("sha256").update(pub).digest()).digest("hex").slice(0, 8);
};
check(S.fingerprint("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", "TREZOR")
	=== nodeFingerprint("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", "TREZOR"), "fingerprint with passphrase");
// vectors
const vectors =JSON.parse(read("../vectors/sequences-v0.json")).vectors;
let seed = 1;
const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (const v of vectors) {
	const name = `${v.name} k=${v.k}`;
	const entropy = Uint8Array.from(Buffer.from(v.entropy, "hex"));
	check(hex(S.mnemonicToEntropy(v.mnemonic)) === v.entropy, "mnemonic -> entropy " + name);
	check(S.entropyToMnemonic(entropy) === v.mnemonic, "entropy -> mnemonic " + name);
	if (v.k === 4) check(S.fingerprint(v.mnemonic) === nodeFingerprint(v.mnemonic), "fingerprint " + name);
	const symbols = S.encode(entropy, v.k, 0);
	check(JSON.stringify(symbols) === JSON.stringify(v.symbols), "encode (same symbols and mask as Python) " + name);
	const rnd = S.encode(entropy, v.k);
	check(JSON.stringify(rnd.slice(0, -1)) === JSON.stringify(v.symbols.slice(0, -1)) && hex(S.decode(rnd, v.k).entropy) === v.entropy, "random padding " + name);
	const d = S.decode(v.symbols, v.k);
	check(hex(d.entropy) === v.entropy && d.fixed === 0 && d.header[1] === v.mask, "decode " + name);
	// one misread object is always repaired
	const bad = v.symbols.slice();
	const pos = rand(bad.length);
	bad[pos] = (bad[pos] + 1 + rand((1 << v.k) - 1)) % (1 << v.k);
	check(hex(S.decode(bad, v.k).entropy) === v.entropy, "1 misread object " + name);
	// a physical sequence with its dictionary kept apart, read from either end
	const dict = Array.from({ length: 1 << v.k }, (_, i) => "object " + ((i * 5 + 3) % (1 << v.k)));
	const seq = S.physicalSequence(v.symbols, dict);
	for (const reading of [seq, seq.slice().reverse()])
		check(hex(S.decodeObjects(reading, dict).entropy) === v.entropy, "objects " + name);
	const buy = S.piecesToBuy(v.symbols, 1 << v.k);
	check(buy % 5 === 0 && dict.every((_, s) => v.symbols.filter((x) => x === s).length < buy), "pieces to buy " + name);
}
// the template's fixed squares, without a QR code, match qrcodegen's for every
// size and mask (the format squares, which depend on the mask, are null)
const masks = new Set();
for (let i = 0; i < 400 && masks.size < 16; i++) {
	const entropy = Uint8Array.from(createHash("sha256").update("template " + i).digest()).slice(0, i % 2 ? 32 : 16);
	const qr = S.compactSeedQR(entropy);
	masks.add(qr.size + "/" + qr.mask);
	let format = 0;
	for (const key of S.functionModules(qr.size)) {
		const r = Math.floor(key / qr.size), c = key % qr.size, v = S.templateModule(qr.size, r, c);
		if (v === null) format++;
		else check(v === qr.getModule(c, r), `template module ${r},${c} of ${qr.size} mask ${qr.mask}`);
	}
	check(format === 30, "30 format squares in " + qr.size);
}
check(masks.size === 16, "both sizes, all 8 masks: " + masks.size);

// pad mode (SPEC §10), against the pad vectors
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const padVectors = JSON.parse(read("../vectors/sequences-pad.json")).vectors;
const padFileError = (text) => { try { S.readPadFile(text); return null; } catch (e) { return e instanceof S.PadFileError ? e : String(e); } };
for (const v of padVectors) {
	const name = `${v.name} k=${v.k}`, n = v.n, seq = v.sequence, key = v.pad;
	const entropy = Uint8Array.from(Buffer.from(v.entropy, "hex"));
	check(same(S.encode(entropy, v.k, 0), v.basic), "basic sequence " + name);
	check(same(S.encrypt(v.basic, key, n), seq), "encrypt " + name);
	check(same(S.decrypt(seq, key, n), v.basic), "decrypt " + name);
	const enc = S.encodePad(entropy, v.k, key, 0);
	check(same(enc.sequence, seq) && same(enc.pad, key), "encodePad " + name);
	const d = S.decodePad(seq, key, v.k);
	check(hex(d.entropy) === v.entropy && d.fixed === 0 && d.header[1] === v.mask && !d.swapped && same(d.plain, v.basic), "decodePad " + name);
	// either end of either string, and the two strings swapped (§10.5)
	for (const c of [seq, seq.slice().reverse()]) for (const kk of [key, key.slice().reverse()]) {
		check(hex(S.decodePad(c, kk, v.k).entropy) === v.entropy, "directions " + name);
		const s = S.decodePad(kk, c, v.k);
		check(hex(s.entropy) === v.entropy && s.swapped === (n !== 2), "swapped " + name);
	}
	// one wrong symbol, in the sequence or in the pad, is repaired
	for (const which of ["sequence", "pad"]) {
		const bad = (which === "sequence" ? seq : key).slice(), pos = rand(bad.length);
		bad[pos] = (bad[pos] + 1 + rand(n - 1)) % n;
		const r = which === "sequence" ? S.decodePad(bad, key, v.k) : S.decodePad(seq, bad, v.k);
		check(hex(r.entropy) === v.entropy, "1 wrong symbol in the " + which + " " + name);
	}
	// the pad file: written as the reference writes it, read back
	check(S.writePadFile(key, n) === v.pad_file, "pad file written " + name);
	const f = S.readPadFile(v.pad_file.replace(/\n/g, "\r\n").toLowerCase() + "# a note\n\n");
	check(same(f.pad, key) && f.n === n, "pad file read " + name);
	// every single wrong character is caught, with its line
	const lines = v.pad_file.split("\n");
	const row = 1 + rand(lines.length - 2), chars = [...lines[row]].map((ch, i) => [ch, i]).filter(([ch]) => ch !== " ");
	const [ch, at] = chars[rand(chars.length)];
	const other = S.PAD_DIGITS[(S.PAD_DIGITS.indexOf(ch) + 1 + rand(n - 1)) % n];
	lines[row] = lines[row].slice(0, at) + other + lines[row].slice(at + 1);
	const e = padFileError(lines.join("\n"));
	check(e && e.code === "check" && e.line === row + 1, "a wrong character in the pad file " + name);
	// the strings as things, each with its own dictionary
	const dict = Array.from({ length: n }, (_, i) => "bead " + ((i * 3 + 1) % n));
	const padDict = Array.from({ length: n }, (_, i) => "street " + ((i * 5 + 2) % n));
	check(hex(S.decodePadObjects(S.physicalSequence(seq, dict).reverse(), S.physicalSequence(key, dict), dict).entropy) === v.entropy, "objects " + name);
	check(hex(S.decodePadObjects(S.physicalSequence(seq, dict), S.physicalSequence(key, padDict).reverse(), dict, padDict).entropy) === v.entropy, "objects, two dictionaries " + name);
	// a new pad: in range, the right length, and it round-trips
	const fresh = S.encodePad(entropy, v.k);
	check(fresh.pad.length === v.basic.length && fresh.pad.every((x) => Number.isInteger(x) && x >= 0 && x < n), "new pad " + name);
	check(hex(S.decodePad(fresh.sequence, fresh.pad, v.k).entropy) === v.entropy, "new pad decodes " + name);
	// a pad made by hand, added to the device's
	const hand = Array.from({ length: key.length }, () => rand(n));
	const both = S.addPads(fresh.pad, hand, n);
	check(hex(S.decodePad(S.encrypt(v.basic, both, n), both, v.k).entropy) === v.entropy, "device + hand pad " + name);
}
// the check character: the example of SPEC §10.7, and every neighbour swap but 0 and N - 1
check(S.checkCharacter([3, 10, 3, 7, 13, 15, 14, 7, 0, 2, 3, 9, 3, 14, 0, 15], 16) === 6, "check character, SPEC §10.7");
for (const n of [4, 8, 16, 32]) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
	if (a === b || (a === 0 && b === n - 1) || (a === n - 1 && b === 0)) continue;
	for (const at of [0, 1]) {
		const row = Array(6).fill(0); row[at] = a; row[at + 1] = b;
		const swapped = row.slice(); swapped[at] = b; swapped[at + 1] = a;
		if (S.checkCharacter(row, n) === S.checkCharacter(swapped, n)) check(false, `swap ${a} ${b} at ${at}, N = ${n}`);
	}
}
// malformed pad files
for (const [text, code] of [["", "empty"], ["# only a note\n", "empty"], ["54\n", "first"], ["16 10\n", "n"],
	["4 16\n0123\n", "nocheck"], ["4 4\n0145 0\n", "char"], ["20 16\n0123 4\n0123 5\n", "row"], ["5 16\n0123 " + S.PAD_DIGITS[S.checkCharacter([0, 1, 2, 3], 16)] + "\n", "count"]]) {
	const e = padFileError(text);
	check(e && e.code === code, `pad file error ${code}: ${e && (e.code || e)}`);
}
// newPad has no bias: 64 000 symbols with N = 32, chi-squared under 70 (31 degrees of freedom, p ~ 0.0001)
const counts = new Array(32).fill(0);
S.newPad(64000, 32).forEach((x) => counts[x]++);
const chi = counts.reduce((s, c) => s + (c - 2000) ** 2 / 2000, 0);
check(chi < 70, "newPad uniform, chi-squared " + chi.toFixed(1));
// dice (SPEC §10.2)
for (const [s, b] of [[2, 1], [4, 2], [6, 2], [8, 3], [10, 3], [12, 3], [16, 4], [20, 4]])
	check(S.diceBits(s).b === b && S.diceBits(s).keep === 2 ** b, "diceBits d" + s);
let r = S.throwsToNumber([2, 4, 5, 3], 6, 4);          // d6, N = 16: 2 -> 10, 4 and 5 are thrown again, 3 -> 11
check(r && r.value === 11 && r.bits.join("") === "1011" && r.rejected.join() === "1,2" && r.used.join() === "0,3", "d6 1011");
check(S.throwsToNumber([2, 4], 6, 4) === null, "d6 one throw missing");
r = S.throwsToNumber([5, 6], 8, 4);                     // d8: 101 and the first bit of 110 -> 1011
check(r && r.value === 11, "d8 takes the first bits of the last throw");
check(S.throwsToNumber([15], 16, 4).value === 15 && S.throwsToNumber([19, 7], 20, 4).value === 7, "d16 and d20");
check(S.throwsToNumber([1, 0, 1, 1], 2, 4).value === 11, "coins");
// k from 1 to 8, any die: every value 0..2^k - 1 comes out of some throws
for (const s of S.DICE) for (let k = 1; k <= 8; k++) {
	const { b, keep } = S.diceBits(s), seen = new Set(), n = Math.ceil(k / b);
	for (let x = 0; x < keep ** n && x < 4096; x++) {
		const faces = Array.from({ length: n }, (_, j) => Math.floor(x / keep ** (n - 1 - j)) % keep);
		seen.add(S.throwsToNumber(faces, s, k).value);
	}
	check(keep ** n > 4096 || seen.size === 2 ** k, `d${s} k=${k} gives every value`);
}
let bad = false; try { S.throwsToNumber([6], 6, 4); } catch { bad = true; }
check(bad, "face outside the die");
// turns: with the vectors, the bits of each turn are those of encode
for (const v of vectors) {
	const k = v.k, e = Uint8Array.from(Buffer.from(v.entropy, "hex")), seq = v.symbols, name = v.name + " k=" + k;
	const size = S.sizeFor(seq.length, k), qr = S.compactSeedQR(e), bits = S.symbolsToBits(seq, k);
	check(size === qr.size, "sizeFor " + name);
	let ok = true, roles = new Set();
	for (let i = 0; i < seq.length; i++) for (const t of S.turnBits(size, i, k)) {
		roles.add(t.role);
		if (t.role === "data" && (qr.getModule(t.cell[1], t.cell[0]) ? 1 : 0) !== bits[t.bit]) ok = false;
		if ((t.role === "data") !== (t.cell !== null)) ok = false;
	}
	check(ok && roles.has("header"), "turnBits " + name);
	check(hex(S.decodeTurns(seq, null, k).entropy) === v.entropy && !S.decodeTurns(seq, null, k).reversed, "decodeTurns " + name);
	check(S.decodeTurns([...seq].reverse(), null, k).reversed === true, "decodeTurns reversed " + name);
}
for (const v of padVectors) {
	const k = v.k;
	check(hex(S.decodeTurns(v.sequence, v.pad, k).entropy) === v.entropy, "decodeTurns pad " + v.name);
	check(S.decodeTurns([...v.sequence].reverse(), v.pad, k).reversed === true, "decodeTurns pad reversed " + v.name);
}
// the two strings given in swapped roles: read, and said so (with N = 2 the roles give the same, and swapped is false)
for (const v of padVectors.filter((x) => x.n > 2)) {
	const r = S.decodeTurns(v.pad, v.sequence, v.k);
	check(r.swapped === true && r.reversed === false && hex(r.entropy) === v.entropy, "decodeTurns pad swapped " + v.name + " k=" + v.k);
}
// reading turn by turn, piece by piece: sequence − key on the clock of N gives the basic sequence, and the seed
for (const v of padVectors) {
	const plain = v.sequence.map((c, i) => S.clockStep(c, v.pad[i], v.n, -1).value);
	check(plain.join() === v.basic.join() && hex(S.decode(plain, v.k).entropy) === v.entropy, "turnos de vuelta " + v.name + " k=" + v.k);
	check(S.decodeTurns(v.sequence, v.pad, v.k).plain.join() === plain.join(), "decodeTurns plain is the turns' " + v.name + " k=" + v.k);
}
// the basic mode: each piece is its own number; the size from the length alone
for (const v of vectors) {
	const r = S.decodeTurns(v.symbols, null, v.k);
	check(r.plain.join() === v.symbols.join() && S.sizeFor(v.symbols.length, v.k) === S.compactSeedQR(r.entropy).size, "turns back, basic " + v.name + " k=" + v.k);
}
// the clock (SPEC §10.3)
check(JSON.stringify(S.clockStep(9, 12, 16, 1)) === '{"value":5,"wrapped":true}', "clock 9 + 12");
check(JSON.stringify(S.clockStep(5, 12, 16, -1)) === '{"value":9,"wrapped":true}', "clock 5 - 12");
check(JSON.stringify(S.clockStep(3, 1, 2, -1)) === '{"value":0,"wrapped":false}' && S.clockStep(1, 1, 2, 1).value === 0, "clock N = 2");
// the key made piece by piece (SPEC §10.2): a piece once drawn never changes by moving
try {
	let key = { by: "d6", pieces: [], pos: 0, draft: [] };
	key = S.keyAddThrow(key, 2, 6, 4); key = S.keyAddThrow(key, 4, 6, 4);
	check(key.pieces.length === 0 && key.draft.join() === "2,4", "a piece half drawn");
	key = S.keyMove(key, 0, 54); key = S.keyMove(key, 5, 54);
	check(key.draft.join() === "2,4" && key.pos === 0, "moving neither loses nor skips the piece half drawn");
	key = S.keyAddThrow(key, 3, 6, 4);
	check(key.pieces.length === 1 && key.pieces[0].value === 11 && key.draft.length === 0, "the piece closes");
	check(key.pieces[0].by === "d6" && key.pieces[0].throws.join() === "2,4,3", "the piece keeps who drew it and its throws");
	const fixed = JSON.stringify(key.pieces);
	key = S.keyMove(S.keyMove(key, 0, 54), 1, 54);
	check(JSON.stringify(key.pieces) === fixed && key.pos === 1, "back and on throws nothing again");
	check(S.keyMove(key, 99, 54).pos === 1 && S.keyMove(key, -3, 54).pos === 0, "moving stays within the pieces drawn and the first missing one");
	// device and bag pieces; the last position is L - 1
	let dev = { by: "device", pieces: [], pos: 0, draft: [] };
	for (const v of [5, 0, 15]) dev = S.keyAddPiece(dev, v, "device");
	check(dev.pieces.map((p) => p.value).join() === "5,0,15" && dev.pieces.every((p) => p.by === "device") && dev.pos === 0, "device pieces");
	check(S.keyMove(dev, 9, 3).pos === 2, "a full key's last piece is L - 1");
	// correcting a piece set by hand: it is marked again in its place, the draft of the first missing piece kept
	let fix = S.keyAddThrow(S.keyAddThrow(S.keyMove(key, 1, 54), 1, 6, 4), 0, 6, 4);   // piece 1: 01 00 -> 4
	fix = S.keyAddThrow(fix, 3, 6, 4);                                                    // piece 2 half drawn
	check(fix.pieces.length === 2 && fix.pieces[1].value === 4 && fix.draft.join() === "3", "two pieces and a draft");
	fix = S.keyFix(S.keyMove(fix, 0, 54));
	check(fix.fix && fix.fix.at === 0 && fix.draft.length === 0, "correcting starts with no throws");
	fix = S.keyAddThrow(S.keyAddThrow(fix, 0, 6, 4), 1, 6, 4);                            // 00 01 -> 1
	check(fix.pieces.length === 2 && fix.pieces[0].value === 1 && fix.pieces[1].value === 4 && !fix.fix && fix.draft.join() === "3" && fix.pos === 0,
		"a corrected piece is replaced in place and the draft comes back");
	let cancel = S.keyAddThrow(S.keyFix(fix), 2, 6, 4);
	cancel = S.keyMove(cancel, 1, 54);
	check(!cancel.fix && cancel.pieces[0].value === 1 && cancel.draft.join() === "3", "moving away cancels a correction");
	check(S.keyFix(S.keyMove(dev, 1, 3)).fix === null, "a device piece is never corrected");
	check(S.keyFix(S.keyMove(fix, 2, 54)).fix === null, "the first missing piece has nothing to correct");
	let bag = S.keyAddPiece({ by: "bag", pieces: [], pos: 0, draft: [] }, 7, "bag");
	check(bag.pieces[0].value === 7 && bag.pieces[0].by === "bag" && S.keyFix(bag).fix.at === 0, "a bag piece can be corrected");
	const before = JSON.stringify(key);
	S.keyAddThrow(key, 0, 6, 4); S.keyMove(key, 0, 54); S.keyFix(key);
	check(JSON.stringify(key) === before, "key functions return a new key");
	// a full key of L pieces takes no more, by the device, the bag or the throws; a correction still goes in its place
	const full = S.keyMove(dev, 2, 3);
	check(S.keyAddPiece(full, 9, "device", [], 3).pieces.length === 3 && S.keyAddPiece(full, 9, "bag", [], 3).pieces.map((p) => p.value).join() === "5,0,15",
		"keyAddPiece on a full key does not grow it");
	let full6 = { by: "d6", pieces: [], pos: 0, draft: [] };
	for (const f of [0, 1]) full6 = S.keyAddThrow(full6, f, 6, 2, 1);
	full6 = S.keyAddThrow(S.keyAddThrow(full6, 3, 6, 2, 1), 2, 6, 2, 1);
	check(full6.pieces.length === 1 && full6.pieces[0].value === 0 && full6.draft.length === 0, "keyAddThrow on a full key does not grow it nor start a draft");
	const bagFull = S.keyAddPiece(S.keyFix(S.keyAddPiece({ by: "bag", pieces: [], pos: 0, draft: [] }, 3, "bag", [], 1)), 6, "bag", [], 1);
	check(bagFull.pieces.length === 1 && bagFull.pieces[0].value === 6 && !bagFull.fix, "a full key's piece is still corrected in place");
	check(S.keyAddPiece(dev, 1, "device").pieces.length === 4, "with no L, keyAddPiece adds as before");
	// a face tapped by mistake: only the last throw of the draft goes
	const half = S.keyAddThrow(S.keyAddThrow(S.keyMove(key, 1, 54), 4, 6, 4), 1, 6, 4);   // after piece 0: 4 (again), 1
	const halfWas = JSON.stringify(half), undone = S.keyUndoThrow(half);
	check(undone.draft.join() === "4" && JSON.stringify(undone.pieces) === JSON.stringify(half.pieces) && undone.pos === half.pos, "undo removes only the last throw");
	check(JSON.stringify(half) === halfWas && undone !== half && undone.draft !== half.draft, "undo returns a new key");
	const empty = S.keyUndoThrow(S.keyUndoThrow(undone));
	check(empty.draft.length === 0 && JSON.stringify(empty.pieces) === JSON.stringify(half.pieces), "undo on an empty draft does nothing");
	let fixing = S.keyAddThrow(S.keyFix(S.keyMove(fix, 0, 54)), 2, 6, 4);              // correcting piece 0, the draft "3" held aside
	fixing = S.keyUndoThrow(fixing);
	check(fixing.fix && fixing.fix.at === 0 && fixing.fix.held.join() === "3" && fixing.draft.length === 0 && JSON.stringify(fixing.pieces) === JSON.stringify(fix.pieces),
		"undo while correcting a piece touches only that piece's throws");
} catch (e) { check(false, "key state functions: " + e); }
// the pieces of a sequence a corrected key changed
check(S.changedPieces([1, 2, 3, 4], [1, 5, 3, 0]).join() === "1,3", "changedPieces: the places that differ");
check(S.changedPieces([1, 2], [1, 2]).length === 0 && S.changedPieces([1], [1, 2]).join() === "1", "changedPieces: none, and a longer one's extra place");
{
	const v = padVectors.find((x) => x.k === 4), K2 = v.pad.slice(); K2[5] = (K2[5] + 1) % v.n;
	check(S.changedPieces(S.encrypt(v.basic, v.pad, v.n), S.encrypt(v.basic, K2, v.n)).join() === "5", "one key piece corrected changes that one piece of the sequence");
}
// the slides' geometry: everything fits in the canvas, no arrow crosses a box
// (a box overlapping an arrow's own ends, like the frame around a row, is not crossed)
const Lay = ctx.SeedcraftLayouts;
check(Lay.route([[0, 0], [10, 0], [10, 5]]) === "M0 0 L10 0 L10 5", "route");
let threw = false; try { Lay.route([[0, 0], [3, 4]]); } catch { threw = true; }
check(threw, "route refuses a diagonal");
check(Lay.segmentHitsBox([0, 5], [20, 5], { x: 5, y: 0, w: 5, h: 10 }) && !Lay.segmentHitsBox([0, 0], [20, 0], { x: 5, y: 0, w: 5, h: 10 }), "segment vs box");
const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= Lay.VIEW.w && b.y + b.h <= Lay.VIEW.h;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
const len = ([a, b]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
// two straight segments meet (touching counts): arrows never cross nor touch each other
const meet = ([a, b], [c, d]) => Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0]))
	&& Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
// two parallel segments closer than 12 px whose spans overlap or come within 24 px read as one line
const tooNear = ([a, b], [c, d]) => {
	const h1 = a[1] === b[1], h2 = c[1] === d[1];
	if (h1 !== h2) return false;
	const [along, across] = h1 ? [0, 1] : [1, 0];
	const gap = Math.max(Math.min(a[along], b[along]), Math.min(c[along], d[along])) - Math.min(Math.max(a[along], b[along]), Math.max(c[along], d[along]));
	return Math.abs(a[across] - c[across]) < 12 && gap < 24;
};
const segments = (a) => a.points.slice(1).map((p, i) => [a.points[i], p]);
const checkLayout = (name, lay) => {
	check(Object.values(lay.boxes).every(inside), `${name} fits`);
	// the slide's fixed top band (the guide, «?» and «⋯») is kept free: the box tests below then keep everything off it
	const g = lay.boxes.guide;
	check(g && g.x === 0 && g.y === 0 && g.w === Lay.VIEW.w && g.h === 26, `${name} reserves the guide's band`);
	// boxes never overlap, except a frame around a row and a slot in its string
	const ids = Object.keys(lay.boxes);
	ids.forEach((i, k) => ids.slice(k + 1).forEach((j) => {
		const a = lay.boxes[i], b = lay.boxes[j];
		if (i !== "row" && j !== "row" && !contains(a, b) && !contains(b, a)) check(!overlap(a, b), `${name} boxes ${i} and ${j} apart`);
	}));
	for (const a of lay.arrows) {
		Lay.route(a.points);
		check(a.from in lay.boxes && a.to in lay.boxes && (a.colour === "qr" || a.colour === "key"), `${name} arrow ${a.id} joins two boxes, in a colour`);
		check(a.points.every(([x, y]) => x >= 0 && y >= 0 && x <= Lay.VIEW.w && y <= Lay.VIEW.h), `${name} arrow ${a.id} fits`);
		const segs = segments(a);
		check(segs.reduce((s, g) => s + len(g), 0) >= 16 && len(segs[segs.length - 1]) >= 12, `${name} arrow ${a.id} long enough to read`);
		check(segs.length <= 4, `${name} arrow ${a.id} turns at most three times`);
		for (let i = 1; i < a.points.length; i++) for (const [id, b] of Object.entries(lay.boxes))
			if (id !== a.from && id !== a.to && !overlap(b, lay.boxes[a.from]) && !overlap(b, lay.boxes[a.to]))
				check(!Lay.segmentHitsBox(a.points[i - 1], a.points[i], b), `${name} arrow ${a.id} clear of ${id}`);
	}
	lay.arrows.forEach((a, i) => lay.arrows.slice(i + 1).forEach((b) => {
		check(!segments(a).some((s) => segments(b).some((t) => meet(s, t))), `${name} arrows ${a.id} and ${b.id} apart`);
		// (two arrows chained through a box are kept apart by the box)
		if (a.to !== b.from && b.to !== a.from)
			check(!segments(a).some((s) => segments(b).some((t) => tooNear(s, t))), `${name} arrows ${a.id} and ${b.id} not side by side`);
	}));
};
const ends = (a) => a.points[a.points.length - 1], starts = (a) => a.points[0];
const onBorder = ([x, y], b) => (x === b.x || x === b.x + b.w) && y >= b.y && y <= b.y + b.h || (y === b.y || y === b.y + b.h) && x >= b.x && x <= b.x + b.w;
const inCell = ([x, y], c) => onBorder([x, y], c);
for (const n of [2, 4, 8, 16, 32]) for (const pad of [false, true]) {
	for (const [name, lay] of [["make", Lay.makeTurn({ pad, n })], ["read", Lay.readTurn({ pad, n })]]) {
		checkLayout(`${name} n=${n} pad=${pad}`, lay);
		for (const a of lay.arrows) check(onBorder(starts(a), lay.boxes[a.from]) && onBorder(ends(a), lay.boxes[a.to]), `${name} n=${n} pad=${pad} arrow ${a.id} leaves and reaches its boxes`);
		const keyed = ["keyString", "keyDict", "keyNumber", "keyColumn", "keySlot", "clock"].filter((k) => k in lay.boxes);
		check(pad ? keyed.length === (name === "make" ? 4 : 3) : keyed.length === 0, `${name} n=${n} pad=${pad} has the key only with a key`);
		check("seedSlot" in lay.boxes && contains(lay.boxes[name === "make" ? "seedString" : "seedColumn"], lay.boxes.seedSlot), `${name} n=${n} pad=${pad} the turn's slot is in its string`);
		if (pad) {
			const m = Lay.clockModule(lay.boxes.clock), into = (id) => ends(lay.arrows.find((a) => a.id === id));
			check(inCell(into("clockSeed"), m.inputs[0]) && inCell(into("clockKey"), m.inputs[1]), `${name} n=${n}: each number enters its own input cell`);
		}
	}
	const make = Lay.makeTurn({ pad, n });
	check(make.boxes.bits.w >= Math.log2(n) * 16, `make n=${n} bits wide enough`);
	check(make.arrows.find((a) => a.id === "position").from === "seedSlot" && make.arrows.find((a) => a.id === "slot").to === "seedSlot", `make n=${n} pad=${pad}: the cycle starts and ends at the slot`);
	if (pad) check(contains(Lay.readTurn({ pad, n }).boxes.keyColumn, Lay.readTurn({ pad, n }).boxes.keySlot), `read n=${n}: the key's slot is in its column`);
}
check(Lay.makeTurn({ pad: true, n: 16 }).arrows.map((a) => a.id).join() === "position,bits,number,keyPiece,keyNumber,clockSeed,clockKey,output,slot", "make: the arrows in the cycle's order");
check(Lay.makeTurn({ pad: false, n: 16 }).arrows.map((a) => a.id).join() === "position,bits,number,dict,slot", "make simple: the arrows in the cycle's order");
for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) { const lay = Lay.keyThrow({ sides }); check(Object.values(lay.boxes).every(inside), "throw d" + sides + " fits"); }
for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) for (const bits of [1, 2, 3, 4, 5]) {
	const lay = Lay.keyThrow({ sides, bits }), g = lay.faces;
	checkLayout(`throw d${sides} bits=${bits}`, lay);
	check(lay.boxes.tower.h >= bits * 16 && contains(lay.boxes.keyString, lay.boxes.keySlot) && lay.arrows.find((a) => a.id === "slot").to === "keySlot", `throw d${sides} bits=${bits}: the tower and the slot`);
	check(g.cols * g.rows >= sides && g.cols * g.rows - sides < g.cols && g.size >= 28, `throw d${sides}: room for every face, big enough to tap`);
	check(g.cols * g.size + (g.cols - 1) * g.gap <= lay.boxes.faces.w && g.rows * g.size + (g.rows - 1) * g.gap <= lay.boxes.faces.h, `throw d${sides}: the buttons fit their box`);
}
check(Lay.keyThrow({ sides: 6 }).faces.cols === 3 && Lay.keyThrow({ sides: 6 }).faces.rows === 2, "throw d6: three by two");
{
	const s = Lay.makeTurn({ pad: true, n: 16 }).boxes.seedString, k = Lay.keyThrow({ sides: 6 }).boxes.keyString;
	check(s.h === k.h && s.y === k.y, "the string being built is the same element in the turn and the throw");
}
{
	const box = { x: 444, y: 32, w: 140, h: 170 }, m = Lay.clockModule(box);
	const within = (b) => b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
	check(m.inputs.length === 2 && m.inputs.every(within) && within(m.output) && m.inputs[0].y === box.y && m.output.y + m.output.h === box.y + box.h, "clock module: inputs on top, output at the bottom");
	check(m.dial.cy - m.dial.r >= m.inputs[0].y + m.inputs[0].h && m.dial.cy + m.dial.r <= m.output.y && m.dial.cx - m.dial.r >= box.x && m.dial.cx + m.dial.r <= box.x + box.w, "clock module: the dial between the bands");
}
// the visual vocabulary (vocab.js), drawn with a fake svg/h: { tag, attrs, children }
{
	const node = (tag, attrs, ...children) => ({ tag, attrs: { ...(attrs || {}) }, children: children.flat().filter((c) => c !== null && c !== undefined && c !== false),
		listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; } });
	vm.runInContext(read("src/vocab.js"), ctx, { filename: "src/vocab.js" });
	const V = vm.runInContext("SeedcraftVocab", ctx)(node, node);
	const walk = (n, pred, out = []) => { if (n && typeof n === "object") { if (pred(n)) out.push(n); n.children.forEach((c) => walk(c, pred, out)); } return out; };
	const cls = (c) => (n) => (" " + (n.attrs.class || "") + " ").includes(" " + c + " ");
	const textOf = (n) => typeof n === "string" ? n : n.children.map(textOf).join("");
	const num = (v) => parseFloat(v);
	// everything drawn stays inside its box (what a reel scrolls is clipped to its window, so it is left out)
	const within = (root, b, what) => {
		const bad = [], e = 0.01, inB = (x, y) => x >= b.x - e && x <= b.x + b.w + e && y >= b.y - e && y <= b.y + b.h + e;
		const go = (n) => {
			if (!n || typeof n !== "object" || cls("v-reel-strip")(n) || n.tag === "clipPath" || n.tag === "mask") return;
			const a = n.attrs;
			if (n.tag === "circle" && !(inB(num(a.cx) - num(a.r), num(a.cy) - num(a.r)) && inB(num(a.cx) + num(a.r), num(a.cy) + num(a.r)))) bad.push("circle " + a.cx + "," + a.cy);
			if (n.tag === "rect" && !(inB(num(a.x), num(a.y)) && inB(num(a.x) + num(a.width), num(a.y) + num(a.height)))) bad.push("rect " + a.x + "," + a.y);
			if (n.tag === "text" && !(inB(num(a.x), num(a.y)) && inB(num(a.x), num(a.y) - num(a["font-size"]) * 0.75))) bad.push("text " + textOf(n) + " at " + a.x + "," + a.y);
			n.children.forEach(go);
		};
		go(root);
		check(!bad.length, `${what} fits its box ${bad.slice(0, 3).join("; ")}`);
	};
	const things = Array.from({ length: 32 }, (_, i) => ({ name: "Piece " + i, emoji: i % 3 ? "" : "🍎", colour: i % 2 ? "#d04040" : "", photo: "", symbol: "" }));
	const lay = Lay.makeTurn({ pad: true, n: 16 }), rlay = Lay.readTurn({ pad: true, n: 16 });

	// string: 13 positions, the turn's piece bigger and ringed; holes dashed; nothing where there is no position
	const items = Array.from({ length: 13 }, (_, i) => i < 6 ? i : null);
	const s = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items, firstPosition: 9, current: 6 });
	const pieces = walk(s, cls("v-piece")), cur = walk(s, cls("v-current"));
	check(pieces.length === 13 && cur.length === 1 && pieces.indexOf(cur[0]) === 6, "string: 13 pieces, the 7th marked as the turn's");
	check(walk(s, cls("v-hole")).length === 7, "string: the empty positions are holes");
	check(walk(s, (n) => n.tag === "text" && textOf(n) === "15").length === 1, "string: each piece's position beside it (9 + 6)");
	const rad = (p) => Math.max(...walk(p, (n) => n.tag === "circle").map((c) => num(c.attrs.r)));
	check(rad(cur[0]) > rad(pieces[5]), "string: the turn's piece is bigger");
	const midCx = (p) => num(walk(p, (n) => n.tag === "circle")[0].attrs.cx), sl = lay.boxes.seedSlot;
	check(Math.abs(midCx(cur[0]) - (sl.x + sl.w / 2)) < 1, "string: the turn's piece is in the slot's box");
	within(s, lay.boxes.seedString, "string build");
	const edge = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items: [undefined, undefined, 3, 4, null], current: 3 });
	check(walk(edge, cls("v-piece")).length === 3, "string: no piece where the string has no position");
	const ref = V.string({ box: lay.boxes.keyString, orientation: "v", role: "reference", kind: "key", things, items: [1, 2, 3, 4, 5, 6, 7], firstPosition: 11, current: 3 });
	check(walk(ref, cls("v-piece")).length === 7 && walk(ref, cls("v-turn-frame")).length === 1 && walk(ref, cls("v-thread-ref")).length === 1, "string: a reference, dotted, its turn's piece framed");
	const refCy = num(walk(walk(ref, cls("v-current"))[0], (n) => n.tag === "circle")[0].attrs.cy);
	check(Math.abs(refCy - 131) < 1, "string: the reference's turn piece is level with the arrow that leaves it");
	within(ref, lay.boxes.keyString, "string reference");
	let slotHit = null;
	const rd = V.string({ box: rlay.boxes.keyColumn, orientation: "v", role: "read", kind: "key", things, items: [2, 9, 4, null, undefined, undefined, undefined], firstPosition: 1, current: 3, onSlot: (i) => { slotHit = i; } });
	const vals = walk(rd, cls("v-value"));
	check(vals.length === 3 && vals.every(cls("v-c-key")) && textOf(vals[1]) === "9", "string read: each piece's number beside it, in its string's colour");
	const slot = walk(rd, cls("v-slot"))[0];
	check(slot && textOf(slot).includes("+") && (slot.listeners.click(), slotHit === 3), "string read: the turn's hole is a «+» to tap");
	const rk = rlay.boxes.keySlot, rcx = num(walk(slot, (n) => n.tag === "circle")[0].attrs.cx), rcy = num(walk(slot, (n) => n.tag === "circle")[0].attrs.cy);
	check(rcx > rk.x && rcx < rk.x + rk.w && rcy > rk.y && rcy < rk.y + rk.h, "string read: the turn's hole is in the slot's box");
	within(rd, rlay.boxes.keyColumn, "string read");
	check(walk(rd, (n) => n.tag === "text" && textOf(n) === "⚿").length === 1 && walk(s, (n) => n.tag === "text" && textOf(n) === "🌱").length === 1, "string: the seed's or the key's icon beside it");

	// dictionary: a reel turns until its value's row is centred in a 3-row window
	for (const b of [lay.boxes.keyDict, lay.boxes.seedDict]) {
		const d = V.dictionary({ box: b, things: things.slice(0, 16), mode: "reel", value: 11, icon: "key" });
		const strip = walk(d, cls("v-reel-strip"))[0], win = walk(d, cls("v-reel-window"))[0];
		const ty = num(/translate\(0[ ,]+(-?[\d.]+)\)/.exec(strip.attrs.transform)[1]);
		const row11 = walk(strip, (n) => cls("v-dict-row")(n) && n.attrs["data-value"] === "11")[0];
		const rowY = num(row11.attrs["data-y"]), rowH = num(win.attrs.height) / 3;
		check(Math.abs(rowY + ty - (num(win.attrs.y) + rowH)) < 0.2, `dictionary ${b.h}px: the reel moves to row 11, in the window's middle`);
		check(strip.attrs["data-value"] === "11" && walk(d, cls("v-dict-on")).length === 1, `dictionary ${b.h}px: the window frames the row`);
		within(d, b, `dictionary reel ${b.h}px`);
	}
	const st16 = V.dictionary({ box: { x: 20, y: 40, w: 200, h: 290 }, things: things.slice(0, 16), mode: "static", value: 5, icon: "seed" });
	check(walk(st16, cls("v-dict-row")).length === 16 && walk(st16, cls("v-dict-on")).length === 1, "dictionary static: every row, the turn's framed");
	within(st16, { x: 20, y: 40, w: 200, h: 290 }, "dictionary static");
	let picked = null;
	const pk = V.dictionary({ box: { x: 100, y: 60, w: 480, h: 240 }, things: things.slice(0, 32), mode: "picker", value: null, icon: "seed", onPick: (v) => { picked = v; } });
	const buttons = walk(pk, cls("v-pick"));
	check(buttons.length === 32 && buttons.every((b) => b.attrs.role === "button" && b.attrs.tabindex === "0"), "dictionary picker: every piece a button");
	buttons[7].listeners.click(); check(picked === 7, "dictionary picker: a tap picks the piece");
	picked = null; buttons[9].listeners.keydown({ key: "Enter", preventDefault() {} }); check(picked === 9, "dictionary picker: Enter picks too");
	within(pk, { x: 100, y: 60, w: 480, h: 240 }, "dictionary picker");

	// bits: little boxes with «₂»; the header's and the padding's dashed
	const bt = V.bits({ box: lay.boxes.bits, bits: [1, 0, 1, 1], orientation: "row", roles: ["header", "data", "data", "padding"] });
	check(walk(bt, cls("v-bit")).length === 4 && walk(bt, cls("v-bit-dashed")).length === 2 && textOf(bt).includes("₂") && textOf(bt).includes("1011"), "bits: four boxes, two dashed, with ₂");
	within(bt, lay.boxes.bits, "bits row");
	const th = Lay.keyThrow({ sides: 6, bits: 5 }), tw = V.bits({ box: th.boxes.tower, bits: [1, 0, null, null, null], orientation: "tower", colour: "key" });
	check(walk(tw, cls("v-bit-empty")).length === 3 && cls("v-c-key")(tw), "bits tower: the empty ones still to come, in the key's colour");
	within(tw, th.boxes.tower, "bits tower");

	// clock: the module's bands where the layout puts them; the sum mod N
	for (const n of [2, 16, 32]) for (const [b, sign] of [[lay.boxes.clock, 1], [rlay.boxes.clock, -1]]) {
		const from = n - 1, by = Math.min(n - 1, 9), c = V.clock({ box: b, n, from, by, sign, phase: "done" }), m = Lay.clockModule(b);
		const out = walk(c, cls("v-clock-out"))[0];
		check(textOf(out) === String(S.clockStep(from, by, n, sign).value), `clock n=${n} sign=${sign}: the output is the sum mod N`);
		const ins = walk(c, cls("v-clock-in"));
		check(ins.length === 2 && textOf(ins[0]) === String(from) && textOf(ins[1]) === (sign > 0 ? "+" : "−") + by && cls("v-c-key")(ins[1]), `clock n=${n}: «${from} | ${sign > 0 ? "+" : "−"}${by}», the key's in its colour`);
		const cells = walk(c, cls("v-clock-cell")).map((r) => ({ x: num(r.attrs.x), y: num(r.attrs.y), w: num(r.attrs.width), h: num(r.attrs.height) }));
		check(same(cells, [...m.inputs, m.output]), `clock n=${n}: the bands are the layout's`);
		const ring = walk(c, cls("v-clock-ring"))[0];
		check(num(ring.attrs.cx) === m.dial.cx && num(ring.attrs.cy) === m.dial.cy && num(ring.attrs.r) === m.dial.r, `clock n=${n}: the dial is the layout's`);
		const labels = walk(c, cls("v-clock-n")).map(textOf), to = S.clockStep(from, by, n, sign).value;
		check(n <= 16 ? labels.length === n : labels.includes(String(from)) && labels.includes(String(to)) && labels.length <= n / 4 + 2 && labels.includes("8"), `clock n=${n}: ${n <= 16 ? "every number" : "every 4th number and the sum's"} written`);
		check(walk(c, cls("v-clock-tick")).length === n, `clock n=${n}: a tick per number`);
		check(walk(c, cls("v-clock-n")).every((t) => Math.hypot(num(t.attrs.x) - m.dial.cx, num(t.attrs.y) - m.dial.cy) + 0.6 * num(t.attrs["font-size"]) <= m.dial.r), `clock n=${n}: the numbers inside the ring, clear of the bands`);
		within(c, b, `clock n=${n}`);
	}
	for (const [n, from, by] of [[32, 13, 1], [32, 12, 3], [32, 31, 1], [16, 15, 9], [8, 7, 7]]) {
		const t = walk(V.clock({ box: lay.boxes.clock, n, from, by, sign: 1, phase: "done" }), cls("v-clock-n"));
		check(t.every((a, i) => t.slice(i + 1).every((b) => Math.hypot(num(a.attrs.x) - num(b.attrs.x), num(a.attrs.y) - num(b.attrs.y)) >= num(a.attrs["font-size"]))), `clock n=${n} ${from}+${by}: its numbers do not touch`);
	}
	const ci = V.clock({ box: lay.boxes.clock, n: 16, from: 11, by: 9, sign: 1, phase: "inputs" });
	check(textOf(walk(ci, cls("v-clock-out"))[0]) === "" && textOf(walk(ci, cls("v-clock-by"))[0]) === "", "clock inputs: no output yet");
	const cr = V.clock({ box: lay.boxes.clock, n: 16, from: 11, by: 9, sign: 1, phase: "run" });
	check(textOf(walk(cr, cls("v-clock-out"))[0]) === "4", "clock run, without animation: the value appears directly");

	// QR: a grid; the turn's squares in blue
	const q = V.qr({ box: lay.boxes.qr, size: 21, modules: (r, c) => (r + c) % 2 === 0, turnCells: [[9, 9], [9, 10], [10, 9]], painted: new Map([[0, 1]]) });
	check(walk(q, cls("v-qr-turn")).length === 3, "qr: the turn's squares marked");
	within(q, lay.boxes.qr, "qr");

	// arrows: dashed, right angles, the past ones nearly invisible
	const past = V.arrow({ points: [[10, 10], [50, 10], [50, 40]], colour: "qr", state: "past" });
	check(num(past.attrs.opacity) < 0.1, "arrow: a past one nearly invisible");
	const now = V.arrow({ points: [[10, 10], [50, 10]], colour: "key", state: "current" });
	check(cls("v-c-key")(now) && walk(now, cls("v-arrow-line"))[0].attrs.d === "M10 10 L50 10" && walk(now, (n) => n.tag === "mask").length === 1, "arrow: the current one drawn along its path, in its colour");
	check(V.arrow({ points: [[0, 0], [5, 0]], colour: "qr", state: "hidden" }).attrs.visibility === "hidden", "arrow: hidden");
	let diag = false; try { V.arrow({ points: [[0, 0], [5, 5]], colour: "qr", state: "current" }); } catch { diag = true; }
	check(diag, "arrow: refuses a diagonal");

	// cards: one per option, at most two ✓ and two ✕
	let chose = null;
	const cd = V.cards({ options: [{ id: "a", art: node("svg", {}), title: "A", pros: ["p1", "p2", "p3"], cons: ["c1"] }, { id: "b", art: null, title: "B", pros: ["p"], cons: ["c1", "c2"] }], chosen: "b", onChoose: (id) => { chose = id; } });
	const cardList = walk(cd, cls("v-card"));
	check(cardList.length === 2 && walk(cardList[0], cls("v-pro")).length === 2 && walk(cardList[0], cls("v-con")).length === 1
		&& walk(cardList[1], cls("v-con")).length === 2 && textOf(cardList[0]).includes("✓") && textOf(cardList[1]).includes("✕"), "cards: two cards, with their ✓ and ✕ (two at most)");
	check(cls("on")(cardList[1]) && cardList[1].attrs["aria-pressed"] === "true" && !cls("on")(cardList[0]), "cards: the chosen one marked");
	cardList[0].attrs.on.click(); check(chose === "a", "cards: a tap chooses");

	// a die, and its faces as buttons
	check(textOf(V.die({ sides: 6, face: 3, size: 56 })) === "4" && textOf(V.die({ sides: 10, face: 3 })) === "3" && textOf(V.die({ sides: 6, face: null })) === "?", "die: its face");
	let pressed = null;
	const fb = V.faceButton({ sides: 20, face: 4, onPress: (f) => { pressed = f; }, size: 31 });
	check(fb.tag === "button" && cls("v-face")(fb), "faceButton: a button");
	fb.attrs.on.click(); check(pressed === 4, "faceButton: a press gives its face");
	check(V.faceButton({ sides: 6, face: 1, disabled: true }).attrs.disabled === true, "faceButton: disabled");
}
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${padVectors.length} pad vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
