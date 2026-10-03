// Seedcraft Tones (draft v0), JavaScript implementation: a port of
// reference/python/seedcraft_tones.py, plus multi-part URs (UR's fountain
// codes, ported from the Python library SeedSigner bundles, Foundation
// Devices' ur2, BSD-2-Clause-Patent) and a streaming receiver for a
// microphone. Checked against the same test vectors (web/test.mjs).
// Needs SeedcraftSequences (SHA-256, PIN, Reed-Solomon decoder).
"use strict";

const SeedcraftTones = (() => {
	const S = SeedcraftSequences;
	const { DecodeError } = S;
	const FORMAT_VERSION = 0;
	const KEYS = "0123456789ABCD*#";
	const SYNC = "AD";
	const PARITY = 10;
	const KIND_SINGLE = 0, KIND_PART = 1;
	const UR_TYPES = ["", "crypto-psbt", "psbt", "crypto-seed", "seed", "crypto-account",
		"account-descriptor", "crypto-output", "output-descriptor", "bytes", "crypto-hdkey", "hdkey"];
	const LOW = [697, 770, 852, 941], HIGH = [1209, 1336, 1477, 1633];
	const PAD = ["123A", "456B", "789C", "*0#D"];
	const FREQS = {};
	PAD.forEach((row, r) => [...row].forEach((k, c) => { FREQS[k] = [LOW[r], HIGH[c]]; }));

	const concat = (...parts) => {
		const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
		let i = 0;
		for (const p of parts) { out.set(p, i); i += p.length; }
		return out;
	};
	const u32be = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);

	// ---- CRC-32 (as zlib) --------------------------------------------
	const CRC_TABLE = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		CRC_TABLE[n] = c >>> 0;
	}
	function crc32(data) {
		let c = 0xffffffff;
		for (const b of data) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	}

	// ---- bytewords, minimal style --------------------------------------
	const BYTEWORDS =
		"ableacidalsoapexaquaarchatomauntawayaxisbackbaldbarnbeltbetabiasbluebody" +
		"bragbrewbulbbuzzcalmcashcatschefcityclawcodecolacookcostcruxcurlcuspcyan" +
		"darkdatadaysdelidicedietdoordowndrawdropdrumdulldutyeacheasyechoedgeepic" +
		"evenexamexiteyesfactfairfernfigsfilmfishfizzflapflewfluxfoxyfreefrogfuel" +
		"fundgalagamegeargemsgiftgirlglowgoodgraygrimgurugushgyrohalfhanghardhawk" +
		"heathelphighhillholyhopehornhutsicedideaidleinchinkyintoirisironitemjade" +
		"jazzjoinjoltjowljudojugsjumpjunkjurykeepkenokeptkeyskickkilnkingkitekiwi" +
		"knoblamblavalazyleaflegsliarlimplionlistlogoloudloveluaulucklungmainmany" +
		"mathmazememomenumeowmildmintmissmonknailnavyneednewsnextnoonnotenumbobey" +
		"oboeomitonyxopenovalowlspaidpartpeckplaypluspoempoolposepuffpumapurrquad" +
		"quizraceramprealredorichroadrockroofrubyruinrunsrustsafesagascarsetssilk" +
		"skewslotsoapsolosongstubsurfswantacotasktaxitenttiedtimetinytoiltombtoys" +
		"triptunatwinuglyundouniturgeuservastveryvetovialvibeviewvisavoidvowswall" +
		"wandwarmwaspwavewaxywebswhatwhenwhizwolfworkyankyawnyellyogayurtzapszero" +
		"zestzinczonezoom";
	const MINIMAL = Array.from({ length: 256 }, (_, i) => BYTEWORDS[4 * i] + BYTEWORDS[4 * i + 3]);
	const FROM_MINIMAL = new Map(MINIMAL.map((w, i) => [w, i]));

	function bytewordsMinimal(data) {
		return [...concat(data, u32be(crc32(data)))].map((b) => MINIMAL[b]).join("");
	}
	function fromBytewordsMinimal(text) {
		if (text.length % 2) throw new DecodeError("bytewords: odd length");
		const data = new Uint8Array(text.length / 2);
		for (let i = 0; i < data.length; i++) {
			const b = FROM_MINIMAL.get(text.slice(2 * i, 2 * i + 2));
			if (b === undefined) throw new DecodeError("bytewords: not a word");
			data[i] = b;
		}
		if (data.length < 5) throw new DecodeError("bytewords: too short");
		const body = data.slice(0, -4);
		if (crc32(body) !== ((data[data.length - 4] << 24 | data[data.length - 3] << 16 | data[data.length - 2] << 8 | data[data.length - 1]) >>> 0))
			throw new DecodeError("bytewords: wrong checksum");
		return body;
	}

	// ---- tiny CBOR ----------------------------------------------------
	function cborHead(major, n) {
		if (n < 24) return Uint8Array.of(major << 5 | n);
		if (n < 256) return Uint8Array.of(major << 5 | 24, n);
		if (n < 65536) return Uint8Array.of(major << 5 | 25, n >> 8, n & 255);
		return concat(Uint8Array.of(major << 5 | 26), u32be(n));
	}
	const cborBytes = (b) => concat(cborHead(2, b.length), b);
	function cborRead(buf, i, major) {
		if (i >= buf.length || buf[i] >> 5 !== major) throw new DecodeError("CBOR: unexpected item");
		const info = buf[i] & 31;
		if (info < 24) return [info, i + 1];
		const size = { 24: 1, 25: 2, 26: 4 }[info];
		if (!size || i + size >= buf.length) throw new DecodeError("CBOR: bad length");
		let v = 0;
		for (let j = 1; j <= size; j++) v = v * 256 + buf[i + j];
		return [v, i + 1 + size];
	}
	function cborReadBytes(buf, i) {
		const [n, j] = cborRead(buf, i, 2);
		if (j + n > buf.length) throw new DecodeError("CBOR: truncated");
		return [buf.slice(j, j + n), j + n];
	}

	// ---- UR fountain codes (BCR-2020-005), as ur2 ----------------------
	const M64 = (1n << 64n) - 1n;
	const rotl = (x, k) => ((x << k) | (x >> (64n - k))) & M64;
	class Xoshiro256 {
		constructor(seed32) { // seeded from a SHA-256 digest
			this.s = [0, 1, 2, 3].map((i) => seed32.slice(8 * i, 8 * i + 8).reduce((v, b) => (v << 8n) | BigInt(b), 0n));
		}
		next() {
			const s = this.s;
			const result = (rotl((s[1] * 5n) & M64, 7n) * 9n) & M64;
			const t = (s[1] << 17n) & M64;
			s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
			s[2] ^= t;
			s[3] = rotl(s[3], 45n);
			return result;
		}
		nextDouble() { return Number(this.next()) / 18446744073709551616; }
		nextInt(low, high) { return Math.floor(this.nextDouble() * (high - low + 1) + low); }
	}
	function randomSampler(probs) { // Vose's alias method, as ur2
		const n = probs.length, total = probs.reduce((a, b) => a + b, 0);
		const P = probs.map((p) => (p * n) / total);
		const small = [], large = [];
		for (let i = n - 1; i >= 0; i--) (P[i] < 1 ? small : large).push(i);
		const prob = new Array(n).fill(0), alias = new Array(n).fill(0);
		while (small.length && large.length) {
			const a = small.pop(), g = large.pop();
			prob[a] = P[a]; alias[a] = g;
			P[g] += P[a] - 1;
			(P[g] < 1 ? small : large).push(g);
		}
		while (large.length) prob[large.pop()] = 1;
		while (small.length) prob[small.pop()] = 1;
		return (rng) => {
			const r1 = rng(), r2 = rng();
			const i = Math.floor(n * r1);
			return r2 < prob[i] ? i : alias[i];
		};
	}
	function chooseFragments(seqNum, seqLen, checksum) {
		if (seqNum <= seqLen) return [seqNum - 1];
		const rng = new Xoshiro256(S.sha256(concat(u32be(seqNum), u32be(checksum))));
		const degree = randomSampler(Array.from({ length: seqLen }, (_, i) => 1 / (i + 1)))(() => rng.nextDouble()) + 1;
		const remaining = Array.from({ length: seqLen }, (_, i) => i), shuffled = [];
		while (remaining.length) shuffled.push(remaining.splice(rng.nextInt(0, remaining.length - 1), 1)[0]);
		return shuffled.slice(0, degree).sort((a, b) => a - b);
	}
	function nominalFragmentLength(messageLen, minLen, maxLen) {
		let len = 0;
		for (let count = 1; count <= Math.floor(messageLen / minLen); count++) {
			len = Math.ceil(messageLen / count);
			if (len <= maxLen) break;
		}
		return len;
	}

	class FountainEncoder {
		constructor(message, maxFragmentLen = 100, minFragmentLen = 10) {
			this.messageLen = message.length;
			this.checksum = crc32(message);
			this.fragmentLen = nominalFragmentLength(message.length, minFragmentLen, maxFragmentLen);
			this.fragments = [];
			for (let i = 0; i < message.length; i += this.fragmentLen) {
				const f = new Uint8Array(this.fragmentLen);
				f.set(message.slice(i, i + this.fragmentLen));
				this.fragments.push(f);
			}
			this.seqNum = 0;
		}
		get seqLen() { return this.fragments.length; }
		nextPart() { // the part's CBOR: [seqNum, seqLen, messageLen, checksum, fragment]
			this.seqNum = (this.seqNum + 1) >>> 0;
			const data = new Uint8Array(this.fragmentLen);
			for (const i of chooseFragments(this.seqNum, this.seqLen, this.checksum))
				this.fragments[i].forEach((b, j) => { data[j] ^= b; });
			return concat(Uint8Array.of(0x85), cborHead(0, this.seqNum), cborHead(0, this.seqLen),
				cborHead(0, this.messageLen), cborHead(0, this.checksum), cborBytes(data));
		}
	}

	function parsePart(body) {
		if (body[0] !== 0x85) throw new DecodeError("not a UR part");
		let i = 1;
		const v = [];
		for (let k = 0; k < 4; k++) { const [x, j] = cborRead(body, i, 0); v.push(x); i = j; }
		const [data] = cborReadBytes(body, i);
		return { seqNum: v[0], seqLen: v[1], messageLen: v[2], checksum: v[3], data };
	}

	class FountainDecoder {
		constructor() { this.expected = null; this.simple = new Map(); this.mixed = new Map(); this.queue = []; this.result = null; this.error = null; this.received = 0; }
		get done() { return this.result !== null || this.error !== null; }
		progress() { return this.expected ? this.simple.size / this.expected.seqLen : 0; }
		receive(body) { // a part's CBOR; true if it was useful
			if (this.done) return false;
			const p = parsePart(body);
			if (!this.expected) this.expected = { seqLen: p.seqLen, messageLen: p.messageLen, checksum: p.checksum, fragmentLen: p.data.length };
			else {
				const e = this.expected;
				if (p.seqLen !== e.seqLen || p.messageLen !== e.messageLen || p.checksum !== e.checksum || p.data.length !== e.fragmentLen) return false;
			}
			this.received++;
			const before = this.simple.size + this.mixed.size * 1000;
			this.queue.push({ idx: chooseFragments(p.seqNum, p.seqLen, p.checksum), data: p.data });
			while (!this.done && this.queue.length) {
				const part = this.queue.shift();
				if (part.idx.length === 1) this.simplePart(part); else this.mixedPart(part);
			}
			return this.done || this.simple.size + this.mixed.size * 1000 !== before;
		}
		reduce(a, b) { // a without b, if b's fragments are a strict subset of a's
			if (b.idx.length < a.idx.length && b.idx.every((i) => a.idx.includes(i)))
				return { idx: a.idx.filter((i) => !b.idx.includes(i)), data: a.data.map((x, j) => x ^ b.data[j]) };
			return a;
		}
		simplePart(p) {
			const index = p.idx[0];
			if (this.simple.has(index)) return;
			this.simple.set(index, p);
			if (this.simple.size === this.expected.seqLen) {
				const msg = concat(...[...this.simple.keys()].sort((a, b) => a - b).map((i) => this.simple.get(i).data)).slice(0, this.expected.messageLen);
				if (crc32(msg) === this.expected.checksum) this.result = msg;
				else this.error = "wrong message checksum";
				return;
			}
			this.reduceMixedBy(p);
		}
		reduceMixedBy(p) {
			const next = new Map();
			for (const m of this.mixed.values()) {
				const r = this.reduce(m, p);
				if (r.idx.length === 1) this.queue.push(r); else next.set(r.idx.join(","), r);
			}
			this.mixed = next;
		}
		mixedPart(p) {
			if (this.mixed.has(p.idx.join(","))) return;
			for (const r of this.simple.values()) p = this.reduce(p, r);
			for (const r of this.mixed.values()) p = this.reduce(p, r);
			if (p.idx.length === 1) { this.queue.push(p); return; }
			this.reduceMixedBy(p);
			this.mixed.set(p.idx.join(","), p);
		}
	}

	// ---- URs and frames -------------------------------------------------
	function parseUR(text) {
		const ur = text.trim().toLowerCase();
		if (!ur.startsWith("ur:")) throw new DecodeError("not a UR");
		const path = ur.slice(3).split("/");
		if (path.length !== 2 && path.length !== 3) throw new DecodeError("not a UR");
		const kind = path.length === 2 ? KIND_SINGLE : KIND_PART;
		const body = fromBytewordsMinimal(path[path.length - 1]);
		if (kind === KIND_PART) {
			const p = parsePart(body);
			if (path[1] !== `${p.seqNum}-${p.seqLen}`) throw new DecodeError("the part's sequence does not match its CBOR");
		}
		return { type: path[0], kind, body };
	}
	function urText(type, kind, body) {
		if (kind === KIND_PART) {
			const p = parsePart(body);
			return `ur:${type}/${p.seqNum}-${p.seqLen}/${bytewordsMinimal(body)}`;
		}
		return `ur:${type}/${bytewordsMinimal(body)}`;
	}

	// Reed-Solomon encoder (the decoder is SeedcraftSequences.rsCorrect)
	const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
	for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
	for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
	const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
	function rsEncode(data, nsym = PARITY) {
		let g = [1];
		for (let i = 0; i < nsym; i++) g = [...g, 0].map((a, j) => a ^ mul(j ? g[j - 1] : 0, EXP[i]));
		const rem = [...data, ...new Array(nsym).fill(0)];
		for (let i = 0; i < data.length; i++) {
			const c = rem[i];
			if (c) for (let j = 1; j < g.length; j++) rem[i + j] ^= mul(g[j], c);
		}
		return Uint8Array.from(rem.slice(data.length));
	}

	function urToFrame(ur) {
		const { type, kind, body } = parseUR(ur);
		if (body.length < 1 || body.length > 255) throw new DecodeError("a frame's body is 1 to 255 bytes");
		const code = UR_TYPES.indexOf(type);
		const head = code > 0 ? Uint8Array.of(FORMAT_VERSION << 4 | kind, code, body.length)
			: concat(Uint8Array.of(FORMAT_VERSION << 4 | kind, 0, body.length, type.length), Uint8Array.from(type, (c) => c.charCodeAt(0) & 127));
		const data = concat(head, body);
		if (data.length + PARITY > 255) throw new DecodeError("too long for one frame: use a multi-part UR");
		return SYNC + [...concat(data, rsEncode(data))].map((b) => KEYS[b >> 4] + KEYS[b & 15]).join("");
	}
	function frameToUR(tones) {
		if (!tones.startsWith(SYNC)) throw new DecodeError("no sync");
		const nib = tones.slice(SYNC.length);
		if (nib.length % 2 || nib.length < 2 * (PARITY + 4) || nib.length > 510) throw new DecodeError("frame length");
		const cw = [];
		for (let i = 0; i < nib.length; i += 2) {
			const a = KEYS.indexOf(nib[i]), b = KEYS.indexOf(nib[i + 1]);
			if (a < 0 || b < 0) throw new DecodeError("not a DTMF key");
			cw.push(a << 4 | b);
		}
		const [fixed, corrected] = S.rsCorrect(cw, PARITY);
		const data = Uint8Array.from(fixed.slice(0, -PARITY));
		const version = data[0] >> 4, kind = data[0] & 15;
		if (version !== FORMAT_VERSION || (kind !== KIND_SINGLE && kind !== KIND_PART)) throw new DecodeError("unknown format version or kind");
		let type, i = 3;
		if (data[1] === 0) { type = String.fromCharCode(...data.slice(4, 4 + data[3])); i = 4 + data[3]; }
		else if (data[1] < UR_TYPES.length) type = UR_TYPES[data[1]];
		else throw new DecodeError("unknown UR type code");
		const body = data.slice(i);
		if (body.length !== data[2]) throw new DecodeError("length");
		return { ur: urText(type, kind, body), type, kind, body, corrected };
	}

	// a message (CBOR) as the URs to send: one, or the first parts of a loop
	function messageToURs(type, cbor, fragment = 100, extra = 0) {
		const enc = new FountainEncoder(cbor, fragment);
		if (enc.seqLen === 1) return { urs: [urText(type, KIND_SINGLE, cbor)], encoder: null };
		const urs = [];
		for (let i = 0; i < enc.seqLen + extra; i++) urs.push(urText(type, KIND_PART, enc.nextPart()));
		return { urs, encoder: enc, type };
	}
	const psbtToURs = (psbt, fragment, extra) => messageToURs("crypto-psbt", cborBytes(psbt), fragment, extra);
	function cborToPsbt(cbor) { // crypto-psbt and psbt: a byte string
		const [psbt, end] = cborReadBytes(cbor, 0);
		if (end !== cbor.length) throw new DecodeError("PSBT CBOR: trailing bytes");
		return psbt;
	}

	// ---- seeds ---------------------------------------------------------
	function indices(entropy) {
		const bits = [...entropy].map((b) => b.toString(2).padStart(8, "0")).join("")
			+ [...S.sha256(entropy)].map((b) => b.toString(2).padStart(8, "0")).join("").slice(0, entropy.length / 4);
		return bits.match(/.{11}/g).map((b) => parseInt(b, 2));
	}
	function fromIndices(idx) {
		if ((idx.length !== 12 && idx.length !== 24) || idx.some((i) => !(i >= 0 && i < 2048))) throw new DecodeError("12 or 24 words, each 0-2047");
		const bits = idx.map((i) => i.toString(2).padStart(11, "0")).join("");
		const nbytes = idx.length * 4 / 3;
		const entropy = Uint8Array.from(bits.slice(0, nbytes * 8).match(/.{8}/g).map((b) => parseInt(b, 2)));
		if (indices(entropy).at(-1) !== idx.at(-1)) throw new DecodeError("wrong BIP-39 checksum");
		return entropy;
	}
	const seedToKeypad = (entropy, pin) => "*" + indices(pin ? S.pinXor(entropy, pin) : entropy).map((i) => String(i).padStart(4, "0")).join("") + "#";
	function keypadToSeed(tones, pin) {
		if (!/^\*\d+#$/.test(tones)) throw new DecodeError("keypad mode is *, digits, #");
		const digits = tones.slice(1, -1);
		if (digits.length % 4) throw new DecodeError("four digits per word");
		const e = fromIndices(digits.match(/.{4}/g).map(Number));
		return pin ? S.pinXor(e, pin) : e;
	}
	function seedToUR(entropy, pin, type = "crypto-seed") {
		const e = pin ? S.pinXor(entropy, pin) : entropy;
		return urText(type, KIND_SINGLE, concat(Uint8Array.of(0xa1, 0x01), cborBytes(e)));
	}
	function urToSeed(ur, pin) {
		const { type, kind, body } = parseUR(ur);
		if ((type !== "crypto-seed" && type !== "seed") || kind !== KIND_SINGLE) throw new DecodeError("not a single-part seed UR");
		if (body[0] !== 0xa1 || body[1] !== 0x01) throw new DecodeError("seed CBOR: {1: entropy} expected");
		const [e] = cborReadBytes(body, 2);
		if (e.length !== 16 && e.length !== 32) throw new DecodeError("entropy of 16 or 32 bytes expected");
		return pin ? S.pinXor(e, pin) : e;
	}

	// ---- audio: tones -> samples ------------------------------------------
	const LOW_LEVEL = 10 ** (-12 / 20), HIGH_LEVEL = 10 ** (-10 / 20);
	function render(groups, rate = 8000, toneMs = 50, gapMs = 50, pauseMs = 400) {
		const n = Math.floor(rate * toneMs / 1000), gap = Math.floor(rate * gapMs / 1000), pause = Math.floor(rate * pauseMs / 1000);
		const total = pause * (groups.length + 1) + groups.reduce((s, g) => s + g.length * (n + gap), 0);
		const out = new Float32Array(total);
		const ramp = Math.max(1, Math.floor(rate * 0.002));
		let pos = pause;
		groups.forEach((group, gi) => {
			if (gi) pos += pause;
			for (const key of group) {
				const [lo, hi] = FREQS[key];
				const w1 = 2 * Math.PI * lo / rate, w2 = 2 * Math.PI * hi / rate;
				for (let i = 0; i < n; i++) {
					const env = Math.min(1, i / ramp, (n - 1 - i) / ramp);
					out[pos + i] = env * (LOW_LEVEL * Math.sin(w1 * i) + HIGH_LEVEL * Math.sin(w2 * i));
				}
				pos += n + gap;
			}
		});
		return out;
	}
	function wav(samples, rate) { // 16-bit mono PCM
		const buf = new DataView(new ArrayBuffer(44 + 2 * samples.length));
		const str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
		str(0, "RIFF"); buf.setUint32(4, 36 + 2 * samples.length, true); str(8, "WAVEfmt ");
		buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
		buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
		str(36, "data"); buf.setUint32(40, 2 * samples.length, true);
		samples.forEach((s, i) => buf.setInt16(44 + 2 * i, Math.max(-32767, Math.min(32767, Math.round(s * 32767))), true));
		return new Uint8Array(buf.buffer);
	}
	function readWav(bytes) { // 16-bit PCM, any channels -> {samples, rate}
		const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const tag = (o) => String.fromCharCode(...bytes.slice(o, o + 4));
		if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new DecodeError("not a WAV file");
		let o = 12, fmt = null;
		while (o + 8 <= bytes.length) {
			const id = tag(o), size = v.getUint32(o + 4, true);
			if (id === "fmt ") fmt = { ch: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
			if (id === "data") {
				if (!fmt || fmt.bits !== 16) throw new DecodeError("16-bit PCM WAV only");
				const n = Math.floor(Math.min(size, bytes.length - o - 8) / (2 * fmt.ch));
				const out = new Float32Array(n);
				for (let i = 0; i < n; i++) {
					let s = 0;
					for (let c = 0; c < fmt.ch; c++) s += v.getInt16(o + 8 + 2 * (i * fmt.ch + c), true);
					out[i] = s / (fmt.ch * 32768);
				}
				return { samples: out, rate: fmt.rate };
			}
			o += 8 + size + (size & 1);
		}
		throw new DecodeError("WAV without data");
	}

	// ---- audio: samples -> tones, streaming (SPEC appendix A) -----------------
	// push(samples) as they come; onTone(key), onGroup(tones) are called back.
	class Listener {
		constructor(rate, { onTone = () => {}, onGroup = () => {}, onLevel = () => {} } = {}) {
			Object.assign(this, { rate, onTone, onGroup, onLevel });
			this.n = Math.floor(rate * 0.020); this.hop = Math.floor(rate * 0.005);
			this.hopMs = 1000 * this.hop / rate;
			this.basis = [...LOW, ...HIGH].map((f) => {
				const w = 2 * Math.PI * f / rate, c = new Float32Array(this.n), s = new Float32Array(this.n);
				for (let i = 0; i < this.n; i++) { c[i] = Math.cos(w * i); s[i] = Math.sin(w * i); }
				return [c, s];
			});
			this.buf = new Float32Array(0);
			this.run = { key: undefined, len: 0 };      // current run of one detection
			this.last = null;                           // last tone: {key, end}
			this.pos = 0;                               // hops so far
			this.group = ""; this.keypad = false;
		}
		detectWindow(x) {
			let total = 0;
			for (let i = 0; i < x.length; i++) total += x[i] * x[i];
			this.onLevel(10 * Math.log10(total / x.length + 1e-12));
			if (total / x.length < 1e-5) return null; // -50 dBFS
			const power = this.basis.map(([c, s]) => {
				let re = 0, im = 0;
				for (let i = 0; i < x.length; i++) { re += x[i] * c[i]; im += x[i] * s[i]; }
				return (re * re + im * im) * 2 / x.length;
			});
			const best = (arr) => { let b = 0; arr.forEach((p, i) => { if (p > arr[b]) b = i; }); return b; };
			const low = power.slice(0, 4), high = power.slice(4);
			const r = best(low), c = best(high), lo = low[r], hi = high[c];
			const ok = lo > 4 * Math.max(...low.filter((_, i) => i !== r)) && hi > 4 * Math.max(...high.filter((_, i) => i !== c))
				&& lo + hi > 0.5 * total && hi / lo > 10 ** -0.8 && hi / lo < 10 ** 0.8;
			return ok ? PAD[r][c] : null;
		}
		push(samples) {
			const buf = new Float32Array(this.buf.length + samples.length);
			buf.set(this.buf); buf.set(samples, this.buf.length);
			let start = 0;
			for (; start + this.n <= buf.length; start += this.hop) this.step(this.detectWindow(buf.subarray(start, start + this.n)));
			this.buf = buf.slice(start);
		}
		step(key) { // as segment() + listen(): runs of 3 hops or more
			if (key === this.run.key) this.run.len++;
			else { this.endRun(); this.run = { key, len: 1 }; }
			this.pos++;
			// a long silence closes a data group
			if (key === null && this.group && !this.keypad && this.last && (this.pos - this.last.end) * this.hopMs > 225) this.closeGroup();
		}
		endRun() {
			const { key, len } = this.run;
			const end = this.pos;
			if (key && len >= 3) {
				const start = end - len;
				if (this.last && this.last.key === key && start - this.last.end < 3) { this.last.end = end; return; }
				this.tone(key, start, end);
			}
		}
		tone(key, start, end) {
			if (this.group && !this.keypad && this.last && (start - this.last.end) * this.hopMs > 225) this.closeGroup();
			if (!this.group) this.keypad = key === "*";
			this.group += key;
			this.last = { key, end };
			this.onTone(key);
			if (this.keypad && key === "#") this.closeGroup();
		}
		closeGroup() { const g = this.group; this.group = ""; this.keypad = false; if (g) this.onGroup(g); }
		flush() { this.endRun(); this.run = { key: undefined, len: 0 }; this.closeGroup(); }
	}
	function listen(samples, rate) {
		const groups = [];
		const l = new Listener(rate, { onGroup: (g) => groups.push(g) });
		l.push(samples); l.flush();
		return groups;
	}

	return {
		FORMAT_VERSION, KEYS, SYNC, PARITY, UR_TYPES, FREQS, DecodeError,
		crc32, bytewordsMinimal, fromBytewordsMinimal, cborBytes, parseUR, urText, urToFrame, frameToUR,
		FountainEncoder, FountainDecoder, parsePart, messageToURs, psbtToURs, cborToPsbt,
		seedToKeypad, keypadToSeed, seedToUR, urToSeed, render, wav, readWav, Listener, listen,
	};
})();
