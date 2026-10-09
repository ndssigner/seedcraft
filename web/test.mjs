// Tests of the web tools' JavaScript against the reference test vectors
// (vectors/sequences-v0.json) and Node.js's own crypto.
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
console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
