"""Seedcraft Tones, reference implementation (draft v0, SPEC-tones.md).

Data mode: a UR (single-part, or one part of a multi-part UR) <-> a frame of
DTMF tones with Reed-Solomon error correction. Keypad mode: a seed <-> its
Standard SeedQR digits between * and #. And audio: tones <-> samples, with a
Goertzel receiver (SPEC appendix A).

Standard library only. Reuses the Reed-Solomon decoder and the PIN of
seedcraft_sequences. The bytewords word list is Blockchain Commons'
(BCR-2020-012), as in every UR implementation.
"""
import hashlib
import math
import operator
import struct
import wave
import zlib

from seedcraft_sequences import _EXP, _LOG, _mul, DecodeError, pin_xor, rs_correct

FORMAT_VERSION = 0
KEYS = "0123456789ABCD*#"  # nibble value -> key
SYNC = "AD"
PARITY = 10  # Reed-Solomon parity bytes per frame
KIND_SINGLE, KIND_PART = 0, 1
UR_TYPES = ["", "crypto-psbt", "psbt", "crypto-seed", "seed", "crypto-account",
            "account-descriptor", "crypto-output", "output-descriptor", "bytes",
            "crypto-hdkey", "hdkey"]

LOW = (697, 770, 852, 941)
HIGH = (1209, 1336, 1477, 1633)
PAD = ("123A", "456B", "789C", "*0#D")  # [low][high] -> key
FREQS = {PAD[r][c]: (LOW[r], HIGH[c]) for r in range(4) for c in range(4)}


# ---- bytewords (minimal style: first and last letter of each word) ---------

BYTEWORDS = (
    "ableacidalsoapexaquaarchatomauntawayaxisbackbaldbarnbeltbetabiasbluebody"
    "bragbrewbulbbuzzcalmcashcatschefcityclawcodecolacookcostcruxcurlcuspcyan"
    "darkdatadaysdelidicedietdoordowndrawdropdrumdulldutyeacheasyechoedgeepic"
    "evenexamexiteyesfactfairfernfigsfilmfishfizzflapflewfluxfoxyfreefrogfuel"
    "fundgalagamegeargemsgiftgirlglowgoodgraygrimgurugushgyrohalfhanghardhawk"
    "heathelphighhillholyhopehornhutsicedideaidleinchinkyintoirisironitemjade"
    "jazzjoinjoltjowljudojugsjumpjunkjurykeepkenokeptkeyskickkilnkingkitekiwi"
    "knoblamblavalazyleaflegsliarlimplionlistlogoloudloveluaulucklungmainmany"
    "mathmazememomenumeowmildmintmissmonknailnavyneednewsnextnoonnotenumbobey"
    "oboeomitonyxopenovalowlspaidpartpeckplaypluspoempoolposepuffpumapurrquad"
    "quizraceramprealredorichroadrockroofrubyruinrunsrustsafesagascarsetssilk"
    "skewslotsoapsolosongstubsurfswantacotasktaxitenttiedtimetinytoiltombtoys"
    "triptunatwinuglyundouniturgeuservastveryvetovialvibeviewvisavoidvowswall"
    "wandwarmwaspwavewaxywebswhatwhenwhizwolfworkyankyawnyellyogayurtzapszero"
    "zestzinczonezoom")
_MINIMAL = [BYTEWORDS[4 * i] + BYTEWORDS[4 * i + 3] for i in range(256)]
_FROM_MINIMAL = {w: i for i, w in enumerate(_MINIMAL)}


def bytewords_minimal(data):
    """data + its CRC-32, in minimal bytewords (as in a UR's text)."""
    data = bytes(data) + struct.pack(">I", zlib.crc32(data))
    return "".join(_MINIMAL[b] for b in data)


def from_bytewords_minimal(text):
    if len(text) % 2:
        raise DecodeError("bytewords: odd length")
    try:
        data = bytes(_FROM_MINIMAL[text[i:i + 2]] for i in range(0, len(text), 2))
    except KeyError:
        raise DecodeError("bytewords: not a word")
    if len(data) < 5 or struct.pack(">I", zlib.crc32(data[:-4])) != data[-4:]:
        raise DecodeError("bytewords: wrong checksum")
    return data[:-4]


# ---- Reed-Solomon encoder (the code of rs_correct: QR codes' code) ----------

