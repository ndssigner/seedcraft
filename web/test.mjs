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
for (const f of ["third_party/qrcodegen.js", "src/bip39-english.js", "src/seedcraft-sequences.js"])
	vm.runInContext(read(f), ctx, { filename: f });
vm.runInContext("globalThis.S = SeedcraftSequences;", ctx);
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
} catch (e) { check(false, "key state functions: " + e); }
// the pieces of a sequence a corrected key changed
check(S.changedPieces([1, 2, 3, 4], [1, 5, 3, 0]).join() === "1,3", "changedPieces: the places that differ");
check(S.changedPieces([1, 2], [1, 2]).length === 0 && S.changedPieces([1], [1, 2]).join() === "1", "changedPieces: none, and a longer one's extra place");
{
	const v = padVectors.find((x) => x.k === 4), K2 = v.pad.slice(); K2[5] = (K2[5] + 1) % v.n;
	check(S.changedPieces(S.encrypt(v.basic, v.pad, v.n), S.encrypt(v.basic, K2, v.n)).join() === "5", "one key piece corrected changes that one piece of the sequence");
}
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${padVectors.length} pad vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
