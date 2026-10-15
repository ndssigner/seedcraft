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

	const DICE = [2, 4, 6, 8, 10, 12, 16, 20]; // sides; 2 is the coin

	// b bits per throw, b the largest with 2^b <= sides; faces 0..keep-1 count,
	// the rest are thrown again (§10.2). Keeping a power of two is what leaves
	// every kept face equally likely
	function diceBits(sides) {
		const b = Math.floor(Math.log2(sides));
		return { b, keep: 2 ** b };
	}

	// the k-bit number the throws give, faces numbered from 0. bits are the k
	// final bits, used the indices of the throws that count, rejected those
	// thrown again. null while throws are missing. Throws after the number is
	// complete are ignored
	function throwsToNumber(faces, sides, k) {
		const { b, keep } = diceBits(sides), bits = [], used = [], rejected = [];
		faces.forEach((f) => {
			if (!Number.isInteger(f) || f < 0 || f >= sides) throw new Error(`face ${f} is not on a die of ${sides} sides`);
		});
		for (let i = 0; i < faces.length && bits.length < k; i++) {
			if (faces[i] >= keep) { rejected.push(i); continue; }
			used.push(i);
			for (let j = b - 1; j >= 0 && bits.length < k; j--) bits.push((faces[i] >> j) & 1);
		}
		if (bits.length < k) return null;
		return { value: bits.reduce((v, x) => v * 2 + x, 0), bits, used, rejected };
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

	// ---- the seed's fingerprint (BIP-32) ---------------------------------
	// The eight hex characters a wallet shows for a seed: the first four bytes
	// of HASH160 of the master public key. Seeing the same fingerprint as the
	// wallet tells that the words are right, without showing them. All in
	// this file, with no dependency on WebCrypto: SHA-512, HMAC and PBKDF2
	// (BIP-39), RIPEMD-160, and multiplication on secp256k1.

	// SHA-512's constants, as the standard defines them: the first 64 bits of
	// the fractional parts of the square roots (H) and cube roots (K) of the
	// first primes, computed exactly with integer roots
	const iroot = (n, k) => {
		let x = 1n << BigInt(Math.ceil(n.toString(2).length / k) + 1);
		for (;;) {
			const y = ((BigInt(k) - 1n) * x + n / x ** BigInt(k - 1)) / BigInt(k);
			if (y >= x) break;
			x = y;
		}
		while ((x + 1n) ** BigInt(k) <= n) x++;
		while (x ** BigInt(k) > n) x--;
		return x;
	};
	const PRIMES = [];
	for (let c = 2; PRIMES.length < 80; c++) if (PRIMES.every((p) => c % p)) PRIMES.push(c);
	const pairs = (values) => {
		const out = new Int32Array(2 * values.length);
		values.forEach((v, i) => { out[2 * i] = Number((v >> 32n) & 0xffffffffn) | 0; out[2 * i + 1] = Number(v & 0xffffffffn) | 0; });
		return out;
	};
	const M64 = (1n << 64n) - 1n;
	const H512 = pairs(PRIMES.slice(0, 8).map((p) => iroot(BigInt(p) << 128n, 2) & M64));
	const K512 = pairs(PRIMES.map((p) => iroot(BigInt(p) << 192n, 3) & M64));

	// 64-bit words as pairs of 32-bit halves, [hi, lo]
	const W512 = new Int32Array(160);
	function sha512Block(H, data, off) {
		const W = W512;
		for (let i = 0; i < 32; i++) W[i] = (data[off + 4 * i] << 24) | (data[off + 4 * i + 1] << 16) | (data[off + 4 * i + 2] << 8) | data[off + 4 * i + 3];
		for (let i = 16; i < 80; i++) {
			const xh = W[2 * i - 30], xl = W[2 * i - 29], yh = W[2 * i - 4], yl = W[2 * i - 3];
			const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
			const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
			const s1h = ((yh >>> 19) | (yl << 13)) ^ ((yl >>> 29) | (yh << 3)) ^ (yh >>> 6);
			const s1l = ((yl >>> 19) | (yh << 13)) ^ ((yh >>> 29) | (yl << 3)) ^ ((yl >>> 6) | (yh << 26));
			const l = (W[2 * i - 31] >>> 0) + (s0l >>> 0) + (W[2 * i - 13] >>> 0) + (s1l >>> 0);
			W[2 * i] = W[2 * i - 32] + s0h + W[2 * i - 14] + s1h + Math.floor(l / 0x100000000);
			W[2 * i + 1] = l;
		}
		let [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl] = H;
		for (let i = 0; i < 80; i++) {
			const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
			const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
			const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
			const t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K512[2 * i + 1] >>> 0) + (W[2 * i + 1] >>> 0);
			const t1h = hh + S1h + chh + K512[2 * i] + W[2 * i] + Math.floor(t1l / 0x100000000);
			const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
			const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
			const mjh = (ah & bh) ^ (ah & ch) ^ (bh & ch), mjl = (al & bl) ^ (al & cl) ^ (bl & cl);
			const t2l = (S0l >>> 0) + (mjl >>> 0), t2h = S0h + mjh + Math.floor(t2l / 0x100000000);
			hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
			const el2 = (dl >>> 0) + (t1l >>> 0);
			eh = (dh + t1h + Math.floor(el2 / 0x100000000)) | 0; el = el2 | 0;
			dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
			const al2 = (t1l >>> 0) + (t2l >>> 0);
			ah = (t1h + t2h + Math.floor(al2 / 0x100000000)) | 0; al = al2 | 0;
		}
		[ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl].forEach((v, i) => {
			if (i % 2) { const l = (H[i] >>> 0) + (v >>> 0); H[i] = l | 0; H[i - 1] = (H[i - 1] + Math.floor(l / 0x100000000)) | 0; }
			else H[i] = (H[i] + v) | 0;
		});
	}
	// the hash of data, from a state that has already taken `before` bytes (a multiple of 128)
	function sha512From(state, data, before) {
		const H = Int32Array.from(state), len = data.length;
		const padded = new Uint8Array(((len + 17 + 127) >> 7) << 7);
		padded.set(data);
		padded[len] = 0x80;
		const view = new DataView(padded.buffer), bits = (before + len) * 8;
		view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
		view.setUint32(padded.length - 4, bits >>> 0);
		for (let off = 0; off < padded.length; off += 128) sha512Block(H, padded, off);
		const out = new Uint8Array(64), ov = new DataView(out.buffer);
		for (let i = 0; i < 16; i++) ov.setInt32(4 * i, H[i]);
		return out;
	}
	const sha512 = (data) => sha512From(H512, data, 0);
	// HMAC-SHA512 with its key's inner and outer states computed once (PBKDF2 calls it 4096 times)
	function hmacKey(key) {
		if (key.length > 128) key = sha512(key);
		const block = (x) => { const b = new Uint8Array(128).fill(x); key.forEach((k, i) => { b[i] ^= k; }); return b; };
		const inner = Int32Array.from(H512), outer = Int32Array.from(H512);
		sha512Block(inner, block(0x36), 0);
		sha512Block(outer, block(0x5c), 0);
		return { inner, outer };
	}
	const hmac512 = (k, msg) => sha512From(k.outer, sha512From(k.inner, msg, 128), 128);
	function pbkdf2Sha512(password, salt, iterations) {
		const k = hmacKey(password);
		const first = new Uint8Array(salt.length + 4);
		first.set(salt);
		first[salt.length + 3] = 1;
		let u = hmac512(k, first);
		const t = u.slice();
		for (let i = 1; i < iterations; i++) { u = hmac512(k, u); for (let j = 0; j < 64; j++) t[j] ^= u[j]; }
		return t;
	}

	// RIPEMD-160
	const RMD = {
		r: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
			3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
			4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13],
		rr: [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
			15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
			12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11],
		s: [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
			11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
			9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6],
		ss: [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
			9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
			8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11],
		k: [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e], kk: [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0],
	};
	function ripemd160(data) {
		const f = (j, x, y, z) => j < 16 ? x ^ y ^ z : j < 32 ? (x & y) | (~x & z) : j < 48 ? (x | ~y) ^ z : j < 64 ? (x & z) | (y & ~z) : x ^ (y | ~z);
		const rotl = (x, n) => (x << n) | (x >>> (32 - n));
		const len = data.length, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
		padded.set(data);
		padded[len] = 0x80;
		const view = new DataView(padded.buffer);
		view.setUint32(padded.length - 8, (len * 8) >>> 0, true);
		view.setUint32(padded.length - 4, Math.floor(len * 8 / 0x100000000), true);
		const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
		for (let off = 0; off < padded.length; off += 64) {
			const X = [];
			for (let i = 0; i < 16; i++) X.push(view.getUint32(off + 4 * i, true));
			let [a, b, c, d, e] = h, [a2, b2, c2, d2, e2] = h;
			for (let j = 0; j < 80; j++) {
				let t = (rotl((a + f(j, b, c, d) + X[RMD.r[j]] + RMD.k[j >> 4]) | 0, RMD.s[j]) + e) | 0;
				a = e; e = d; d = rotl(c, 10); c = b; b = t;
				t = (rotl((a2 + f(79 - j, b2, c2, d2) + X[RMD.rr[j]] + RMD.kk[j >> 4]) | 0, RMD.ss[j]) + e2) | 0;
				a2 = e2; e2 = d2; d2 = rotl(c2, 10); c2 = b2; b2 = t;
			}
			const t = (h[1] + c + d2) | 0;
			h[1] = (h[2] + d + e2) | 0; h[2] = (h[3] + e + a2) | 0; h[3] = (h[4] + a + b2) | 0; h[4] = (h[0] + b + c2) | 0; h[0] = t;
		}
		const out = new Uint8Array(20), ov = new DataView(out.buffer);
		h.forEach((v, i) => ov.setUint32(4 * i, v >>> 0, true));
		return out;
	}

	// secp256k1: k·G, in affine coordinates (done once per seed, speed does not matter)
	const P256K = (1n << 256n) - (1n << 32n) - 977n;
	const G256K = [0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n, 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n];
	const mod = (a) => ((a % P256K) + P256K) % P256K;
	function inv(a) {
		let [r0, r1, s0, s1] = [mod(a), P256K, 1n, 0n];
		while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
		return mod(s0);
	}
	function pointAdd(p, q) {
		if (!p) return q;
		if (!q) return p;
		if (p[0] === q[0] && mod(p[1] + q[1]) === 0n) return null;
		const l = p[0] === q[0] ? mod(3n * p[0] * p[0] * inv(2n * p[1])) : mod((q[1] - p[1]) * inv(q[0] - p[0]));
		const x = mod(l * l - p[0] - q[0]);
		return [x, mod(l * (p[0] - x) - p[1])];
	}
	function pointMul(k) {
		let r = null, p = G256K;
		for (; k > 0n; k >>= 1n) { if (k & 1n) r = pointAdd(r, p); p = pointAdd(p, p); }
		return r;
	}
	const hexOf = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
	const utf8 = (s) => new TextEncoder().encode(s.normalize("NFKD"));
	// BIP-39's seed, and the fingerprint of its BIP-32 master key
	const mnemonicToSeed = (mnemonic, passphrase = "") => pbkdf2Sha512(utf8(mnemonic), utf8("mnemonic" + passphrase), 2048);
	function fingerprint(mnemonic, passphrase = "") {
		const I = hmac512(hmacKey(utf8("Bitcoin seed")), mnemonicToSeed(mnemonic, passphrase));
		const [x, y] = pointMul(BigInt("0x" + hexOf(I.slice(0, 32))));
		const pub = new Uint8Array(33);
		pub[0] = y & 1n ? 3 : 2;
		pub.set(x.toString(16).padStart(64, "0").match(/../g).map((b) => parseInt(b, 16)), 1);
		return hexOf(ripemd160(sha256(pub)).slice(0, 4));
	}

	return {
		FORMAT_VERSION, HEADER_BITS, LAYOUTS, DecodeError,
		sha512, hmac512, hmacKey, pbkdf2Sha512, ripemd160, mnemonicToSeed, fingerprint,
		sha256, mnemonicToEntropy, entropyToMnemonic,
		functionModules, templateModule, dataModulesRowMajor, compactSeedQR, encode, decode,
		symbolsToBits, readSequence, decodeObjects, physicalSequence, piecesToBuy, rsCorrect,
		PAD_DIGITS, PadFileError, newPad, DICE, diceBits, throwsToNumber, addPads, encrypt, decrypt, encodePad, decodePad, decodePadObjects,
		checkCharacter, writePadFile, readPadFile,
	};
})();