def _generator(nsym):
    """Product of (x - alpha^i), i = 0 .. nsym - 1; highest degree first."""
    g = [1]
    for i in range(nsym):
        g = [a ^ _mul(b, _EXP[i]) for a, b in zip(g + [0], [0] + g)]
    return g


def rs_encode(data, nsym=PARITY):
    """The parity bytes: remainder of data(x) * x^nsym divided by g(x)."""
    g = _generator(nsym)
    rem = list(data) + [0] * nsym
    for i in range(len(data)):
        coef = rem[i]
        if coef:
            for j in range(1, len(g)):
                rem[i + j] ^= _mul(g[j], coef)
    return bytes(rem[len(data):])


# ---- tiny CBOR: just what a multi-part UR's part needs ----------------------

def _cbor_uint(buf, i):
    """(value, next index) of the unsigned integer at buf[i]."""
    if buf[i] >> 5 != 0:
        raise DecodeError("CBOR: not an unsigned integer")
    info = buf[i] & 31
    if info < 24:
        return info, i + 1
    size = {24: 1, 25: 2, 26: 4, 27: 8}.get(info)
    if size is None:
        raise DecodeError("CBOR: bad integer")
    return int.from_bytes(buf[i + 1:i + 1 + size], "big"), i + 1 + size


def part_sequence(body):
    """(seqNum, seqLen) of a multi-part UR part's CBOR."""
    if not body or body[0] != 0x85:
        raise DecodeError("not a UR part: [seqNum, seqLen, messageLen, checksum, fragment]")
    seq, i = _cbor_uint(body, 1)
    count, _ = _cbor_uint(body, i)
    return seq, count


# ---- data mode: UR <-> frame -------------------------------------------------

def parse_ur(ur):
    """(type, kind, body) of a UR's text."""
    ur = ur.strip().lower()
    if not ur.startswith("ur:"):
        raise ValueError("not a UR")
    path = ur[3:].split("/")
    if len(path) == 2:
        kind = KIND_SINGLE
    elif len(path) == 3:
        kind = KIND_PART
    else:
        raise ValueError("not a UR: ur:<type>/[<seq>-<count>/]<bytewords>")
    body = from_bytewords_minimal(path[-1])
    if kind == KIND_PART:
        seq, count = (int(x) for x in path[1].split("-"))
        if part_sequence(body) != (seq, count):
            raise ValueError("the part's sequence does not match its CBOR")
    return path[0], kind, body


def ur_text(type_, kind, body):
    """The UR's text, as any UR decoder takes it."""
    if kind == KIND_PART:
        seq, count = part_sequence(body)
        return "ur:%s/%d-%d/%s" % (type_, seq, count, bytewords_minimal(body))
    return "ur:%s/%s" % (type_, bytewords_minimal(body))


def ur_to_frame(ur):
    """The tones of the frame that carries this UR (SPEC §2.1)."""
    type_, kind, body = parse_ur(ur)
    if not 1 <= len(body) <= 255:
        raise ValueError("a frame's body is 1 to 255 bytes")
    if type_ in UR_TYPES[1:]:
        head = bytes([FORMAT_VERSION << 4 | kind, UR_TYPES.index(type_), len(body)])
    else:
        name = type_.encode("ascii")
        head = bytes([FORMAT_VERSION << 4 | kind, 0, len(body), len(name)]) + name
    data = head + body
    if len(data) + PARITY > 255:
        raise ValueError("too long for one frame: use a multi-part UR")
    codeword = data + rs_encode(data)
    return SYNC + "".join(KEYS[b >> 4] + KEYS[b & 15] for b in codeword)


def frame_to_ur(tones):
    """(UR text, bytes corrected) of a frame's tones. Raises DecodeError."""
    if not tones.startswith(SYNC):
        raise DecodeError("no sync")
    nibbles = tones[len(SYNC):]
    if len(nibbles) % 2 or not 2 * (PARITY + 4) <= len(nibbles) <= 2 * 255:
        raise DecodeError("frame length")
    try:
        codeword = [KEYS.index(nibbles[i]) << 4 | KEYS.index(nibbles[i + 1])
                    for i in range(0, len(nibbles), 2)]
    except ValueError:
        raise DecodeError("not a DTMF key")
    codeword, corrected = rs_correct(codeword, PARITY)
    data = bytes(codeword[:-PARITY])
    version, kind = data[0] >> 4, data[0] & 15
    if version != FORMAT_VERSION or kind not in (KIND_SINGLE, KIND_PART):
        raise DecodeError("unknown format version or kind")
    code, length, i = data[1], data[2], 3
    if code == 0:
        n = data[3]
        type_ = data[4:4 + n].decode("ascii", "replace")
        i = 4 + n
    elif code < len(UR_TYPES):
        type_ = UR_TYPES[code]
    else:
        raise DecodeError("unknown UR type code")
    body = data[i:]
    if len(body) != length:
        raise DecodeError("length")
    return ur_text(type_, kind, body), corrected


