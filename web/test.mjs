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
	check(make.arrows.find((a) => a.id === "position").from === "posBox" && make.arrows.find((a) => a.id === "slot").to === "seedSlot", `make n=${n} pad=${pad}: the cycle starts at posBox and ends at the slot`);
	if (pad) check(contains(Lay.readTurn({ pad, n }).boxes.keyColumn, Lay.readTurn({ pad, n }).boxes.keySlot), `read n=${n}: the key's slot is in its column`);
}
check(S.entropyNumber(new Uint8Array(16)) === "0" && S.entropyNumber(new Uint8Array(16).fill(255)) === "340282366920938463463374607431768211455", "entropyNumber: big-endian decimal");
check(S.groupDigits("1234567", 5).join("|") === "1 234 567" && S.groupDigits("9".repeat(78), 5).length === 6, "groupDigits: threes from the right, 5 groups a line; 24 words in 6 lines");
for (const n of [2, 16, 32]) for (const pad of [false, true]) for (const file of pad ? [false, true] : [false]) {
	const lay = Lay.makeTurn({ pad, n, file }), pos = lay.arrows.find((a) => a.id === "position"), slot = lay.arrows.find((a) => a.id === "slot");
	check(pos.from === "posBox" && pos.points[0][0] === lay.boxes.posBox.x && slot.points[slot.points.length - 1][0] === 360, `make n=${n} pad=${pad} file=${file}: position leaves its box, the slot is reached at x 360`);
}
const margin = (name, lay) => check(Object.entries(lay.boxes).every(([id, b]) => id === "guide" || id === "question" || (b.x >= 16 && b.x + b.w <= 664 && b.y + b.h <= 334)), `${name} within the 16 px margin`);
for (const n of [2, 4, 8, 16, 32]) for (const pad of [false, true]) for (const file of pad ? [false, true] : [false]) {
	const lay = Lay.makeTurn({ pad, n, file }), b = lay.boxes;
	margin(`make n=${n} pad=${pad} file=${file}`, lay);
	check(Object.entries(b).filter(([id, x]) => x.y < Lay.BUILT.y && id !== "guide" && id !== "qr").every(([, x]) => x.h <= b.qr.h) && b.qr.w === b.qr.h && b.qr.w >= 180, `make n=${n} pad=${pad}: the QR the tallest of the top band, ≥ 180`);
	margin(`read n=${n} pad=${pad}`, Lay.readTurn({ pad, n }));
}
for (const pad of [false, true]) margin(`checkFinal pad=${pad}`, Lay.checkFinal({ pad }));
for (const sides of [2, 6, 20]) for (const tool of ["dice", "device", "bag"]) margin(`throw d${sides} ${tool}`, Lay.keyThrow({ sides, tool }));
for (const toWords of [false, true]) for (const end of toWords ? [false, true] : [false]) checkLayout(`seedQr toWords=${toWords} end=${end}`, Lay.seedQr({ toWords, end }));
{ const q = Lay.seedQr({}), r = Lay.seedQr({ toWords: true });
  check(q.arrows.map((a) => `${a.from}>${a.to}`).join() === "words>number,number>qr" && r.arrows.map((a) => `${a.from}>${a.to}`).join() === "qr>number,number>words", "seedQr: words → number → QR, and back");
  check(q.boxes.qr.w === q.boxes.qr.h && q.boxes.qr.x > q.boxes.number.x && q.boxes.number.x > q.boxes.words.x, "seedQr: words, number, QR from left to right"); }
check(Lay.qrCellsBox({ x: 20, y: 40, w: 210, h: 210 }, 21, []) === null, "qrCellsBox: no cells, no marker");
{ const m = Lay.qrCellsBox({ x: 20, y: 40, w: 210, h: 210 }, 21, [[0, 0], [1, 1]]); check(m.x === 18 && m.y === 38 && m.w === 24 && m.h === 24, "qrCellsBox: the cells' bounds, 2 px out"); }
check(Math.abs(Lay.pitch(Lay.BUILT, 13) - (648 - 40) / 13) < 1e-9, "pitch: as the string spaces its pieces");
check(Lay.makeTurn({ pad: true, n: 16 }).arrows.map((a) => a.id).join() === "position,bits,number,keyPiece,keyNumber,clockSeed,clockKey,output,slot", "make: the arrows in the cycle's order");
// a key file: its column, its number straight from the turn's row (no key dictionary), then the same clock
for (const n of [2, 4, 8, 16, 32]) {
	const lay = Lay.makeTurn({ pad: true, n, file: true }), m = Lay.clockModule(lay.boxes.clock), into = (id) => ends(lay.arrows.find((a) => a.id === id));
	checkLayout(`make n=${n} file`, lay);
	for (const a of lay.arrows) check(onBorder(starts(a), lay.boxes[a.from]) && onBorder(ends(a), lay.boxes[a.to]), `make n=${n} file: arrow ${a.id} leaves and reaches its boxes`);
	check(!lay.boxes.keyDict && lay.arrows.map((a) => `${a.id}:${a.from}>${a.to}`).join() === "position:posBox>qr,bits:qr>bits,number:bits>number,keyNumber:keyString>keyNumber,clockSeed:number>clock,clockKey:keyNumber>clock,output:clock>seedDict,slot:seedDict>seedSlot",
		`make n=${n} file: no key dictionary, the file's row → its number → the clock`);
	check(inCell(into("clockSeed"), m.inputs[0]) && inCell(into("clockKey"), m.inputs[1]), `make n=${n} file: each number enters its own input cell`);
	const row = lay.boxes.keyString.y + lay.boxes.keyString.h / 2, k = lay.arrows.find((a) => a.id === "keyNumber");
	check(Math.abs(starts(k)[1] - row) < 12, `make n=${n} file: the key's number leaves from the turn's row`);
}
check(Lay.makeTurn({ pad: false, n: 16 }).arrows.map((a) => a.id).join() === "position,bits,number,dict,slot", "make simple: the arrows in the cycle's order");
for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) { const lay = Lay.keyThrow({ sides }); check(Object.values(lay.boxes).every(inside), "throw d" + sides + " fits"); }
for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) for (const bits of [1, 2, 3, 4, 5]) {
	const lay = Lay.keyThrow({ sides, bits }), g = lay.faces;
	checkLayout(`throw d${sides} bits=${bits}`, lay);
	check(lay.boxes.tower.h >= bits * 16 && contains(lay.boxes.keyString, lay.boxes.keySlot) && lay.arrows.find((a) => a.id === "slot").to === "keySlot", `throw d${sides} bits=${bits}: the tower and the slot`);
	check(g.cols * g.rows >= sides && g.cols * g.rows - sides < g.cols && g.size >= 28, `throw d${sides}: room for every face, big enough to tap`);
	check(g.cols * g.size + (g.cols - 1) * g.gap <= lay.boxes.faces.w && g.rows * g.size + (g.rows - 1) * g.gap <= lay.boxes.faces.h, `throw d${sides}: the buttons fit their box`);
}
// the throw with a bag, the device, a key file; each face's button, the thrown faces' places, the file's row
for (const bits of [1, 2, 3, 4, 5]) for (const file of [false, true]) {
	{
		const lay = Lay.keyThrow({ bits, tool: "device", file });
		checkLayout(`throw device bits=${bits} file=${file}`, lay);
		check(!lay.boxes.faces && lay.boxes.die.w >= 80 && lay.boxes.tower.h >= bits * 16, `throw device bits=${bits}: one die instead of the faces`);
	}
	// the bag: from the piece picked, straight to its slot (a string), or to its number and then its place (a file)
	for (let v = 0; v < 2 ** bits; v++) {
		const n = 2 ** bits, lay = Lay.keyThrow({ bits, tool: "bag", file, n, value: v }), b = lay.boxes, cell = Lay.pickerCell(b.picker, n, v), first = lay.arrows[0].points[0];
		checkLayout(`throw bag n=${n} v=${v} file=${file}`, lay);
		check(!b.tower && !b.faces && !b.keyDict && !b.piece && b.picker.w >= 300 && b.picker.h >= 160, `throw bag n=${n}: the picker, no tower, no dictionary, no piece`);
		check(file ? lay.arrows.map((a) => `${a.id}:${a.from}>${a.to}`).join() === "number:picker>number,slot:number>keySlot" && !!b.number && first[0] === b.picker.x + b.picker.w && first[1] >= cell.y && first[1] <= cell.y + cell.h
			: lay.arrows.map((a) => `${a.id}:${a.from}>${a.to}`).join() === "slot:picker>keySlot" && !b.number && first[1] === b.picker.y + b.picker.h && first[0] >= cell.x && first[0] <= cell.x + cell.w,
		`throw bag n=${n} v=${v} file=${file}: the arrow leaves from beside the piece picked`);
	}
	for (const sides of [2, 6, 20]) {
		const lay = Lay.keyThrow({ sides, bits, file });
		checkLayout(`throw d${sides} bits=${bits} file=${file}`, lay);
		check(file ? !lay.boxes.keyDict && !lay.boxes.piece && lay.arrows.map((a) => a.id).join() === "number,slot" && lay.arrows[1].from === "number"
			: lay.arrows.map((a) => a.id).join() === "number,dict,piece,slot", `throw d${sides} bits=${bits} file=${file}: the arrows in order`);
	}
}
for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) {
	const lay = Lay.keyThrow({ sides, bits: 4 }), fb = Array.from({ length: sides }, (_, i) => Lay.faceBox(lay, i));
	check(fb.every((b) => contains(lay.boxes.faces, b)) && fb.every((b, i) => fb.slice(i + 1).every((c) => !overlap(b, c))), `throw d${sides}: each face's button in the grid, apart`);
	const b = Math.floor(Math.log2(sides));
	for (const n of [2, 4, 8, 16, 32]) {
		const k = Math.log2(n), l = Lay.keyThrow({ sides, bits: k }), used = [];
		for (let from = 0; from < k; from += b) used.push({ at: used.length, from, to: Math.min(k, from + b) });
		const marks = Lay.throwMarks(l, { bits: k, used, rejected: Array.from({ length: 9 }, (_, i) => 10 + i) });
		check(marks.used.every((m) => contains(l.boxes.dice, m.face) && m.face.w >= 14 && contains(l.boxes.dice, m.badge) && !overlap(m.badge, m.face)
			&& m.badge.h >= Lay.BADGE * 1.4 && m.badge.w >= Lay.BADGE * 2), `throw d${sides} N=${n}: each face that counts beside its bits, its badge (two digits of ${Lay.BADGE}) before it`);
		check(marks.used.every((m, i) => marks.used.slice(i + 1).every((o) => !overlap(m.face, o.face) && !overlap(m.badge, o.badge))), `throw d${sides} N=${n}: the faces that count apart`);
		check(marks.rejected.length >= 4 && marks.rejected.every((m) => contains(l.boxes.rejected, m.face) && contains(l.boxes.rejected, m.badge) && !overlap(m.face, m.badge))
			&& marks.rejected[marks.rejected.length - 1].at === 18, `throw d${sides} N=${n}: the faces thrown again aside, the last ones`);
		// read from the lectern: each face thrown again at least 24 units, its badge's number 10, with room for two digits and ↻
		check(Lay.BADGE >= 10 && marks.rejected.every((m) => m.face.w >= 24 && m.face.h >= 24 && m.badge.h >= Lay.BADGE * 1.4 && m.badge.w >= Lay.BADGE * (0.6 * 2 + 0.8) + 2 + Lay.BADGE * 0.7)
			&& marks.rejected.every((m, i) => marks.rejected.slice(i + 1).every((o) => !overlap(m.face, o.face) && !overlap(m.badge, o.badge) && !overlap(m.face, o.badge) && !overlap(m.badge, o.face))),
		`throw d${sides} N=${n}: the faces thrown again big enough to read (faces ≥ 24, badges ≥ ${Lay.BADGE}), apart`);
	}
}
for (const pos of [0, 3, 15, 16, 53, 90]) {
	const r = Lay.fileRow(pos, { row: S.PAD_ROW, group: S.PAD_GROUP }), x = r.xs[r.col], built = Lay.keyThrow({ sides: 6, file: true }).boxes;
	check(r.row === Math.floor(pos / 16) && x === built.keySlot.x + built.keySlot.w / 2 && r.xs.every((v) => v - 7 >= built.keyString.x && v + 7 <= built.keyString.x + built.keyString.w)
		&& r.xs.length === S.PAD_ROW + 1 && r.xs[4] - r.xs[3] === 28 && r.xs[16] - r.xs[15] === 28, `fileRow ${pos}: its place under the slot, in groups of 4, the check after them, inside the string's box`);
}
// your own dictionary: naming, checking, as it is
check(Lay.binary(5, 16).join("") === "0101" && Lay.binary(0, 2).join("") === "0" && Lay.binary(31, 32).join("") === "11111" && Lay.binary(2, 4).join("") === "10"
	&& [2, 4, 8, 16, 32].every((n) => Lay.binary(n - 1, n).length === Lay.bitsOf(n)), "binary: as many bits as N takes (bitsOf), the highest first");
