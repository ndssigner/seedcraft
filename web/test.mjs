// Tests of the web tools' JavaScript against the reference test vectors
// (vectors/sequences-v0.json, vectors/tones-v0.json) and Node.js's own crypto.
//     node web/test.mjs
import { createHash, pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const ctx = vm.createContext({});
for (const f of ["third_party/qrcodegen.js", "src/bip39-english.js", "src/seedcraft-sequences.js", "src/seedcraft-tones.js"])
	vm.runInContext(read(f), ctx, { filename: f });
vm.runInContext("globalThis.S = SeedcraftSequences; globalThis.TN = SeedcraftTones;", ctx);
const S = ctx.S, TN = ctx.TN;

let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL", what); } };
const hex = (b) => Buffer.from(b).toString("hex");

// crypto primitives against Node
for (const len of [0, 1, 55, 56, 63, 64, 65, 200]) {
	const data = Uint8Array.from({ length: len }, (_, i) => (i * 7 + 3) & 255);
	check(hex(S.sha256(data)) === createHash("sha256").update(data).digest("hex"), "sha256 len " + len);
}
const enc = new TextEncoder();
check(hex(S.pbkdf2Sha256(enc.encode("1234"), enc.encode("seedcraft/sequences/pin/v0"), 10000, 32))
	=== pbkdf2Sync("1234", "seedcraft/sequences/pin/v0", 10000, 32, "sha256").toString("hex"), "pbkdf2");

// vectors
const vectors = JSON.parse(read("../vectors/sequences-v0.json")).vectors;
let seed = 1;
const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
for (const v of vectors) {
	const name = `${v.name} k=${v.k} pin=${v.pin}`;
	const entropy = Uint8Array.from(Buffer.from(v.entropy, "hex"));
	check(hex(S.mnemonicToEntropy(v.mnemonic)) === v.entropy, "mnemonic -> entropy " + name);
	check(S.entropyToMnemonic(entropy) === v.mnemonic, "entropy -> mnemonic " + name);
	const symbols = S.encode(entropy, v.k, v.pin);
	check(JSON.stringify(symbols) === JSON.stringify(v.symbols), "encode (same symbols and mask as Python) " + name);
	const d = S.decode(v.symbols, v.k, v.pin);
	check(hex(d.entropy) === v.entropy && d.fixed === 0 && d.header[1] === v.mask, "decode " + name);
	// one misread object is always repaired
	const bad = v.symbols.slice();
	const pos = rand(bad.length);
	bad[pos] = (bad[pos] + 1 + rand((1 << v.k) - 1)) % (1 << v.k);
	check(hex(S.decode(bad, v.k, v.pin).entropy) === v.entropy, "1 misread object " + name);
	// a physical sequence, from either end
	const dict = Array.from({ length: 1 << v.k }, (_, i) => "object " + i);
	const seq = S.physicalSequence(v.symbols, dict);
	for (const reading of [seq, seq.slice().reverse()])
		check(hex(S.decodeObjects(reading, v.pin).entropy) === v.entropy, "objects " + name);
}
// ---- Tones ---------------------------------------------------------------
const tones = JSON.parse(read("../vectors/tones-v0.json")).vectors;
const bytes = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const damage = (frame, n) => {
	const t = [...frame], used = new Set();
	while (used.size < n) used.add(rand((frame.length - 2) / 2));
	for (const b of used) { const i = 2 + 2 * b + rand(2); t[i] = TN.KEYS[(TN.KEYS.indexOf(t[i]) + 1 + rand(15)) % 16]; }
	return t.join("");
};
for (const v of tones) {
	const name = `tones ${v.name} pin=${v.pin}`;
	if (v.entropy) {
		const e = bytes(v.entropy);
		check(TN.seedToKeypad(e, v.pin) === v.keypad, "keypad " + name);
		check(hex(TN.keypadToSeed(v.keypad, v.pin)) === v.entropy, "keypad back " + name);
		check(TN.seedToUR(e, v.pin) === v.ur, "seed UR " + name);
		check(hex(TN.urToSeed(v.ur, v.pin)) === v.entropy, "seed UR back " + name);
	}
	const urs = v.urs || [v.ur];
	urs.forEach((ur, i) => {
		check(TN.urToFrame(ur) === v.frames[i], "frame " + name);
		const back = TN.frameToUR(v.frames[i]);
		check(back.ur === ur && back.corrected === 0, "frame back " + name);
		const fixed = TN.frameToUR(damage(v.frames[i], 5));
		check(fixed.ur === ur && fixed.corrected === 5, "5 errors repaired " + name);
	});
	if (v.psbt_base64) {
		const psbt = Uint8Array.from(Buffer.from(v.psbt_base64, "base64"));
		// the fountain encoder gives the same parts as ur2 (Python), mixed ones included
		const out = TN.psbtToURs(psbt, v.fragment, v.urs.length - Math.ceil(TN.cborBytes(psbt).length / v.fragment));
		check(JSON.stringify(out.urs) === JSON.stringify(v.urs), "fountain encoder = ur2 " + name);
		// decoding: all parts; and without two pure parts, from mixed ones
		for (const drop of [[], [0, 1]]) {
			const dec = new TN.FountainDecoder();
			const enc = new TN.FountainEncoder(TN.cborBytes(psbt), v.fragment);
			let sent = 0;
			while (!dec.done && sent < 200) {
				const part = enc.nextPart();
				if (!drop.includes(sent++)) dec.receive(part);
			}
			check(dec.result && Buffer.from(TN.cborToPsbt(dec.result)).toString("base64") === v.psbt_base64,
				`fountain decoder, dropping ${drop} ${name} (${sent} parts)`);
		}
	}
}
// audio: render, noise, listen (the streaming receiver), in small chunks like a microphone
{
	const seedV = tones.find((v) => v.entropy && !v.pin), psbtV = tones.find((v) => v.psbt_base64);
	const groups = [seedV.keypad, seedV.frames[0], psbtV.frames[0]];
	for (const [rate, tone, gap] of [[8000, 40, 40], [44100, 50, 50], [48000, 80, 80]]) {
		const audio = TN.render(groups, rate, tone, gap);
		for (let i = 0; i < audio.length; i++) audio[i] += (rand(2001) - 1000) / 1000 * 0.05;
		const got = [];
		const l = new TN.Listener(rate, { onGroup: (g) => got.push(g) });
		for (let i = 0; i < audio.length; i += 4096) l.push(audio.subarray(i, i + 4096));
		l.flush();
		check(JSON.stringify(got) === JSON.stringify(groups), `audio ${rate} Hz ${tone}/${gap} ms: ${got.map((g) => g.slice(0, 8))}`);
	}
	const w = TN.readWav(TN.wav(TN.render([seedV.frames[0]], 44100), 44100));
	check(JSON.stringify(TN.listen(w.samples, w.rate)) === JSON.stringify([seedV.frames[0]]), "WAV round trip");
}

console.log(`${failures ? "FAIL" : "ok"}: ${vectors.length} + ${tones.length} vectors, ${failures} failures`);
process.exit(failures ? 1 : 0);