# ---- seeds -------------------------------------------------------------------

def _indices(entropy):
    """BIP-39 word indices (checksum included) of the entropy."""
    bits = len(entropy) * 8
    n = int.from_bytes(entropy, "big") << (bits // 32)
    n |= hashlib.sha256(entropy).digest()[0] >> (8 - bits // 32)
    words = (bits + bits // 32) // 11
    return [(n >> (11 * (words - 1 - i))) & 2047 for i in range(words)]


def _entropy(indices):
    """The entropy of BIP-39 word indices; checks the checksum."""
    words = len(indices)
    if words not in (12, 24) or any(not 0 <= i < 2048 for i in indices):
        raise DecodeError("12 or 24 words, each 0-2047")
    n = 0
    for i in indices:
        n = n << 11 | i
    cs = words // 3
    entropy = (n >> cs).to_bytes(words * 4 // 3, "big")
    if _indices(entropy)[-1] != indices[-1]:
        raise DecodeError("wrong BIP-39 checksum")
    return entropy


def seed_to_keypad(entropy, pin=None):
    """The keypad-mode tones of a seed (SPEC §3)."""
    if pin:
        entropy = pin_xor(entropy, pin)
    return "*" + "".join("%04d" % i for i in _indices(entropy)) + "#"


def keypad_to_seed(tones, pin=None):
    """The entropy of keypad-mode tones. Raises DecodeError."""
    if not (tones.startswith("*") and tones.endswith("#")) or not tones[1:-1].isdigit():
        raise DecodeError("keypad mode is *, digits, #")
    digits = tones[1:-1]
    if len(digits) % 4:
        raise DecodeError("four digits per word")
    entropy = _entropy([int(digits[i:i + 4]) for i in range(0, len(digits), 4)])
    return pin_xor(entropy, pin) if pin else entropy


def seed_to_ur(entropy, pin=None, type_="crypto-seed"):
    """A single-part crypto-seed (or seed) UR: CBOR {1: entropy}."""
    if pin:
        entropy = pin_xor(entropy, pin)
    head = b"\xa1\x01\x50" if len(entropy) == 16 else b"\xa1\x01\x58\x20"  # map {1: bytes}
    return ur_text(type_, KIND_SINGLE, head + entropy)


def ur_to_seed(ur, pin=None):
    type_, kind, body = parse_ur(ur)
    if type_ not in ("crypto-seed", "seed") or kind != KIND_SINGLE:
        raise DecodeError("not a single-part seed UR")
    if len(body) < 3 or body[:2] != b"\xa1\x01" or body[2] not in (0x50, 0x58):
        raise DecodeError("seed CBOR: {1: entropy} expected")
    entropy = body[3:] if body[2] == 0x50 else body[4:4 + body[3]]
    if len(entropy) not in (16, 32):
        raise DecodeError("entropy of 16 or 32 bytes expected")
    return pin_xor(entropy, pin) if pin else entropy


# ---- audio: tones -> samples -------------------------------------------------

LOW_LEVEL = 10 ** (-12 / 20)   # -12 dBFS
HIGH_LEVEL = 10 ** (-10 / 20)  # -10 dBFS: the high tone 2 dB louder


def render(groups, rate=8000, tone_ms=50, gap_ms=50, pause_ms=400, detune=1.0):
    """Samples (floats, -1 to 1) of groups of tones, each group after a pause.
    detune scales every frequency (to test a receiver's tolerance)."""
    out = [0.0] * int(rate * pause_ms / 1000)
    n = int(rate * tone_ms / 1000)
    ramp = max(1, int(rate * 0.002))  # 2 ms fades: no clicks
    for g, group in enumerate(groups):
        if g:
            out += [0.0] * int(rate * pause_ms / 1000)
        for key in group:
            lo, hi = FREQS[key]
            w1, w2 = 2 * math.pi * lo * detune / rate, 2 * math.pi * hi * detune / rate
            for i in range(n):
                env = min(1.0, i / ramp, (n - 1 - i) / ramp)
                out.append(env * (LOW_LEVEL * math.sin(w1 * i) + HIGH_LEVEL * math.sin(w2 * i)))
            out += [0.0] * int(rate * gap_ms / 1000)
    out += [0.0] * int(rate * pause_ms / 1000)
    return out


# ---- audio: samples -> tones (SPEC appendix A) -------------------------------

def detect(samples, rate):
    """One key or None every 5 ms, from a 20 ms window (Goertzel on the eight
    DTMF frequencies)."""
    n, hop = int(rate * 0.020), int(rate * 0.005)
    basis = []
    for f in LOW + HIGH:
        w = 2 * math.pi * f / rate
        basis.append(([math.cos(w * i) for i in range(n)], [math.sin(w * i) for i in range(n)]))
    keys = []
    for start in range(0, len(samples) - n + 1, hop):
        x = samples[start:start + n]
        total = sum(map(operator.mul, x, x))
        if total / n < 10 ** (-50 / 10):  # quieter than -50 dBFS: silence
            keys.append(None)
            continue
        power = []
        for c, s in basis:
            re, im = sum(map(operator.mul, x, c)), sum(map(operator.mul, x, s))
            power.append((re * re + im * im) * 2 / n)
        low, high = power[:4], power[4:]
        r, c = max(range(4), key=low.__getitem__), max(range(4), key=high.__getitem__)
        lo, hi = low[r], high[c]
        ok = (lo > 4 * max(p for i, p in enumerate(low) if i != r)        # 6 dB over the rest
              and hi > 4 * max(p for i, p in enumerate(high) if i != c)
              and (lo + hi) > 0.5 * total                                 # most of the energy
              and 10 ** -0.8 < hi / lo < 10 ** 0.8)                       # twist within 8 dB
        keys.append(PAD[r][c] if ok else None)
    return keys


def segment(keys, min_hops=3):
    """[(key, start hop, end hop)] from detect(): runs of one key of at least
    min_hops (15 ms); shorter runs, of keys or of silence, are glitches."""
    runs = []
    for k in keys:
        if runs and runs[-1][0] == k:
            runs[-1][1] += 1
        else:
            runs.append([k, 1])
    tones, pos = [], 0
    for k, length in runs:
        if k is not None and length >= min_hops:
            if tones and tones[-1][0] == k and pos - tones[-1][2] < min_hops:
                tones[-1] = (k, tones[-1][1], pos + length)  # a glitch split it
            else:
                tones.append((k, pos, pos + length))
        pos += length
    return tones


def listen(samples, rate):
    """Groups of tones (strings), split by silences longer than 225 ms (SPEC
    §1.1); a group that starts with * runs to its #, whatever the silences."""
    tones = segment(detect(samples, rate))
    hop_ms = 1000 * int(rate * 0.005) / rate
    groups, current, last_end, keypad = [], "", None, False
    for key, start, end in tones:
        long_pause = last_end is not None and (start - last_end) * hop_ms > 225
        if current and long_pause and not keypad:
            groups.append(current)
            current = ""
        if not current:
            keypad = key == "*"
        current += key
        last_end = end
        if keypad and key == "#":
            groups.append(current)
            current, keypad = "", False
    if current:
        groups.append(current)
    return groups


def receive(samples, rate, pin=None):
    """What a receiver gets from audio: a list of ("ur", text), ("seed",
    entropy) or ("error", reason, tones)."""
    out = []
    for group in listen(samples, rate):
        try:
            if group.startswith(SYNC):
                out.append(("ur", frame_to_ur(group)[0]))
            elif group.startswith("*"):
                out.append(("seed", keypad_to_seed(group, pin)))
            else:
                out.append(("error", "no sync", group))
        except DecodeError as e:
            out.append(("error", str(e), group))
    return out


# ---- WAV files ---------------------------------------------------------------

def write_wav(path, samples, rate):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", max(-32767, min(32767, round(s * 32767))))
                               for s in samples))


def read_wav(path):
    """(samples as floats, rate). 16-bit PCM; stereo is mixed down."""
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2:
            raise ValueError("16-bit PCM only")
        ch, rate, frames = w.getnchannels(), w.getframerate(), w.readframes(w.getnframes())
    pcm = struct.unpack("<%dh" % (len(frames) // 2), frames)
    return [sum(pcm[i:i + ch]) / (ch * 32768) for i in range(0, len(pcm), ch)], rate
