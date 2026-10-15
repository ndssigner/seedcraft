// Tests of the web tools' JavaScript against the reference test vectors
// (vectors/sequences-v0.json, vectors/sequences-pad.json) and Node.js's own
// crypto.
//     node web/test.mjs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const ctx = vm.createContext({ crypto: globalThis.crypto }); // the browser's crypto.getRandomValues
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
// vectors
const vectors = JSON.parse(read("../vectors/sequences-v0.json")).vectors;
let seed = 1;
const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (const v of vectors) {
	const name = `${v.name} k=${v.k}`;
	const entropy = Uint8Array.from(Buffer.from(v.entropy, "hex"));
	check(hex(S.mnemonicToEntropy(v.mnemonic)) === v.entropy, "mnemonic -> entropy " + name);
	check(S.entropyToMnemonic(entropy) === v.mnemonic, "entropy -> mnemonic " + name);
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
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${padVectors.length} pad vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