for (const n of [2, 4, 8, 16, 32]) {
	const nm = Lay.dictName({ n }), ck = Lay.dictCheck({ n }), as = Lay.dictAsIs({ n });
	checkLayout(`dictName n=${n}`, nm); checkLayout(`dictCheck n=${n}`, ck); checkLayout(`dictAsIs n=${n}`, as);
	check(nm.boxes.bits.w >= Lay.bitsOf(n) * Lay.BIT + 8, `dictName n=${n}: room for its ${Lay.bitsOf(n)} bits and ₂`);
	check(ck.answers.cols * ck.answers.rows >= n && ck.boxes.answers.w / ck.answers.cols >= 22 && ck.boxes.answers.h / ck.answers.rows >= 30, `dictCheck n=${n}: a button per number, each big enough to tap`);
	check(as.boxes.dict.h / Math.ceil(n / as.columns) >= 15, `dictAsIs n=${n}: every row shows (${as.columns} column${as.columns > 1 ? "s" : ""})`);
	check(as.boxes.actions.w >= 200 && as.boxes.actions.h >= 150, `dictAsIs n=${n}: room for its actions`);
}
for (const n of [4, 16, 32]) { const b = Lay.dictAsIs({ n }).boxes; check(b.dict.w === b.actions.w && b.dict.x === 16 && b.actions.x + b.actions.w === 664, `dictAsIs n=${n}: two equal columns, margin to margin`); }
{
	// «Your QR»: the question over one line, the words on the arrows' line, every line of the number inside its box (12 and 24 words)
	const q = Lay.seedQr({});
	check(q.boxes.question.x === 16 && q.boxes.question.w === 648, "seedQr: the question has the whole width, on one line");
	check(q.boxes.words.y + q.boxes.words.h / 2 === q.arrows[0].points[0][1], "seedQr: the words centred on the arrows' line");
	for (const [bytes, digits] of [[16, 39], [32, 78]]) {
		const lines = Math.ceil(Math.ceil(digits / 3) / 5), f = Lay.digitFont(q.boxes.number, 19, lines);
		check(19 * 0.62 * f <= q.boxes.number.w - 8 && (lines + 1.6) * 1.25 * f <= q.boxes.number.h && f >= 9, `seedQr: ${bytes * 8} bits: the number's ${lines} lines (and its bits line) fit their box at ${f}`);
	}
}
check(Lay.keyThrow({ sides: 6 }).faces.cols === 3 && Lay.keyThrow({ sides: 6 }).faces.rows === 2, "throw d6: three by two");
// reading back: the dictionary in a popup, every button big enough to tap; the two ends
for (const n of [2, 4, 8, 16, 32]) {
	const pp = Lay.pickerPopup({ n }), g = Lay.pickerGrid(pp.boxes.picker, n), p = pp.boxes.picker;
	check(p.x >= 0 && p.y >= 0 && p.x + p.w <= pp.view.w && p.y + p.h <= pp.view.h && pp.view.w <= 440 && pp.view.h <= 250, `pickerPopup n=${n}: the picker in its canvas, which fits a popup`);
	check(g.cols * g.rows >= n && g.cw >= 40 && g.ch >= 40, `pickerPopup n=${n}: a button per piece, each at least 40 × 40 (${Math.round(g.cw)} × ${Math.round(g.ch)})`);
}
check(typeof Lay.readFinal === "undefined", "readFinal gone: recovering ends on seedQr");
for (const pad of [false, true]) {
	const cf = Lay.checkFinal({ pad }), b = cf.boxes, rt = Lay.readTurn({ pad, n: 16 }).boxes;
	checkLayout(`checkFinal pad=${pad}`, cf);
	check(b.made.w === b.read.w && b.made.h === b.read.h && b.made.y === b.read.y && b.sign.x > b.made.x + b.made.w && b.sign.x + b.sign.w < b.read.x, `checkFinal pad=${pad}: the two QR codes side by side, the sign between them`);
	check(b.seedColumn.h === rt.seedColumn.h && b.seedRow.y === rt.row.y && contains(b.seedColumn, b.seedRow) && (!pad || contains(b.keyColumn, b.keyRow)) && !!b.keyColumn === pad, `checkFinal pad=${pad}: the strings as the turn reads them, a row each to frame`);
}
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
// a key file's column: 7 places inside it, the middle one level with the turn's row (read) or with the arrow that leaves it (make)
for (const n of [2, 16, 32]) {
	const rt = Lay.readTurn({ pad: true, n }).boxes, fc = Lay.fileColumn(rt.keyColumn);
	check(fc.rows.length === 7 && fc.rows.every((r, j) => contains(rt.keyColumn, r.ring) && (j === 0 || r.y > fc.rows[j - 1].y) && r.ring.h >= 24)
		&& fc.rows.every((r, j) => j === 0 || !overlap(r.ring, fc.rows[j - 1].ring)), `fileColumn read n=${n}: 7 places in the column, apart, each big enough to tap`);
	check(Math.abs(fc.rows[3].y - (rt.row.y + rt.row.h / 2)) < 1 && fc.rows.every((r) => [r.digit, r.value, r.pos].every(([x, y]) => x > rt.keyColumn.x && x < rt.keyColumn.x + rt.keyColumn.w && y > rt.keyColumn.y && y < rt.keyColumn.y + rt.keyColumn.h)),
		`fileColumn read n=${n}: the middle place on the turn's row, its texts inside the column`);
	const mk = Lay.makeTurn({ pad: true, n, file: true }), ref = Lay.fileColumn(mk.boxes.keyString, { role: "reference" }), from = mk.arrows.find((a) => a.id === "keyNumber").points[0];
	check(ref.rows.length === 7 && ref.rows.every((r) => contains(mk.boxes.keyString, r.frame)) && Math.abs(ref.rows[3].y - from[1]) < 1, `fileColumn reference n=${n}: the turn's place framed, level with the arrow to its number`);
}
// a string read, vertical: each row's position, piece and number side by side, never one over the other;
// the position on the column's outer side (the seed's on the left, the key's on the right), the number beside the piece
{
	const textW = (s, fs) => 0.6 * fs * String(s).length;
	const rowsApart = (c, col, what) => {
		check(c.rows.length === 7 && c.rows.every((r) => [r.pos, r.piece, r.value].every((x) => contains(col, x)) && !overlap(r.pos, r.piece) && !overlap(r.pos, r.value) && !overlap(r.piece, r.value)
			&& r.pos.y === r.piece.y && r.value.y === r.piece.y), `${what}: position, piece and number side by side in each row, inside the column`);
		check(c.outer === "left" ? c.rows.every((r) => r.pos.x === col.x && r.value.x > r.piece.x) : c.rows.every((r) => r.pos.x + r.pos.w === col.x + col.w && r.value.x < r.piece.x),
			`${what}: the position on the outer side (${c.outer}), the number beside the piece`);
		check(c.rows.every((r) => r.pos.w >= textW(364, 10) && r.value.w >= textW(31, 13) && 2 * c.r <= r.piece.w && r.piece.h >= 2 * c.r), `${what}: room for «364», «31» and the piece`);
	};
	for (const pad of [false, true]) for (const n of [2, 16, 32]) {
		const rt = Lay.readTurn({ pad, n });
		rowsApart(rt.columns.seed, rt.boxes.seedColumn, `readTurn pad=${pad} n=${n} seed`);
		check(rt.columns.seed.outer === "left" && contains(rt.columns.seed.rows[3].piece, rt.boxes.seedSlot), `readTurn pad=${pad} n=${n}: the seed's slot on its piece's place`);
		if (pad) {
			rowsApart(rt.columns.key, rt.boxes.keyColumn, `readTurn n=${n} key`);
			check(rt.columns.key.outer === "right" && contains(rt.columns.key.rows[3].piece, rt.boxes.keySlot), `readTurn n=${n}: the key's slot on its piece's place`);
			// the key file's column the same way: its number beside the character, its place outside
			const fc = Lay.fileColumn(rt.boxes.keyColumn);
			check(fc.rows.every((r) => !overlap(r.valueBox, r.digitBox) && !overlap(r.posBox, r.digitBox) && !overlap(r.posBox, r.valueBox) && r.posBox.x + r.posBox.w === rt.boxes.keyColumn.x + rt.boxes.keyColumn.w
				&& [["value", "valueBox"], ["pos", "posBox"], ["digit", "digitBox"]].every(([p, bx]) => p === "digit" ? Math.abs(r[p][0] - (r[bx].x + r[bx].w / 2)) < 0.01 : Math.abs(r[p][0] - (r[bx].x + r[bx].w / 2)) < 0.01)),
			`fileColumn read n=${n}: the number, the character and the place side by side, the place outside`);
		}
	}
	for (const pad of [false, true]) {
		const cf = Lay.checkFinal({ pad });
		rowsApart(cf.columns.seed, cf.boxes.seedColumn, `checkFinal pad=${pad} seed`);
		if (pad) rowsApart(cf.columns.key, cf.boxes.keyColumn, "checkFinal key");
	}
}
// storing it: two places apart with a key, the border between them; the string's place and the dictionary apart with none
for (const pad of [false, true]) {
	const lay = Lay.store({ pad }), b = lay.boxes, places = pad ? ["a", "b"] : ["a", "d"];
	checkLayout(`store pad=${pad}`, lay);
	for (const p of places) for (const part of ["Title", "Dict", "Note", "Saved", ...(p === "d" ? [] : ["String"])])
		check(contains(b[p], b[p + part]), `store pad=${pad}: ${p}${part} in its place`);
	check(b.forget.y >= Math.max(...places.map((p) => b[p].y + b[p].h)) && !!b.border === pad && !!b.apart === pad, `store pad=${pad}: «Forget» at the foot, the border only with a key`);
	if (pad) check(b.border.x >= b.a.x + b.a.w && b.border.x + b.border.w <= b.b.x && b.border.y === b.a.y && b.border.h === b.a.h && b.apart.y + b.apart.h <= b.a.y
		&& b.apart.x < b.border.x && b.apart.x + b.apart.w > b.border.x + b.border.w && b.a.w === b.b.w, `store: the border between the two places, as tall, «never together» over it, the places alike`);
	check(Object.entries(b).every(([id, x]) => id === "guide" || x.y >= 28), `store pad=${pad}: nothing in the guide's band`);
	if (pad) {
		const f = lay.file, line = 10;
		check(contains(b.bString, f.icon) && contains(b.bString, f.sheet) && !overlap(f.icon, f.sheet) && f.lines.length === 3
			&& f.lines.every(([x, y], j) => x > f.sheet.x && y - line >= f.sheet.y && y + 3 <= f.sheet.y + f.sheet.h && (j === 0 || y - f.lines[j - 1][1] >= line + 2)),
		"store: the key file in B's string box, its icon beside its sheet, three lines inside it, apart");
	} else check(!lay.file, "store with no key: no key file");
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

	// the QR's fixed areas, the cursor label, black and white bits, the labelled dictionary
	for (const size of [21, 25]) {
		const fm = S.formatModules(size), fn = S.functionModules(size);
		check(fm.length === 30 && fm.every(([r, c]) => fn.has(r * size + c)) && fm.some(([r, c]) => r === 8 && c === 0) && fm.some(([r, c]) => r === size - 1 && c === 8), `formatModules(${size}): 30 cells inside the function modules`);
		const qb = { x: 0, y: 40, w: 216, h: 216 }, fx = V.qr({ box: qb, size, modules: () => false, fixed: fn, legend: "fixed" });
		check(walk(fx, cls("v-qr-fixed")).length > 100, `qr(${size}) with fixed: fixed cells drawn`);
		const bg = walk(fx, cls("v-qr-bg"))[0];
		check(num(bg.attrs.width) === 216 - 14 && walk(fx, (n) => n.tag === "text" && textOf(n) === "fixed").length === 1, `qr(${size}) with legend: side is min(w,h) - 14, legend drawn`);
		within(fx, qb, `qr(${size}) with legend`);
	}
	{
		const qb = { x: 0, y: 40, w: 200, h: 200 }, mk = V.qr({ box: qb, size: 21, modules: () => false, turnCells: [[0, 20], [1, 20]], markerLabel: "Position 3", fixed: S.functionModules(21) });
		const cur = walk(mk, cls("v-qr-cursor"));
		check(cur.length === 1 && walk(cur[0], cls("v-qr-marker")).length === 1 && walk(cur[0], (n) => n.tag === "text" && textOf(n) === "Position 3").length === 1, "qr: the marker and its label in one cursor group");
		within(mk, { x: qb.x - 2, y: qb.y - 2, w: qb.w + 4, h: qb.h + 4 }, "qr with a marker label at the box top (the ring itself is 2 out)");
	}
	const bb = V.bits({ box: { x: 0, y: 0, w: 100, h: 20 }, bits: [0, 1] }), bg2 = walk(bb, cls("v-bit"));
	check(cls("v-bit-0")(bg2[0]) && cls("v-bit-1")(bg2[1]), "bits: v-bit-0 then v-bit-1");
	{
		const db = { x: 10, y: 40, w: 140, h: 60 }, wd = V.dictionary({ box: db, things, label: "Dictionary" });
		check(walk(wd, (n) => n.tag === "text" && textOf(n).includes("Dictionary")).length === 1, "dictionary: wide enough, the tab names it");
		const tabR = walk(wd, cls("v-dict-tab"))[0], lt = walk(wd, cls("v-dict-label"))[0];
		check(num(lt.attrs.x) + 0.55 * num(lt.attrs["font-size"]) * (textOf(lt).length + 1) <= num(tabR.attrs.x) + num(tabR.attrs.width), "dictionary: the label's estimated end stays inside the tab");
		const nr = V.dictionary({ box: { ...db, w: 86 }, things, label: "Dictionary" });
		check(!walk(nr, (n) => n.tag === "text" && textOf(n).includes("Dictionary")).length && walk(nr, (n) => n.tag === "title" && textOf(n) === "Dictionary").length === 1, "dictionary: narrow, only a title");
		within(wd, db, "labelled dictionary");
	}

	// string: 13 positions, the turn's piece bigger and ringed; holes dashed; nothing where there is no position
	const items = Array.from({ length: 13 }, (_, i) => i < 6 ? i : null);
	const s = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items, firstPosition: 9, current: 6, posBox: lay.boxes.posBox });
	const pieces = walk(s, cls("v-piece")), cur = walk(s, cls("v-current"));
	check(pieces.length === 13 && cur.length === 1 && pieces.indexOf(cur[0]) === 6, "string: 13 pieces, the 7th marked as the turn's");
	check(walk(s, cls("v-hole")).length === 7, "string: the empty positions are holes");
	check(walk(s, (n) => n.tag === "text" && textOf(n) === "15").length === 1, "string: each piece's position beside it (9 + 6)");
	const rad = (p) => Math.max(...walk(p, (n) => n.tag === "circle").map((c) => num(c.attrs.r)));
	check(rad(cur[0]) >= 1.5 * rad(pieces[5]) && rad(cur[0]) >= 19, "string: the turn's piece is by far the biggest (1.5 × a neighbour)");
	const names = walk(s, cls("v-name"));
	check(names.length === 0, "string build: a hole at the turn has no name");
	// a hole at the turn: no name; its position (blue) above it
	check(walk(cur[0], cls("v-hole")).length === 1, "string build: a hole at the turn");
	{
		const pb = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], firstPosition: 3, current: 6, posBox: lay.boxes.posBox });
		const run = walk(pb, cls("v-string-run"))[0], icon = walk(pb, cls("v-string-icon"))[0], fixed = walk(pb, cls("v-string-fixed"))[0];
		check(run && icon && fixed && walk(run, cls("v-piece")).length === 13 && !walk(run, cls("v-icon")).length && walk(icon, cls("v-icon")).length === 1, "string build: icon, run (every bead) and fixed groups");
		check(walk(pb, cls("v-name")).length === 1 && walk(walk(pb, cls("v-current"))[0], cls("v-name")).length === 1, "string build: only the turn's piece has its name under it");
		check(walk(pb, (n) => n.tag === "mask").length === 1 && walk(fixed, (n) => n.tag === "text" && textOf(n) === "9").length === 1, "string build: a mask fades the run's ends; the turn's position is in the posBox");
	}
	{
		// a vertical reference string (the key's, in the make turn): its icon apart from the run that glides
		const vr = V.string({ box: { x: 20, y: 40, w: 40, h: 200 }, orientation: "v", role: "reference", kind: "key", things, items: [0, 1, 2, 3, 4, 5, 6], current: 3, firstPosition: 2 });
		const run = walk(vr, cls("v-string-run"))[0], icon = walk(vr, cls("v-string-icon"))[0];
		check(run && icon && walk(run, cls("v-piece")).length === 7 && !walk(run, cls("v-icon")).length && walk(icon, cls("v-icon")).length === 1, "string reference: the icon apart from the run");
	}
	const midCx = (p) => num(walk(p, (n) => n.tag === "circle")[0].attrs.cx), sl = lay.boxes.seedSlot;
	check(Math.abs(midCx(cur[0]) - (sl.x + sl.w / 2)) < 1, "string: the turn's piece is in the slot's box");
	within(s, { x: lay.boxes.seedString.x, y: lay.boxes.posBox.y, w: lay.boxes.seedString.w, h: lay.boxes.seedString.y + lay.boxes.seedString.h - lay.boxes.posBox.y }, "string build");
	const edge = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items: [undefined, undefined, 3, 4, null], current: 3 });
	check(walk(edge, cls("v-piece")).length === 3, "string: no piece where the string has no position");
	{
		// the icon beside its thread: with no positions before the first, the thread still starts at the icon
		const sb = lay.boxes.seedString, th = walk(edge, cls("v-thread"))[0], ic = walk(edge, cls("v-icon"))[0];
		const icx = num(walk(ic, (n) => n.tag === "text")[0].attrs.x);
		check(th && ic && num(th.attrs.x1) - icx > 0 && num(th.attrs.x1) - icx < 20 && icx < sb.x + 20, "string: the thread starts at its icon, even with no positions before the first");
	}
	{
		const vb = lay.boxes.keyString, vs = V.string({ box: vb, orientation: "v", role: "reference", kind: "key", things, items: [undefined, undefined, undefined, 4, 5, 6, 7], current: 3 });
		const th = walk(vs, cls("v-thread-ref"))[0];
		check(th && num(th.attrs.y1) - vb.y < 20 && num(th.attrs.y1) - vb.y > 0, "string: a vertical thread starts at its icon, even with no positions before the first");
	}
	{
		// spec §4 rule 4: a name of 16 characters is drawn whole where the make turn's and the key throw's dictionaries are
		const name = "Orange beetroot1", things = Array.from({ length: 8 }, (_, i) => ({ name: i === 3 ? name : "Name " + i, colour: "#c60" }));
		for (const [label, b] of [["make turn", Lay.makeTurn({ pad: true, n: 8 }).boxes.keyDict], ["key throw", Lay.keyThrow({ sides: 6, bits: 3, tool: "dice", n: 8 }).boxes.keyDict]]) {
			for (const mode of ["reel", "static"]) {
				const d = V.dictionary({ box: b, things, mode, value: 3, icon: "key" });
				const shown = walk(d, cls("v-name")).map(textOf);
				check(b && shown.includes(name), `dictionary (${mode}) at the ${label}'s key dictionary: a 16-character name is not cut`);
			}
		}
	}
	const ref = V.string({ box: lay.boxes.keyString, orientation: "v", role: "reference", kind: "key", things, items: [1, 2, 3, 4, 5, 6, 7], firstPosition: 11, current: 3 });
	check(walk(ref, cls("v-piece")).length === 7 && walk(ref, cls("v-turn-frame")).length === 1 && walk(ref, cls("v-thread-ref")).length === 1, "string: a reference, dotted, its turn's piece framed");
	const refCy = num(walk(walk(ref, cls("v-current"))[0], (n) => n.tag === "circle")[0].attrs.cy);
	check(Math.abs(refCy - 126) < 1, "string: the reference's turn piece is level with the arrow that leaves it");
	within(ref, lay.boxes.keyString, "string reference");
	{
		// the QR marker, the reveal, glide and fade
		const qb = lay.boxes.qr, dark = () => true;
		const withMark = V.qr({ box: qb, size: 25, modules: dark, turnCells: [[0, 0], [1, 2]] }), want = Lay.qrCellsBox(qb, 25, [[0, 0], [1, 2]]);
		const cursor = withMark.children[withMark.children.length - 1], last = cursor.children[0];
		check(cls("v-qr-cursor")(cursor) && cls("v-qr-marker")(last) && last.attrs.x === want.x && last.attrs.y === want.y && last.attrs.width === want.w && last.attrs.height === want.h, "qr: a marker round the turn's cells, in the last child (the cursor), at qrCellsBox");
		check(walk(V.qr({ box: qb, size: 25, modules: dark, turnCells: [] }), cls("v-qr-marker")).length === 0, "qr: no turn cells, no marker");
		const order = [[0, 0], [0, 1], [0, 2], [0, 3]];
		const rev = V.qr({ box: qb, size: 25, modules: dark, reveal: { order, ms: 1000 } });
		check(walk(rev, cls("v-qr-reveal")).length === 4, "qr: the cells in the reveal order carry v-qr-reveal");
		check(typeof V.glide === "function" && V.ADVANCE_MS === 450 && typeof V.fadeIn === "function", "vocab: glide, fadeIn and ADVANCE_MS");
		check(typeof V.glide({}, { dx: 0, dy: 0 }).finish === "function" && V.glide({ setAttribute() {}, style: {}, getBoundingClientRect() {} }, {}).finish() === undefined, "glide: no move, a no-op finish");
		const el = { setAttribute() {}, style: {}, getBoundingClientRect() {} }, g = V.glide(el, { dx: 10, dy: -4 });
		check(el.style.transform === "" && /450ms cubic-bezier/.test(el.style.transition), "glide: ends in its own place, transitioning over 450 ms");
		g.finish();
		check(el.style.transform === "" && el.style.transition === "", "glide: finish removes the transition at once");
		{ // fadeIn: the class goes at animationend (no replay when the node is re-inserted); needs motion allowed, a mock element
			const cl = new Set(), ls = {}, fe = { setAttribute() {}, classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c) },
				addEventListener: (n, f) => { ls[n] = f; }, removeEventListener: (n) => { delete ls[n]; } };
			V.fadeIn(fe);
			check(cl.has("v-fade-in") && typeof ls.animationend === "function", "fadeIn: adds v-fade-in and waits for animationend");
			ls.animationend({ target: {} });
			check(cl.has("v-fade-in"), "fadeIn: an animationend of a child leaves the class");
			ls.animationend({ target: fe });
			check(!cl.has("v-fade-in") && !ls.animationend, "fadeIn: v-fade-in removed at its own animationend");
		}
		const pt = V.string({ box: lay.boxes.seedString, orientation: "h", role: "build", things, items: [0, 1, 2], current: 1 });
		check(pt && Lay.pitch(lay.boxes.seedString, 3, {}) > 0, "string spaces its pieces with Lay.pitch");
	}
	let slotHit = null;
	const rd = V.string({ box: rlay.boxes.keyColumn, orientation: "v", role: "read", kind: "key", column: rlay.columns.key, things, items: [2, 9, 4, null, undefined, undefined, undefined], firstPosition: 1, current: 3, onSlot: (i) => { slotHit = i; } });
	const vals = walk(rd, cls("v-value"));
	check(vals.length === 3 && vals.every(cls("v-c-key")) && textOf(vals[1]) === "9", "string read: each piece's number beside it, in its string's colour");
	const slot = walk(rd, cls("v-slot"))[0];
	check(slot && textOf(slot).includes("+") && (slot.listeners.click(), slotHit === 3), "string read: the turn's hole is a «+» to tap");
	const rk = rlay.boxes.keySlot, rcx = num(walk(slot, (n) => n.tag === "circle")[0].attrs.cx), rcy = num(walk(slot, (n) => n.tag === "circle")[0].attrs.cy);
	check(rcx > rk.x && rcx < rk.x + rk.w && rcy > rk.y && rcy < rk.y + rk.h, "string read: the turn's hole is in the slot's box");
	within(rd, rlay.boxes.keyColumn, "string read");
	// drawn as readColumn says: each number and position on its own box, never over each other
	{
		const sd = V.string({ box: rlay.boxes.seedColumn, orientation: "v", role: "read", kind: "seed", things, items: [2, 9, 4, 6, 1, 3, 5], firstPosition: 1, current: 3, column: rlay.columns.seed });
		const col = rlay.columns.seed, ins = (t, b) => num(t.attrs.x) > b.x && num(t.attrs.x) < b.x + b.w && num(t.attrs.y) > b.y && num(t.attrs.y) < b.y + b.h;
		const vs = walk(sd, cls("v-value")), ps = walk(sd, cls("v-pos"));
		check(vs.length === 7 && ps.length === 7 && vs.every((t, j) => ins(t, col.rows[j].value)) && ps.every((t, j) => ins(t, col.rows[j].pos)),
			"string read: each number beside its piece, each position on the outer side, on readColumn's boxes");
		const kv = walk(rd, cls("v-value")), kp = walk(rd, cls("v-pos")), kc = rlay.columns.key;
		check(kp.every((t) => num(t.attrs.x) > kc.rows[0].pos.x) && kv.every((t) => num(t.attrs.x) < kc.rows[0].piece.x), "string read: the key's positions on its right, its numbers on the left of its pieces");
	}
	check(walk(rd, (n) => n.attrs["data-icon"] === "key").length === 1 && walk(s, (n) => n.tag === "text" && textOf(n) === "🌱").length === 1, "string: the seed's or the key's icon beside it");
	// the key's icon is drawn (⚿ is missing from common fonts), with no text, the same in SVG and in HTML
	{
		const ki = V.icon("key", 50, 50, 24), tag = V.iconTag("key");
		check(ki.tag === "g" && cls("v-icon-key")(ki) && !walk(ki, (n) => n.tag === "text").length && walk(ki, (n) => n.tag === "circle").length === 1, "icon: the key drawn, a bow and a shaft, no glyph");
		within(ki, { x: 38, y: 38, w: 24, h: 24 }, "icon: the key in its square");
		check(tag.tag === "span" && tag.attrs["aria-hidden"] === "true" && walk(tag, (n) => n.tag === "svg").length === 1 && !textOf(tag).trim(), "iconTag: the key as a little drawing beside a text");
		for (const k of ["save", "home", "info"]) check(!walk(V.icon(k, 12, 12, 24), (n) => n.tag === "text").length, `icon: ${k} drawn, no glyph`);
		check(textOf(V.iconTag("seed")) === "🌱", "iconTag: the seed's is its emoji");
		const bd = V.badge(12, 30, 30, 10);
		check(textOf(bd) === "12" && walk(bd, cls("v-badge-ring")).length === 1 && num(walk(bd, cls("v-badge-ring"))[0].attrs.width) >= 0.6 * 10 * 2 + 4, "badge: an order number in a ring, drawn (no ①), wide enough for two digits");
		// no symbol a common font may lack, anywhere in the page's code or texts
		const glyphs = /[\u26BF\u2302\u2913\u2460-\u24FF\u3251-\u32BF]/u;
		for (const f of ["src/vocab.js", "src/app.js", "src/slides.js", "src/journeys.js", "src/i18n.js", "src/style.css", "src/seedcraft.html"])
			check(!glyphs.test(read(f)), `${f}: no ⚿ ⌂ ⤓ nor circled numbers (drawn instead)`);
	}

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
	const two = Lay.dictAsIs({ n: 32 }), st32 = V.dictionary({ box: two.boxes.dict, things, mode: "static", value: 20, icon: "key", columns: two.columns });
	const rows32 = walk(st32, cls("v-dict-row"));
	check(rows32.length === 32 && walk(st32, cls("v-dict-on")).length === 1 && rows32[16].attrs["data-y"] === rows32[0].attrs["data-y"], "dictionary static in two columns: all 32 rows, 16 beside 0");
	within(st32, two.boxes.dict, "dictionary static, two columns");
	let picked = null;
	const pk = V.dictionary({ box: { x: 100, y: 60, w: 480, h: 240 }, things: things.slice(0, 32), mode: "picker", value: null, icon: "seed", onPick: (v) => { picked = v; } });
	const buttons = walk(pk, cls("v-pick"));
	check(buttons.length === 32 && buttons.every((b) => b.attrs.role === "button" && b.attrs.tabindex === "0"), "dictionary picker: every piece a button");
	buttons[7].listeners.click(); check(picked === 7, "dictionary picker: a tap picks the piece");
	picked = null; buttons[9].listeners.keydown({ key: "Enter", preventDefault() {} }); check(picked === 9, "dictionary picker: Enter picks too");
	within(pk, { x: 100, y: 60, w: 480, h: 240 }, "dictionary picker");
	check(buttons.every((bt, v) => { const r = walk(bt, cls("v-pick-bg"))[0], c = Lay.pickerCell({ x: 100, y: 60, w: 480, h: 240 }, 32, v);
		return Math.abs(r.attrs.x - (c.x + 1)) < 0.2 && Math.abs(r.attrs.y - (c.y + 1)) < 0.2; }), "dictionary picker: each button on its cell of layouts.js (pickerCell)");

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
		const labels = walk(c, cls("v-clock-n")).map(textOf), to = S.clockStep(from, by, n, sign).value;
		check(n <= 8 ? labels.length === n : labels.includes(String(from)) && labels.includes(String(to)) && labels.length <= 10 && labels.includes(String(n / 2)), `clock n=${n}: ${n <= 8 ? "every number" : "every " + n / 8 + "th number and the sum's"} written`);
		check(walk(c, cls("v-clock-tick")).length === n, `clock n=${n}: a tick per number`);
		check(walk(c, cls("v-clock-n")).every((t) => Math.hypot(num(t.attrs.x) - m.dial.cx, num(t.attrs.y) - m.dial.cy) + 0.6 * num(t.attrs["font-size"]) <= m.dial.r), `clock n=${n}: the numbers inside the ring, clear of the bands`);
		within(c, b, `clock n=${n}`);
	}
	for (const [n, from, by] of [[32, 13, 1], [32, 12, 3], [32, 31, 1], [16, 15, 9], [8, 7, 7]]) {
		const t = walk(V.clock({ box: lay.boxes.clock, n, from, by, sign: 1, phase: "done" }), cls("v-clock-n"));
		check(t.every((a, i) => t.slice(i + 1).every((b) => Math.hypot(num(a.attrs.x) - num(b.attrs.x), num(a.attrs.y) - num(b.attrs.y)) >= num(a.attrs["font-size"]))), `clock n=${n} ${from}+${by}: its numbers do not touch`);
	}
	// going round: the 0 always written (N − 1 when it fits), in the wrap's class, and nothing touches
	for (const n of [16, 32]) for (const [from, by, sign] of [[n - 1, 2, 1], [n - 2, 3, 1], [n - 1, 1, 1], [n - 3, 9, 1], [1, 2, -1], [0, 1, -1], [2, 9, -1]]) {
		const c = V.clock({ box: lay.boxes.clock, n, from, by, sign, phase: "done" }), t = walk(c, cls("v-clock-n")), to = S.clockStep(from, by, n, sign).value;
		const zero = t.find((x) => textOf(x) === "0");
		check(S.clockStep(from, by, n, sign).wrapped && zero && (to === 0 || from === 0 || cls("wrap")(zero)), `clock n=${n} ${from}${sign > 0 ? "+" : "−"}${by}: the pass to 0 written`);
		check(t.every((a, i) => t.slice(i + 1).every((b) => Math.hypot(num(a.attrs.x) - num(b.attrs.x), num(a.attrs.y) - num(b.attrs.y)) >= num(a.attrs["font-size"]))), `clock n=${n} ${from}${sign > 0 ? "+" : "−"}${by}: its numbers do not touch`);
		check([String(from), String(to)].every((v) => t.some((x) => textOf(x) === v)) && (walk(c, (x) => cls("v-clock-tick")(x) && cls("wrap")(x)).length >= 1 || [from, to].sort((p, q) => p - q).join() === "0," + (n - 1)), `clock n=${n} ${from}${sign > 0 ? "+" : "−"}${by}: the sum's numbers written, the wrap's tick marked`);
		// a text's box, roughly: 0.6 em a glyph, 0.75 em above its baseline
		const tbox = (x) => { const f = num(x.attrs["font-size"]), w = 0.6 * f * textOf(x).length; return { x: num(x.attrs.x) - w / 2, y: num(x.attrs.y) - 0.75 * f, w, h: 0.75 * f }; };
		const counter = tbox(walk(c, cls("v-clock-by"))[0]);
		check(t.every((x) => !overlap(tbox(x), counter)), `clock n=${n} ${from}${sign > 0 ? "+" : "−"}${by}: the numbers clear of the counter`);
	}
	for (const n of [2, 16, 32]) for (const [from, by] of [[null, null], [5, null], [null, 3]]) {
		const cw = V.clock({ box: rlay.boxes.clock, n, from, by, sign: -1, inputColour: "seed" }), ins = walk(cw, cls("v-clock-in")).map(textOf);
		check(ins[0] === (from === null ? "" : String(from)) && ins[1] === (by === null ? "" : "−" + by) && !walk(cw, cls("v-clock-token")).length && !walk(cw, cls("v-clock-arc")).length
			&& walk(cw, cls("v-clock-tick")).length === n, `clock n=${n} ${from}|${by}: waiting for a number, its band empty, nothing turning`);
		within(cw, rlay.boxes.clock, `clock waiting n=${n}`);
	}
	const ci = V.clock({ box: lay.boxes.clock, n: 16, from: 11, by: 9, sign: 1, phase: "inputs" });
	check(textOf(walk(ci, cls("v-clock-out"))[0]) === "" && textOf(walk(ci, cls("v-clock-by"))[0]) === "", "clock inputs: no output yet");
	const cr = V.clock({ box: lay.boxes.clock, n: 16, from: 11, by: 9, sign: 1, phase: "run" });
	check(textOf(walk(cr, cls("v-clock-out"))[0]) === "4", "clock run, without animation: the value appears directly");

	// a clock's run lasts at most RUN_MS (about 1.2 s), its step never slower than 220 ms
	check(V.RUN_MS <= 1200 && [1, 5, 9, 15, 31].every((by) => V.clockStepMs(by) <= 220 && V.clockStepMs(by) * by <= V.RUN_MS + 0.01) && V.clockStepMs(3) === 220, "clock run: 220 ms a step, at most 1.2 s in all (N = 32)");
	// a clock's onDone always comes after clock() has returned, moving or not
	{
		let done = 0;
		V.clock({ box: lay.boxes.clock, n: 16, from: 11, by: 9, sign: 1, phase: "run", onDone: () => { done++; } });
		const sync = done;
		await new Promise((r) => setTimeout(r, 0));
		check(sync === 0 && done === 1, "clock run: onDone called once, asynchronously");
	}
	// the reel with no value yet: no row framed
	check(walk(V.dictionary({ box: lay.boxes.keyDict, things: things.slice(0, 16), mode: "reel", value: null, icon: "key" }), cls("v-dict-on")).length === 0, "dictionary reel without a value: nothing framed");
	check(walk(pk, cls("v-pick")).every((b) => walk(b, cls("v-name")).length === 1), "dictionary picker: each button with its name");
	// what is read from the lectern is never smaller than 9 units (a bead's own glyph is a picture, not text)
	{
		const th6 = Lay.keyThrow({ sides: 6, bits: 5 }), simple = Lay.makeTurn({ pad: false, n: 16 });
		const drawn = [
			s, ref, rd, st16, pk,
			V.string({ box: rlay.boxes.seedColumn, orientation: "v", role: "read", things, items: [1, 2, 3, null, undefined, undefined, undefined], current: 3 }),
			...[lay.boxes.keyDict, lay.boxes.seedDict, simple.boxes.seedDict, th6.boxes.keyDict].map((b) => V.dictionary({ box: b, things: things.slice(0, 32), mode: "reel", value: 20, icon: "seed" })),
			V.bits({ box: lay.boxes.bits, bits: [1, 0, 1, 1] }), V.bits({ box: th6.boxes.tower, bits: [1, 0, 1, 1, 0], orientation: "tower" }),
			...[2, 8, 16, 32].flatMap((n) => [V.clock({ box: lay.boxes.clock, n, from: n - 1, by: 1, phase: "done" }), V.clock({ box: rlay.boxes.clock, n, from: 0, by: n - 1, sign: -1, phase: "done" })]),
			V.number({ box: lay.boxes.number, value: 11 }), V.piece({ box: th6.boxes.piece, thing: things[3] }),
		];
		const small = drawn.flatMap((d) => walk(d, (n) => n.tag === "text" && !cls("v-glyph")(n) && num(n.attrs["font-size"]) < 9));
		check(!small.length, `no text under 9 units ${small.slice(0, 3).map((t) => textOf(t) + "@" + t.attrs["font-size"]).join(", ")}`);
		// the turn's position in blue and bold, whatever the string
		check([s, ref, rd].every((d) => { const p = walk(d, cls("v-pos-current")); return p.length === 1 && cls("v-c-qr")(p[0]) && cls("v-bold")(p[0]); }), "string: the turn's position blue and bold in every role");
	}
	// QR: a grid; the turn's squares in blue
	const q = V.qr({ box: lay.boxes.qr, size: 21, modules: (r, c) => (r + c) % 2 === 0, turnCells: [[9, 9], [9, 10], [10, 9]], painted: new Map([[0, 1]]) });
	check(walk(q, cls("v-qr-turn")).length === 3, "qr: the turn's squares marked");
	within(q, lay.boxes.qr, "qr");

	// arrows: dashed, right angles, the past ones nearly invisible
	const past = V.arrow({ points: [[10, 10], [50, 10], [50, 40]], colour: "qr", state: "past" });
	check(past.attrs.opacity === "0.25", "arrow: a past one faint (opacity 0.25)");
	const now = V.arrow({ points: [[10, 10], [50, 10]], colour: "key", state: "current" });
	check(cls("v-c-key")(now) && walk(now, cls("v-arrow-line"))[0].attrs.d === "M10 10 L50 10" && walk(now, (n) => n.tag === "mask").length === 1, "arrow: the current one drawn along its path, in its colour");
	check(V.arrow({ points: [[0, 0], [5, 0]], colour: "qr", state: "hidden" }).attrs.visibility === "hidden", "arrow: hidden");
	let diag = false; try { V.arrow({ points: [[0, 0], [5, 5]], colour: "qr", state: "current" }); } catch { diag = true; }
	check(diag, "arrow: refuses a diagonal");

	// a kind of piece alone (no name), and a string drawn small on a card (its icon's room given)
	const alone = V.piece({ box: { x: 0, y: 0, w: 24, h: 24 }, thing: things[1], named: false });
	check(!walk(alone, cls("v-name")).length && walk(alone, (n) => n.tag === "circle").length === 1, "piece: named false draws the piece alone");
	within(alone, { x: 0, y: 0, w: 24, h: 24 }, "piece alone");
	const small = V.string({ box: { x: 0, y: 4, w: 160, h: 48 }, orientation: "h", role: "read", kind: "seed", things, items: [3, 0, 2, 1], showValues: false, room: 20 });
	check(num(walk(small, cls("v-icon"))[0].attrs.x) === 10 && num(walk(small, cls("v-icon"))[0].attrs["font-size"]) === 14, "string: room sets the icon's room");
	within(small, { x: 0, y: 4, w: 160, h: 48 }, "string on a card");
	// cards: one per option, at most two ✓ and two ✕
	let chose = null;
	const cd = V.cards({ options: [{ id: "a", art: node("svg", {}), title: "A", pros: ["p1", "p2", "p3"], cons: ["c1"] }, { id: "b", art: null, title: "B", pros: ["p"], cons: ["c1", "c2"] }], chosen: "b", onChoose: (id) => { chose = id; } });
	const cardList = walk(cd, cls("v-card"));
	check(cardList.length === 2 && walk(cardList[0], cls("v-pro")).length === 2 && walk(cardList[0], cls("v-con")).length === 1
		&& walk(cardList[1], cls("v-con")).length === 2 && textOf(cardList[0]).includes("✓") && textOf(cardList[1]).includes("✕"), "cards: two cards, with their ✓ and ✕ (two at most)");
	check(cls("on")(cardList[1]) && cardList[1].attrs["aria-pressed"] === "true" && !cls("on")(cardList[0]), "cards: the chosen one marked");
	cardList[0].attrs.on.click(); check(chose === "a", "cards: a tap chooses");

	// a die, and its faces as buttons
	check(textOf(V.die({ sides: 8, face: 3, size: 56 })) === "4" && textOf(V.die({ sides: 10, face: 3 })) === "3" && textOf(V.die({ sides: 6, face: null })) === "?", "die: its face, in digits from a d8 on");
	// a d4's and a d6's faces are pips, as on the dice; the device's (a label) and a coin's stay words
	for (const sides of [4, 6]) for (let f = 0; f < sides; f++) {
		const d = V.die({ sides, face: f, size: 26 });
		check(!walk(d, (n) => n.tag === "text").length && walk(d, cls("v-die-pip")).length === f + 1, `die d${sides}: face ${f + 1} in pips`);
	}
	check(textOf(V.die({ sides: 6, label: "13", size: 100 })) === "13" && textOf(V.die({ sides: 2, face: 1, label: "H" })) === "H" && !walk(V.die({ sides: 8, face: 0 }), cls("v-die-pip")).length, "die: a label, a coin and a d8 without pips");
	let pressed = null;
	const fb = V.faceButton({ sides: 20, face: 4, onPress: (f) => { pressed = f; }, size: 31 });
	check(fb.tag === "button" && cls("v-face")(fb), "faceButton: a button");
	fb.attrs.on.click(); check(pressed === 4, "faceButton: a press gives its face");
	check(V.faceButton({ sides: 6, face: 1, disabled: true }).attrs.disabled === true, "faceButton: disabled");
}
// the lectern (slides.js): what Next and Back do, within a slide's steps and between slides
{
	vm.runInContext(read("src/slides.js"), ctx, { filename: "src/slides.js" });
	const Sl = vm.runInContext("SeedcraftSlides", ctx);
	const prev = { label: "Back", go: () => "prev" }, next = { label: "Next", go: () => "next" };
	const slide = { steps: 3, prev, next };
	check(JSON.stringify(Sl.nextOf({ step: 1 }, slide)) === JSON.stringify({ step: 2 }), "nextOf: Next within a slide's steps gives the next step");
	check(Sl.nextOf({ step: 2 }, slide).go === next.go, "nextOf: Next on the last step goes to the next slide");
	check(Sl.nextOf({ step: 0, dir: "prev" }, slide).go === prev.go, "nextOf: Back on the first step goes to the previous slide");
	check(JSON.stringify(Sl.nextOf({ step: 2, dir: "prev" }, slide)) === JSON.stringify({ step: 1 }), "nextOf: Back within a slide's steps gives the step before");
	check(Sl.nextOf({ step: 0 }, { steps: 1, prev, next: { ...next, ready: false } }) === null, "nextOf: Next waits while the slide is not ready");
	check(JSON.stringify(Sl.nextOf({ step: 0 }, { steps: 2, prev, next: { ...next, ready: false } })) === JSON.stringify({ step: 1 }), "nextOf: a slide not ready still walks its own steps");
	check(Sl.nextOf({ step: 0 }, { steps: 1, prev: null, next: null }) === null && Sl.nextOf({ step: 0, dir: "prev" }, { steps: 1, prev: null, next }) === null, "nextOf: nothing to go to, nothing done");
	check(Sl.nextOf({ step: 7 }, { steps: 3, next }).go === next.go, "nextOf: a step past the end counts as the last");
	check(Sl.nextOf({ step: 0 }, { next }).go === next.go, "nextOf: steps default to 1");
}
// the journeys (journeys.js): which slides there are, and how many pieces to get
{
	vm.runInContext(read("src/journeys.js"), ctx, { filename: "src/journeys.js" });
	const J = vm.runInContext("SeedcraftJourneys", ctx);
	const ids = (flow, s) => J.slides(flow, s).map((x) => x.id).join(" ");
	check(J.buyFor(12, 16, "basic") === 15 && J.buyFor(24, 16, "basic") === 20 && J.buyFor(12, 16, "pad", "string") === 20 && J.buyFor(24, 32, "pad", "string") === 20
		&& J.buyFor(12, 2, "pad", "file") === 135 && J.buyFor(12, 2, "basic") === 130, "buyFor: SPEC §6 and §10.6");
	check(J.symbolsFor(12, 16) === 54 && J.symbolsFor(24, 16) === 91 && J.symbolsFor(12, 32) === 43 && J.symbolsFor(24, 2) === 364, "symbolsFor: SPEC §2");
	check(ids("make", { mode: "basic" }) === "mode form words size pieces dict seed check store", "make: the basic mode's slides");
	check(ids("make", { mode: "basic", made: true }) === "mode form words size pieces dict seed qr seq check store", "make: the turns once the sequence is made");
	check(ids("make", { mode: "basic", made: true }).includes("seed qr seq") && !ids("make", { mode: "basic" }).includes("qr"), "make: «Your QR» between the words and the turns, once the sequence is made");
	check(J.slides("make", { mode: "pad", padAs: "string", made: true }).find((x) => x.id === "qr").step === "seq", "make: «Your QR» under the sequence's step");
	check(ids("make", { mode: null }) === ids("make", { mode: "basic" }), "make: before a mode is chosen, the basic mode's slides");
	check(ids("make", { mode: "pad", padAs: "file", dict: true, keyWho: "me", keyBy: "d6" }) === "mode form words size keyAs pieces dict dictHave keyWho keyTool keyThrow seed check store", "make: a key file thrown by hand");
	check(ids("make", { mode: "pad", padAs: "string", padForm: "book", dict: true, padDict: true, keyWho: "device", keyBy: "device" })
		=== "mode form words size keyAs keyColl keyForm pieces dict dictHave keyDict keyDictHave keyWho keyThrow seed check store", "make: a key of another collection, drawn by the device");
	check(ids("make", { mode: "pad", padAs: "string", padForm: null }).includes("keyColl") && !ids("make", { mode: "pad", padAs: "string", padForm: null }).includes("keyForm"), "make: the same collection asks no form for the key");
	check(J.slides("make", { mode: "pad" }).filter((x) => x.step === "plan").length === 5 && J.slides("make", { mode: "pad" }).find((x) => x.id === "keyWho").step === "key", "make: each slide under its step");
	check(ids("read", { mode: "basic" }) === "mode form size dict words recover seed", "read: the basic mode's slides (the seed's length asked)");
	check(ids("read", { mode: "pad", padAs: "file", dict: true }) === "mode form size dict dictHave keyAs keyFile recover seed", "read: a key file");
	check(ids("read", { mode: "pad", padAs: "string", padForm: "necklace", dict: true }) === "mode form size dict dictHave keyAs keyColl keyForm keyDict words recover seed", "read: a key of another collection");
	// a turn read back: its stages show every arrow of readTurn once, in the cycle's order
	for (const pad of [false, true]) for (const n of [2, 16, 32]) {
		const stages = J.readStages({ pad }), arrows = Lay.readTurn({ pad, n }).arrows.map((a) => a.id);
		check(stages.flatMap((x) => x.arrows).join() === arrows.join() && stages[0].id === "position" && stages[stages.length - 1].id === "paint", `readStages pad=${pad} n=${n}: every arrow once, in order, from the position to the squares painted`);
	}
	check(J.readStages({ pad: true }).map((x) => x.id).join() === "position,in,out,bits,paint" && J.readStages({ pad: true })[2].arrows.length === 0, "readStages: with a key, the clock's inputs, then what comes out (no arrow)");
	// a copy read back against the one made: the reading that fits best, and the pieces that differ
	{
		const sym = [3, 1, 4, 1, 5, 9, 2, 6].map((x) => x % 8), key = [2, 7, 1, 8, 2, 8, 1, 8].map((x) => x % 8), rev = (a) => [...a].reverse();
		const same = J.checkRead({ taps: sym, symbols: sym });
		check(same.wrong.length === 0 && !same.reversed && same.seed.join() === sym.join(), "checkRead: the same pieces, nothing wrong");
		const back = J.checkRead({ taps: rev(sym), symbols: sym });
		check(back.wrong.length === 0 && back.reversed, "checkRead: read from the other end");
		const bad = sym.slice(); bad[5] = (bad[5] + 1) % 8;
		const one = J.checkRead({ taps: bad, symbols: sym });
		check(one.wrong.length === 1 && one.wrong[0].turn === 5 && one.wrong[0].pos === 5 && one.wrong[0].column === "seed", "checkRead: one piece wrong, at its turn");
		const badBack = J.checkRead({ taps: rev(bad), symbols: sym });
		check(badBack.reversed && badBack.wrong.length === 1 && badBack.wrong[0].pos === 5 && badBack.wrong[0].turn === 2, "checkRead: read backwards, the wrong piece's turn as it was read");
		const keyBad = key.slice(); keyBad[2] = (keyBad[2] + 3) % 8;
		const k1 = J.checkRead({ taps: sym, keys: keyBad, symbols: sym, pad: key, keyRead: true });
		check(k1.wrong.length === 1 && k1.wrong[0].column === "key" && k1.wrong[0].turn === 2 && k1.key.join() === keyBad.join(), "checkRead: a key piece wrong, in the key's column");
		const sw = J.checkRead({ taps: key, keys: sym, symbols: sym, pad: key, keyRead: true });
		check(sw.wrong.length === 0 && sw.swapped && sw.seed.join() === sym.join(), "checkRead: the two strings swapped");
		const f = J.checkRead({ taps: rev(sym), keys: key, symbols: sym, pad: key, keyRead: false });
		check(f.reversed && !f.swapped && !f.keyReversed && f.wrong.length === 0, "checkRead: a key file is read as it is");
	}
	const list = J.slides("make", { mode: "pad", padAs: "string", dict: false, keyWho: "me" });
	check(J.resolve("make", list, "keyTool") === "keyTool" && J.resolve("make", list, "dictHave") === "dict" && J.resolve("make", list, "keyThrow") === "keyTool"
		&& J.resolve("make", J.slides("make", { mode: "pad", padAs: "string" }), "keyThrow") === "keyWho" && J.resolve("make", list, "nowhere") === "mode", "resolve: a slide that went gives the one before it");
	check(J.jump(list, "dict", () => true) === "dict" && J.jump(list, "key", (id) => id !== "words") === "words" && J.jump(list, "nowhere", () => true) === null, "jump: a step's first slide, or what it needs first");
	// the guide to Store with the copy not read back yet (app.js's slideDone: check is done only once m.checked): Check first; Store itself stays there
	for (const s of [{ mode: "basic", dict: true, made: true }, { mode: "pad", padAs: "file", dict: true, keyWho: "device", keyBy: "device", made: true }]) {
		const made = J.slides("make", s), notChecked = (id) => id !== "check";
		check(J.jump(made, "store", notChecked) === "check" && J.jump(made, "store", () => true) === "store" && J.resolve("make", made, "store") === "store",
			`jump: Store with no Check lands on Check (${s.mode}); checked, on Store`);
	}
	const one = (p) => JSON.stringify(J.pieces({ words: 12, n: 16, form: "necklace", padForm: null, ...p }, (f) => f === "book" ? 0 : 1, (f) => f !== "book"));
	check(one({ mode: "basic" }) === JSON.stringify({ keyFile: false, groups: [{ kinds: ["seed"], form: "necklace", each: 15, copies: 1, what: "seq", assembly: true }] }), "pieces: the basic mode, one group");
	check(one({ mode: "pad", padAs: "string" }) === JSON.stringify({ keyFile: false, groups: [{ kinds: ["seed", "key"], form: "necklace", each: 20, copies: 2, what: "both", assembly: true }] }), "pieces: a key of the same collection, one group with more of each");
	check(one({ mode: "pad", padAs: "string", padForm: "book" }) === JSON.stringify({ keyFile: false, groups: [{ kinds: ["seed"], form: "necklace", each: 15, copies: 1, what: "seq", assembly: true },
		{ kinds: ["key"], form: "book", each: 15, copies: 0, what: "key", assembly: false }] }), "pieces: a key of another collection, a group each");
	check(one({ mode: "pad", padAs: "file" }) === JSON.stringify({ keyFile: true, groups: [{ kinds: ["seed"], form: "necklace", each: 15, copies: 2, what: "seq", assembly: true }] }), "pieces: a key file, a copy of the dictionary for it");
	// a turn of the sequence: its stages reveal every arrow of makeTurn once, in the cycle's order
	for (const [pad, file, count] of [[false, false, 5], [true, false, 9], [true, true, 8]]) {
		const stages = J.turnStages({ pad, file }), arrows = Lay.makeTurn({ pad, n: 16, file }).arrows.map((a) => a.id);
		check(stages.length === count && stages.flatMap((x) => x.arrows).join() === arrows.join(), `turnStages pad=${pad} file=${file}: ${count} steps, every arrow once, in order`);
		check(stages[0].id === "position" && stages[stages.length - 1].id === "slot" && new Set(stages.map((x) => x.id)).size === count, `turnStages pad=${pad} file=${file}: from the position to the slot, each stage its own`);
	}
	check(J.turnStages({ pad: true }).map((x) => x.id).join() === "position,bits,number,key,keyNumber,clock,out,dict,slot" && J.turnStages({ pad: true }).find((x) => x.id === "out").arrows.length === 0
		&& J.turnStages({ pad: true }).find((x) => x.id === "clock").arrows.join() === "clockSeed,clockKey", "turnStages: the spec's nine steps; both inputs one step, the output of the clock one with no arrow");
	check(J.EXPLAINED === 3, "the first three turns are explained step by step");
	// your own dictionary: naming each piece, the order it is checked in
	const named = [{ name: "Red" }, { name: " red " }, { name: "" }, { name: "Blue" }];
	check(J.nameProblem(named, 0) === "dup" && J.nameProblem(named, 1) === "dup" && J.nameProblem(named, 2) === "empty" && J.nameProblem(named, 3) === null
		&& J.nameProblem([{ name: "   " }], 0) === "empty", "nameProblem: an empty name, and one another piece has (case and spaces aside)");
	for (const n of [2, 4, 8, 16, 32]) {
		let x = 7;
		const order = J.checkOrder(n, () => { x = (x * 48271) % 2147483647; return x / 2147483647; });
		check(order.length === n && [...order].sort((a, b) => a - b).every((v, i) => v === i), `checkOrder: every number below ${n} once`);
	}
	check(J.checkOrder(4, () => 0.999999).join() !== "0,1,2,3" || J.checkOrder(4, () => 0).join() !== "0,1,2,3", "checkOrder: shuffled");
	check(J.checkOrder(3, () => 1).length === 3 && J.checkOrder(1, Math.random).join() === "0", "checkOrder: a random() of 1 stays in range; one piece, one number");
	// the key's throw: the throws read as throwsToNumber reads them
	let seed = 11;
	const rnd = (m) => { seed = (seed * 48271) % 2147483647; return seed % m; };
	for (const sides of [2, 4, 6, 8, 10, 12, 16, 20]) for (const n of [2, 4, 8, 16, 32]) for (let rep = 0; rep < 30; rep++) {
		const k = Math.log2(n), throws = Array.from({ length: rnd(12) }, () => rnd(sides)), p = J.throwParts(throws, sides, k), r = S.throwsToNumber(throws, sides, k);
		const ok = r ? p.done && p.bits.join() === r.bits.join() && p.used.map((u) => u.at).join() === r.used.join() && p.rejected.join() === r.rejected.join()
			: !p.done && p.bits.length < k;
		check(ok && p.used.every((u, i) => u.from === (i ? p.used[i - 1].to : 0) && u.to > u.from && throws[u.at] === u.face), `throwParts d${sides} N=${n} ${throws}: as throwsToNumber`);
	}
	const d6 = J.throwParts([5, 2, 4, 1, 3], 6, 4);
	check(d6.done && d6.rejected.join() === "0,2" && d6.used.map((u) => `${u.at}:${u.from}-${u.to}`).join() === "1:0-2,3:2-4" && d6.bits.join("") === "1001", "throwParts d6 N=16: 5 and 4 thrown again, 2 and 1 give 10 01");
	const d20 = J.throwParts([19, 9, 17, 3], 20, 5);
	check(d20.done && d20.used.map((u) => `${u.from}-${u.to}`).join() === "0-4,4-5" && d20.rejected.join() === "0,2", "throwParts d20 N=32: four bits, then only one of the next throw");
}
// the sequence's captions (the foot of a turn, the seed's slide): short enough for the foot's two lines, in both languages
{
	vm.runInContext(read("src/i18n.js") + ";globalThis.TEXT = SEEDCRAFT_TEXT;", ctx, { filename: "src/i18n.js" });
	const TX = ctx.TEXT;
	const args = { turnPosition: [364], turnNumber: ["11111", 31], turnKeyAt: [364], turnKeyFile: [364, "V", 31], turnKeyNumber: [31], turnClockOf: [32],
		turnOut: [31], turnDict: [31], turnSlot: [364], readTap: [364], readTapBoth: [364], readTurnPad: [31, 31, 32, 31], readTurnBasic: [31] };
	const keys = ["turnPosition", "turnBitsAre", "turnNumber", "turnKeyAt", "turnKeyFile", "turnKeyNumber", "turnClockOf", "turnOut", "turnDict", "turnSlot",
		"turnHeader", "turnPadding", "seqKeyChanged", "endPad", "endBasic", "whyPad", "makeWarn", "seqIntro", "seqPadIntro",
		// reading back: the turn's foot, the ends'
		"readTap", "readTapBoth", "readTurnPad", "readTurnBasic", "readNoFit", "typeHelp", "handDone", "checkMatch", "checkFixed", "checkPadding", "checkMismatch",
		"readLockedWhy", "readLockedAhead",
		// storing it
		"storeForgetWhy", "storeKeyUnsaved", "storeNotChecked"];
	for (const lang of ["en", "es"]) for (const k of keys) {
		const v = TX[lang][k], s = typeof v === "function" ? v(...(args[k] || [])) : v;
		check(typeof s === "string" && s.length <= 110, `caption ${lang}.${k} at most 110 characters (${s && s.length}: ${s})`);
	}
	// the explained turn's last step with a changed piece: the slot's sentence and the key's change together
	for (const lang of ["en", "es"]) check((TX[lang].turnSlot(364) + " " + TX[lang].seqKeyChanged).length <= 110, `caption ${lang}: slot + key changed fits`);
	// the first turn read: how to read each form
	for (const lang of ["en", "es"]) for (const [id, f] of Object.entries(TX[lang].forms)) check(f.read.length <= 110, `caption ${lang}.forms.${id}.read at most 110 characters (${f.read.length})`);
}
// the lectern's foot: two lines of caption at most and «step n of m», all inside the foot (style.css, in the frame's units)
{
	const css = read("src/style.css"), rule = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}").exec(css); return m ? m[1] : ""; };
	const prop = (r, p) => { const m = new RegExp("(?:^|;|\\s)" + p + ":\\s*([^;]+)").exec(r); return m ? m[1].trim() : ""; };
	const units = (v) => { const m = /calc\(var\(--u\) \* ([\d.]+)\)/.exec(v); return m ? parseFloat(m[1]) : NaN; };
	const frame = rule(".slide-frame"), foot = rule(".slide-foot"), p = rule(".slide-caption p"), small = rule(".slide-caption small");
	const fs = units(prop(frame, "font-size")), footH = units(prop(foot, "height")), footTop = units(prop(foot, "top"));
	const em = (v) => parseFloat(v);
	const need = fs * (2 * em(prop(p, "font-size")) * em(prop(p, "line-height")) + em(prop(small, "font-size")) * em(prop(small, "line-height")));
	check(/line-clamp:\s*2/.test(p) && /max-height/.test(p), "the caption: two lines at most");
	check(need <= footH && footTop + footH <= 382.5 + 0.01 && Math.abs(680 / 382.5 - 16 / 9) < 0.001, `the foot: two caption lines and the step line (${need.toFixed(1)}) inside it (${footH}), inside the 16:9 frame`);
}
{
	// the test harness cannot reach app.js's journeySlide, so read its source: every field slides.js reads off a slide is passed through
	const fs = await import("node:fs"), here = new URL(".", import.meta.url).pathname;
	const slidesSrc = fs.readFileSync(here + "src/slides.js", "utf8"), appSrc = fs.readFileSync(here + "src/app.js", "utf8");
	const at = appSrc.indexOf("function journeySlide"), pass = appSrc.slice(at, appSrc.indexOf("// ---- small building blocks", at));
	const fields = [...new Set([...slidesSrc.matchAll(/\bs\.([a-zA-Z]+)/g)].map((m) => m[1]))].filter((f) => f !== "page");
	const dropped = fields.filter((f) => !new RegExp("\\b" + f + "\\b").test(pass.slice(pass.indexOf("return { id: view"))));
	check(dropped.length === 0, "journeySlide passes on every field slides.js reads" + (dropped.length ? ": drops " + dropped.join(", ") : ""));
	const q = Lay.seedQr({ toWords: true, end: true }).boxes;
	check(q.words.y + q.words.h / 2 === 165 && q.words.y + q.words.h <= q.fingerprint.y, "seedQr end: the words centred on the arrows' line, clear of the fingerprint");
	const kt = Lay.keyThrow({ sides: 6, bits: 3, tool: "dice", n: 8 }), sl = kt.arrows.find((a) => a.id === "slot");
	check(sl.points[0][0] === kt.boxes.piece.x + kt.boxes.piece.w / 2, "keyThrow: the slot arrow leaves the piece box at its centre");
}
{
	// the gather cards: every pieces tick and every assembly tick; the About page's test-only stance
	const J = vm.runInContext("SeedcraftJourneys", ctx);
	check(J.gatherDone({ seq: true, "assembly:seq": true }, [{ what: "seq", assembly: true }]) && !J.gatherDone({ seq: true }, [{ what: "seq", assembly: true }]) && J.gatherDone({ seq: true }, [{ what: "seq", assembly: false }]), "gatherDone: every pieces tick and every assembly tick");
	const TX = ctx.TEXT;
	check(!/ordenador (desconectado|sin conexión)|offline computer|disconnected computer/i.test([TX.en.safe, TX.es.safe].flat().join(" ")), "About: no real seed on an offline computer (test-only stance)");
	// a form with materials (not written) has an assembly card; the others do not
	check(J.pieces({ words: 12, n: 16, mode: "basic", form: "book", padForm: null }, () => 1).groups[0].assembly === false, "pieces: no assemblyOf, no assembly card");
	// the big number of the assembly card, split out of the materials text
	for (const lang of ["en", "es"]) for (const [id, f] of Object.entries(TX[lang].forms)) {
		const m = J.splitMaterials(f.materials(21, 30, 4));
		check(id === "other" ? m.big === null : m.big !== null && /\d/.test(m.big) && m.text.length > 0, `splitMaterials ${lang}.${id}: ${JSON.stringify(m)}`);
	}
}
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${padVectors.length} pad vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);

