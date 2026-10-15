// Seedcraft Sequences (draft v0), JavaScript implementation: a port of
// reference/python/seedcraft_sequences.py and seedcraft_pad.py, checked
// against the same test vectors (web/test.mjs). Needs qrcodegen (Project Nayuki) and BIP39_ENGLISH.
"use strict";

const SeedcraftSequences = (() => {
	const FORMAT_VERSION = 0;
	const HEADER_BITS = 5; // format version (2) + QR mask (3)
	// entropy bytes -> [QR version, size, data codewords, error correction codewords]
	const LAYOUTS = { 16: [1, 21, 19, 7], 32: [2, 25, 34, 10] };

	class DecodeError extends Error {}

	// ---- SHA-256 (for BIP-39's checksum; no dependency on WebCrypto) -----

	const K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

	function sha256(data) {
		const len = data.length;
		const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
		padded.set(data);
		padded[len] = 0x80;
		const bitLen = len * 8;
		const view = new DataView(padded.buffer);
		view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
		view.setUint32(padded.length - 4, bitLen >>> 0);
		const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
			0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
		const w = new Uint32Array(64);
		const rotr = (x, n) => (x >>> n) | (x << (32 - n));
		for (let off = 0; off < padded.length; off += 64) {
			for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + 4 * i);
			for (let i = 16; i < 64; i++) {
				const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
				const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
				w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
			}
			let [a, b, c, d, e, f, g, hh] = h;
			for (let i = 0; i < 64; i++) {
				const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
				const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
				hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
			}
			h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
		}
		const out = new Uint8Array(32);
		const ov = new DataView(out.buffer);
		for (let i = 0; i < 8; i++) ov.setUint32(4 * i, h[i]);
		return out;
	}

	// ---- BIP-39 ------------------------------------------------------

	function mnemonicToEntropy(text) {
		const words = text.trim().toLowerCase().split(/\s+/);
		if (words.length !== 12 && words.length !== 24) throw new Error("a seed has 12 or 24 words");
		let bits = "";
		for (const w of words) {
			const i = BIP39_ENGLISH.indexOf(w);
			if (i < 0) throw new Error("\"" + w + "\" is not a BIP-39 word");
			bits += i.toString(2).padStart(11, "0");
		}
		const entBits = words.length * 32 / 3;
		const entropy = new Uint8Array(entBits / 8);
		for (let i = 0; i < entropy.length; i++) entropy[i] = parseInt(bits.slice(8 * i, 8 * i + 8), 2);
		const check = [...sha256(entropy)].map((b) => b.toString(2).padStart(8, "0")).join("");
		if (bits.slice(entBits) !== check.slice(0, entBits / 32)) throw new Error("wrong checksum: not a valid seed");
		return entropy;
	}

	function entropyToMnemonic(entropy) {
		const bits = [...entropy].map((b) => b.toString(2).padStart(8, "0")).join("")
			+ [...sha256(entropy)].map((b) => b.toString(2).padStart(8, "0")).join("").slice(0, entropy.length / 4);
		const words = [];
		for (let i = 0; i < bits.length; i += 11) words.push(BIP39_ENGLISH[parseInt(bits.slice(i, i + 11), 2)]);
		return words.join(" ");
	}

	// ---- QR geometry -------------------------------------------------

	function functionModules(size) {
		const f = new Set();
		const mark = (r, c) => { if (r >= 0 && r < size && c >= 0 && c < size) f.add(r * size + c); };
		for (const [r0, c0] of [[0, 0], [0, size - 8], [size - 8, 0]])
			for (let r = r0; r < r0 + 8; r++) for (let c = c0; c < c0 + 8; c++) mark(r, c);
		for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
		if (size === 25) for (let r = 16; r < 21; r++) for (let c = 16; c < 21; c++) mark(r, c);
		mark(size - 8, 8);
		for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
		for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
		return f;
	}

	// The colour of a function module that does not depend on the mask: finders,
	// separators, timing, the alignment pattern (25 x 25) and the dark module.
	// null: a format module, which does (it can only be drawn once the mask is known).
	function templateModule(size, r, c) {
		for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
			if (r >= r0 - 1 && r <= r0 + 7 && c >= c0 - 1 && c <= c0 + 7) {
				const dr = r - r0, dc = c - c0;
				if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return false;  // separator
				return Math.max(Math.abs(dr - 3), Math.abs(dc - 3)) !== 2;
			}
		}
		if (r === 6) return c % 2 === 0;
		if (c === 6) return r % 2 === 0;
		if (size === 25 && r >= 16 && r <= 20 && c >= 16 && c <= 20) return Math.max(Math.abs(r - 18), Math.abs(c - 18)) !== 1;
		if (r === size - 8 && c === 8) return true;
		return null;
	}

	function dataModulesRowMajor(size) {
		const f = functionModules(size), out = [];
		for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!f.has(r * size + c)) out.push([r, c]);
		return out;
	}

	function dataModulesQrOrder(size) {
		const f = functionModules(size), out = [];
		let upward = true;
		for (let col = size - 1; col > 0; col -= 2) {
			if (col === 6) col = 5;
			for (let i = 0; i < size; i++) {
				const r = upward ? size - 1 - i : i;
				for (const c of [col, col - 1]) if (!f.has(r * size + c)) out.push([r, c]);
			}
			upward = !upward;
		}
		return out;
	}

	const MASKS = [
		(r, c) => (r + c) % 2 === 0,
		(r, c) => r % 2 === 0,
		(r, c) => c % 3 === 0,
		(r, c) => (r + c) % 3 === 0,
		(r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
		(r, c) => (r * c) % 2 + (r * c) % 3 === 0,
		(r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
		(r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
	];

	// ---- encoding ----------------------------------------------------

	function compactSeedQR(entropy) {
		const version = LAYOUTS[entropy.length][0];
		return qrcodegen.QrCode.encodeSegments([qrcodegen.QrSegment.makeBytes(Array.from(entropy))],
			qrcodegen.QrCode.Ecc.LOW, version, version, -1, false);
	}

	function bitsToSymbols(bits, k) {
		bits = bits.concat(new Array((k - bits.length % k) % k).fill(0));
		const out = [];
		for (let i = 0; i < bits.length; i += k) out.push(parseInt(bits.slice(i, i + k).join(""), 2));
		return out;
	}

	function symbolsToBits(symbols, k) {
		return symbols.flatMap((s) => s.toString(2).padStart(k, "0").split("").map(Number));
	}

	// the bits that complete the last symbol are random (SPEC §3.5); pass
	// padding (a number) to choose them, as the test vectors do
	function encode(entropy, k, padding) {
		if (!LAYOUTS[entropy.length]) throw new Error("entropy is 16 bytes (12 words) or 32 bytes (24 words)");
		if (!(k >= 1 && k <= 5)) throw new Error("k is 1 to 5 (N = 2 to 32 kinds of objects)");
		const qr = compactSeedQR(entropy);
		const bits = dataModulesRowMajor(qr.size).map(([r, c]) => qr.getModule(c, r) ? 1 : 0);
		const header = FORMAT_VERSION.toString(2).padStart(2, "0") + qr.mask.toString(2).padStart(3, "0");
		const all = bits.concat(header.split("").map(Number));
		const spare = (k - all.length % k) % k;
		if (padding === undefined) padding = crypto.getRandomValues(new Uint8Array(1))[0];
		for (let i = spare - 1; i >= 0; i--) all.push((padding >> i) & 1);
		return bitsToSymbols(all, k);
	}

	// ---- decoding ----------------------------------------------------

	function parseHeader(bits) {
		return [parseInt(bits.slice(0, 2).join(""), 2), parseInt(bits.slice(2, 5).join(""), 2)];
	}

	function parseByteMode(data) {
		const bits = data.map((b) => b.toString(2).padStart(8, "0")).join("");
		if (bits.slice(0, 4) !== "0100") throw new DecodeError("not byte mode");
		const count = parseInt(bits.slice(4, 12), 2);
		const body = bits.slice(12, 12 + 8 * count);
		if (body.length !== 8 * count) throw new DecodeError("truncated data");
		const out = new Uint8Array(count);
		for (let i = 0; i < count; i++) out[i] = parseInt(body.slice(8 * i, 8 * i + 8), 2);
		return out;
	}

	function readCodewords(modules, size, mask, ndata, necc, nbytes) {
		const stream = dataModulesQrOrder(size).map(([r, c]) => modules.get(r * size + c) ^ (MASKS[mask](r, c) ? 1 : 0));
		const codewords = [];
		for (let i = 0; i < ndata + necc; i++) codewords.push(parseInt(stream.slice(8 * i, 8 * i + 8).join(""), 2));
		const [corrected, nfixed] = rsCorrect(codewords, necc);
		const payload = parseByteMode(corrected.slice(0, ndata));
		if (payload.length !== nbytes) throw new DecodeError("not a CompactSeedQR (" + payload.length + " bytes)");
		return [payload, nfixed];
	}

	function decode(symbols, k) {
		const bits = symbolsToBits(symbols, k);
		let layout = null;
		for (const [nbytes, [, size, ndata, necc]] of Object.entries(LAYOUTS)) {
			const nmod = dataModulesRowMajor(size).length;
			const total = HEADER_BITS + nmod;
			if (bits.length === total + (k - total % k) % k) { layout = [Number(nbytes), size, ndata, necc, nmod]; break; }
		}
		if (!layout) throw new DecodeError(symbols.length + " symbols of " + k + " bits is not a sequence of this format");
		const [nbytes, size, ndata, necc, nmod] = layout;
		const header = parseHeader(bits.slice(nmod, nmod + HEADER_BITS));
		const modules = new Map();
		dataModulesRowMajor(size).forEach(([r, c], i) => modules.set(r * size + c, bits[i]));
		// The header has no error correction: if its mask fails, try the others.
		let result = null, error = null;
		for (const m of [header[1], ...[0, 1, 2, 3, 4, 5, 6, 7].filter((x) => x !== header[1])]) {
			try { result = readCodewords(modules, size, m, ndata, necc, nbytes); break; }
			catch (e) { if (!(e instanceof DecodeError)) throw e; error = error || e; }
		}
		if (!result) throw error;
		const [payload, nfixed] = result;
		return { entropy: payload, fixed: nfixed, header };
	}

	// the symbols of objects read in one direction, with the dictionary (the
	// N objects in symbol order, kept apart)
	function readSequence(objects, dictionary) {
		if (new Set(dictionary).size !== dictionary.length) throw new DecodeError("the dictionary has repeated objects");
		const index = new Map(dictionary.map((o, i) => [o, i]));
		return objects.map((o) => {
			if (!index.has(o)) throw new DecodeError("object \"" + o + "\" is not in the dictionary");
			return index.get(o);
		});
	}

	// decode objects read from either end: tries both directions
	function decodeObjects(objects, dictionary) {
		const n = dictionary.length, k = Math.log2(n);
		if (!Number.isInteger(k) || k < 1 || k > 5) throw new DecodeError(n + " objects in the dictionary: N must be 2, 4, 8, 16 or 32");
		const errors = [];
		for (const reading of [objects, [...objects].reverse()]) {
			try { return Object.assign(decode(readSequence(reading, dictionary), k), { reversed: reading !== objects, k }); }
			catch (e) { if (!(e instanceof DecodeError)) throw e; errors.push(e.message); }
		}
		throw new DecodeError(errors.join("; "));
	}

	function physicalSequence(symbols, dictionary) {
		return symbols.map((s) => dictionary[s]);
	}

	// how many of each kind to buy, the same for every kind: the most any
	// kind is used, plus spare, in whole packs
	function piecesToBuy(symbols, n, pack = 5, spare = 1) {
		let most = 0;
		for (let s = 0; s < n; s++) most = Math.max(most, symbols.filter((x) => x === s).length);
		return Math.ceil((most + spare) / pack) * pack;
	}

	// ---- Reed-Solomon over GF(256), as in QR codes -------------------

	const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
	for (let i = 0, x = 1; i < 255; i++) {
		EXP[i] = x; LOG[x] = i;
		x <<= 1;
		if (x & 0x100) x ^= 0x11d;
	}
	for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
	const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
	const div = (a, b) => a === 0 ? 0 : EXP[(LOG[a] + 255 - LOG[b]) % 255];
	const polyEval = (p, x) => p.reduce((y, c) => mul(y, x) ^ c, 0);

	function rsCorrect(codewords, nsym) {
		const n = codewords.length;
		const synd = [];
		for (let i = 0; i < nsym; i++) synd.push(polyEval(codewords, EXP[i]));
		if (synd.every((s) => s === 0)) return [codewords.slice(), 0];
		let lam = [1], prev = [1], L = 0, m = 1, b = 1;
		for (let i = 0; i < nsym; i++) {
			let d = synd[i];
			for (let j = 1; j <= L; j++) d ^= mul(lam[j] || 0, synd[i - j]);
			if (d === 0) { m++; continue; }
			const coef = div(d, b);
			const shifted = new Array(m).fill(0).concat(prev.map((c) => mul(coef, c)));
			const size = Math.max(lam.length, shifted.length);
			const next = [];
			for (let j = 0; j < size; j++) next.push((lam[j] || 0) ^ (shifted[j] || 0));
			if (2 * L <= i) { prev = lam; L = i + 1 - L; b = d; m = 1; } else m++;
			lam = next;
		}
		lam = lam.slice(0, L + 1);
		while (lam.length < L + 1) lam.push(0);
		if (L === 0 || 2 * L > nsym) throw new DecodeError("too many errors to correct");
		const positions = [];
		for (let p = 0; p < n; p++) if (polyEval([...lam].reverse(), EXP[(255 - p) % 255]) === 0) positions.push(p);
		if (positions.length !== L) throw new DecodeError("too many errors to correct");
		const omega = new Array(nsym).fill(0);
		synd.forEach((s, i) => lam.forEach((l, j) => { if (i + j < nsym) omega[i + j] ^= mul(s, l); }));
		const fixed = codewords.slice();
		for (const p of positions) {
			const xinv = EXP[(255 - p) % 255];
			let num = 0, den = 0;
			omega.forEach((o, i) => { num ^= mul(o, EXP[(LOG[xinv] * i) % 255]); });
			for (let j = 1; j < lam.length; j += 2) den ^= mul(lam[j], EXP[(LOG[xinv] * (j - 1)) % 255]);
			fixed[n - 1 - p] ^= mul(EXP[p % 255], div(num, den));
		}
		for (let i = 0; i < nsym; i++) if (polyEval(fixed, EXP[i]) !== 0) throw new DecodeError("too many errors to correct");
		return [fixed, positions.length];
	}

	// ---- pad mode (SPEC §10): a port of reference/python/seedcraft_pad.py ----
	// The basic sequence P plus a random pad K, symbol by symbol, mod N:
	// C = P + K. C is made as a string of things; K is kept apart, as a
	// second string or as a text file. Alone, either says nothing.

	const PAD_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUV"; // symbol -> character, N <= 32
	const PAD_ROW = 16, PAD_GROUP = 4; // symbols per row of a pad file, characters per group

	function checkN(n) {
		if (![2, 4, 8, 16, 32].includes(n)) throw new Error("N must be 2, 4, 8, 16 or 32");
	}

	// a pad of length symbols, each uniform in 0..N-1 and independent, from the
	// browser's cryptographic generator: N divides 256, so taking the low bits
	// of each byte has no bias
	function newPad(length, n) {
		checkN(n);
		return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => b % n);
	}

	// two pads made independently, added mod N (§10.2): the result is uniform
	// if either one is (the device's pad and one made by hand)
	function addPads(a, b, n) {
		if (a.length !== b.length) throw new Error(`the two pads have different lengths (${a.length}, ${b.length})`);
		return a.map((x, i) => (x + b[i]) % n);
	}

	const encrypt = addPads; // C = (P + K) mod N, over the whole basic sequence

	// P = (C - K) mod N
	function decrypt(cipher, pad, n) {
		if (cipher.length !== pad.length) throw new Error(`the sequence has ${cipher.length} symbols and the pad ${pad.length}`);
		return cipher.map((c, i) => (c - pad[i] + n) % n);
	}

	// { sequence, pad }: the pad-mode sequence and its pad. A new pad is drawn
	// unless one is given (the test vectors fix it, and padding)
	function encodePad(entropy, k, pad, padding) {
		const n = 1 << k, plain = encode(entropy, k, padding);
		if (!pad) pad = newPad(plain.length, n);
		else if (pad.length !== plain.length) throw new Error(`the pad has ${pad.length} symbols; this sequence needs ${plain.length}`);
		return { sequence: encrypt(plain, pad, n), pad: pad.slice() };
	}

	// The seed from a pad-mode sequence and its pad: tries the sequence in both
	// directions against the pad, and both roles (C - K and K - C, in case the
	// two were swapped), and decodes each result in both directions (SPEC §4,
	// §10.9); only the right one decodes. Returns decode()'s result plus
	// swapped (what was given as the pad is the sequence; with N = 2 the two
	// roles give the same result, and swapped is false) and plain, the basic
	// sequence as decoded.
	function decodePad(cipher, pad, k) {
		const n = 1 << k;
		if (cipher.length !== pad.length) throw new DecodeError(`the sequence has ${cipher.length} things and the pad ${pad.length}: they must be equal`);
		const errors = [];
		for (const swapped of [false, true]) {
			for (const seq of [cipher, [...cipher].reverse()]) {
				const plain = swapped ? decrypt(pad, seq, n) : decrypt(seq, pad, n);
				for (const reading of [plain, [...plain].reverse()]) {
					try { return Object.assign(decode(reading, k), { swapped, plain: reading }); }
					catch (e) { if (!(e instanceof DecodeError)) throw e; errors.push(e.message); }
				}
			}
		}
		throw new DecodeError("no direction or role decodes: " + errors[0]);
	}

	// a pad-mode sequence and a pad kept as a second string, each read from
	// either end with its dictionary (the same one unless the pad has its own)
	function decodePadObjects(objects, padObjects, dictionary, padDictionary) {
		const n = dictionary.length, k = Math.log2(n);
		if (!Number.isInteger(k) || k < 1 || k > 5) throw new DecodeError(n + " objects in the dictionary: N must be 2, 4, 8, 16 or 32");
		padDictionary = padDictionary || dictionary;
		if (padDictionary.length !== n) throw new DecodeError("the two dictionaries have different sizes");
		return decodePad(readSequence(objects, dictionary), readSequence(padObjects, padDictionary), k);
	}

	// A pad file that cannot be read. code says what is wrong (for the
	// interface's texts), line is its line number (from 1) or null, and
	// detail the character or the numbers involved.
	class PadFileError extends Error {
		constructor(code, message, line = null, detail = null) {
			super(line === null ? message : `line ${line}: ${message}`);
			Object.assign(this, { code, line, detail });
		}
	}

	// Luhn mod N (§10.9): from the last symbol leftwards, weights 2, 1, 2, 1...;
	// doubling d gives 2d if 2d < N, else 2d - N + 1. The check is
	// (N - (sum mod N)) mod N. It is a function of the pad only.
	function checkCharacter(symbols, n) {
		let total = 0;
		[...symbols].reverse().forEach((d, i) => {
			if (i % 2 === 0) d = 2 * d < n ? 2 * d : 2 * d - n + 1;
			total += d;
		});
		return (n - total % n) % n;
	}

	// the pad as text: "L N", then rows of 16 symbols in groups of 4, each row
	// ending in its check character. No header says what it is.
	function writePadFile(pad, n) {
		checkN(n);
		if (pad.some((s) => !(s >= 0 && s < n))) throw new Error("pad symbols are 0 to N - 1");
		const lines = [`${pad.length} ${n}`];
		for (let i = 0; i < pad.length; i += PAD_ROW) {
			const row = pad.slice(i, i + PAD_ROW), chars = row.map((s) => PAD_DIGITS[s]).join("");
			const groups = [];
			for (let j = 0; j < chars.length; j += PAD_GROUP) groups.push(chars.slice(j, j + PAD_GROUP));
			lines.push(groups.concat(PAD_DIGITS[checkCharacter(row, n)]).join(" "));
		}
		return lines.join("\n") + "\n";
	}

	// { pad, n } from a pad file. Throws PadFileError, with the line, for a
	// wrong check character, a character out of range, a row of the wrong
	// length or a count that does not match.
	function readPadFile(text) {
		const rows = [];
		text.split(/\r?\n/).forEach((line, i) => {
			line = line.split("#")[0].trim();
			if (line) rows.push([i + 1, line]);
		});
		if (!rows.length) throw new PadFileError("empty", "empty pad file");
		const [first, head] = rows[0];
		const m = /^(\d+)\s+(\d+)$/.exec(head);
		if (!m) throw new PadFileError("first", "the first line is the number of symbols and N, e.g. '54 16'", first);
		const length = Number(m[1]), n = Number(m[2]);
		if (![2, 4, 8, 16, 32].includes(n)) throw new PadFileError("n", `N must be 2, 4, 8, 16 or 32, not ${n}`, first, n);
		const pad = [];
		rows.slice(1).forEach(([number, line], i) => {
			const groups = line.toUpperCase().split(/\s+/);
			if (groups.length < 2 || groups[groups.length - 1].length !== 1)
				throw new PadFileError("nocheck", "a row ends in a space and its check character", number);
			const values = [...groups.join("")].map((ch) => {
				const v = PAD_DIGITS.indexOf(ch);
				if (!(v >= 0 && v < n)) throw new PadFileError("char", `'${ch}' is not a symbol for N = ${n}`, number, ch);
				return v;
			});
			const row = values.slice(0, -1), check = values[values.length - 1], last = i === rows.length - 2;
			if (row.length > PAD_ROW || (!last && row.length !== PAD_ROW))
				throw new PadFileError("row", `${row.length} symbols in this row; every row but the last has ${PAD_ROW}`, number, row.length);
			if (checkCharacter(row, n) !== check)
				throw new PadFileError("check", "the check character does not match: a symbol in this row is copied wrong", number);
			pad.push(...row);
		});
		if (pad.length !== length) throw new PadFileError("count", `the first line says ${length} symbols, the rows have ${pad.length}`, null, [length, pad.length]);
		return { pad, n };
	}

	return {
		FORMAT_VERSION, HEADER_BITS, LAYOUTS, DecodeError,
		sha256, mnemonicToEntropy, entropyToMnemonic,
		functionModules, templateModule, dataModulesRowMajor, compactSeedQR, encode, decode,
		symbolsToBits, readSequence, decodeObjects, physicalSequence, piecesToBuy, rsCorrect,
		PAD_DIGITS, PadFileError, newPad, addPads, encrypt, decrypt, encodePad, decodePad, decodePadObjects,
		checkCharacter, writePadFile, readPadFile,
	};
})();
