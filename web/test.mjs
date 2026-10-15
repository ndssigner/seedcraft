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
// the clock (SPEC §10.3)
check(JSON.stringify(S.clockStep(9, 12, 16, 1)) === '{"value":5,"wrapped":true}', "clock 9 + 12");
check(JSON.stringify(S.clockStep(5, 12, 16, -1)) === '{"value":9,"wrapped":true}', "clock 5 - 12");
check(JSON.stringify(S.clockStep(3, 1, 2, -1)) === '{"value":0,"wrapped":false}' && S.clockStep(1, 1, 2, 1).value === 0, "clock N = 2");
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${padVectors.length} pad vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
