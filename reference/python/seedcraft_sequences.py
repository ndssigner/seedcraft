"""Seedcraft Sequences, reference implementation (draft v0, SPEC-sequences.md).

A BIP-39 seed's entropy -> its CompactSeedQR -> the QR code's data modules,
row by row -> data bits + header -> symbols of k bits (N = 2**k kinds of
objects). And back, with the QR code's Reed-Solomon error correction.

Standard library only, plus Project Nayuki's QR Code generator (qrcodegen.py,
MIT, unmodified), so that every implementation picks the same mask.
"""
import hashlib

from qrcodegen import QrCode, QrSegment

FORMAT_VERSION = 0
PIN_SALT = b"seedcraft/sequences/pin/v0"
PIN_ITERATIONS = 10000

# entropy bytes -> (QR version, size, data codewords, error correction codewords)
# CompactSeedQR: byte mode, error correction level L, one block.
LAYOUTS = {16: (1, 21, 19, 7), 32: (2, 25, 34, 10)}
HEADER_BITS = 5  # format version (2) + QR mask (3)


# ---- QR geometry -------------------------------------------------------

def function_modules(size):
    """Set of (row, col) of the function patterns: finders with separators,
    timing lines, format areas, the dark module and (version 2) the
    alignment pattern."""
    f = set()
    for r0, c0 in ((0, 0), (0, size - 8), (size - 8, 0)):
        f.update((r, c) for r in range(r0, r0 + 8) for c in range(c0, c0 + 8))
    for i in range(size):
        f.add((6, i))
        f.add((i, 6))
    if size == 25:
        f.update((r, c) for r in range(16, 21) for c in range(16, 21))
    f.add((size - 8, 8))
    for i in range(9):
        f.add((8, i))
        f.add((i, 8))
    for i in range(8):
        f.add((8, size - 1 - i))
        f.add((size - 1 - i, 8))
    return {(r, c) for r, c in f if 0 <= r < size and 0 <= c < size}


def data_modules_row_major(size):
    """The data modules in Seedcraft's reading order (SPEC §3.4): row by row,
    top to bottom, each row left to right, as a person writes."""
    func = function_modules(size)
    return [(r, c) for r in range(size) for c in range(size) if (r, c) not in func]


def data_modules_qr_order(size):
    """The data modules in the QR standard's placement order (pairs of
    columns from the right, up and down alternately, column 6 skipped),
    where the codeword bits are."""
    func = function_modules(size)
    order = []
    upward = True
    col = size - 1
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(size - 1, -1, -1) if upward else range(size)
        for r in rows:
            for c in (col, col - 1):
                if (r, c) not in func:
                    order.append((r, c))
        upward = not upward
        col -= 2
    return order


MASKS = [
    lambda r, c: (r + c) % 2 == 0,
    lambda r, c: r % 2 == 0,
    lambda r, c: c % 3 == 0,
    lambda r, c: (r + c) % 3 == 0,
    lambda r, c: (r // 2 + c // 3) % 2 == 0,
    lambda r, c: (r * c) % 2 + (r * c) % 3 == 0,
    lambda r, c: ((r * c) % 2 + (r * c) % 3) % 2 == 0,
    lambda r, c: ((r + c) % 2 + (r * c) % 3) % 2 == 0,
]


# ---- PIN obfuscation (SPEC §3.2) --------------------------------------

def pin_xor(entropy, pin):
    """Entropy XOR PBKDF2-HMAC-SHA256(PIN). Its own inverse."""
    if not pin.isdigit():
        raise ValueError("the PIN is decimal digits")
    key = hashlib.pbkdf2_hmac("sha256", pin.encode("ascii"), PIN_SALT, PIN_ITERATIONS,
                              len(entropy))
    return bytes(a ^ b for a, b in zip(entropy, key))


# ---- encoding ----------------------------------------------------------

def compact_seedqr(entropy):
    """The CompactSeedQR of the entropy (byte mode, level L, fixed version)."""
    version = LAYOUTS[len(entropy)][0]
    return QrCode.encode_segments([QrSegment.make_bytes(entropy)], QrCode.Ecc.LOW,
                                  minversion=version, maxversion=version, boostecl=False)


def bits_to_symbols(bits, k):
    bits = bits + [0] * (-len(bits) % k)
    return [int("".join(map(str, bits[i:i + k])), 2) for i in range(0, len(bits), k)]


def symbols_to_bits(symbols, k):
    return [int(b) for s in symbols for b in format(s, "0%db" % k)]


def encode(entropy, k, pin=None):
    """The symbols (data + header) for a 16- or 32-byte entropy."""
    if len(entropy) not in LAYOUTS:
        raise ValueError("entropy is 16 bytes (12 words) or 32 bytes (24 words)")
    if not 1 <= k <= 5:
        raise ValueError("k is 1 to 5 (N = 2 to 32 kinds of objects)")
    payload = pin_xor(entropy, pin) if pin else entropy
    qr = compact_seedqr(payload)
    size = qr.get_size()
    bits = [1 if qr.get_module(c, r) else 0 for r, c in data_modules_row_major(size)]
    header = format(FORMAT_VERSION, "02b") + format(qr.get_mask(), "03b")
    bits += [int(b) for b in header]
    return bits_to_symbols(bits, k)


# ---- decoding ----------------------------------------------------------

class DecodeError(ValueError):
    pass


def parse_header(bits):
    """(version, mask). The header has no error correction: decode() does
    not trust it (only version 0 exists, and every mask is tried)."""
    return int("".join(map(str, bits[0:2])), 2), int("".join(map(str, bits[2:5])), 2)


def decode(symbols, k, pin=None):
    """The entropy from the symbols (data + header); pass the PIN if the
    sequence was made with one (it is not recorded: a wrong or missing PIN
    gives a different, valid seed). Raises DecodeError if the QR code cannot
    be read, even with error correction. Returns (entropy, codewords
    corrected, header as read: (version, mask))."""
    bits = symbols_to_bits(symbols, k)
    for nbytes, (version, size, ndata, necc) in LAYOUTS.items():
        nmod = len(data_modules_row_major(size))
        if len(bits) - (-(HEADER_BITS + nmod) % k) == HEADER_BITS + nmod:
            break
    else:
        raise DecodeError("%d symbols of %d bits is not a sequence of this format"
                          % (len(symbols), k))
    header = parse_header(bits[nmod:nmod + HEADER_BITS])
    mask = header[1]
    modules = dict(zip(data_modules_row_major(size), bits[:nmod]))
    # The header has no error correction: if its mask does not give a valid
    # QR code, try the other seven (only the right one decodes).
    error = None
    for m in [mask] + [m for m in range(8) if m != mask]:
        try:
            payload, nfixed = _read_codewords(modules, size, m, version, ndata, necc, nbytes)
            break
        except DecodeError as e:
            error = error or e
    else:
        raise error
    if pin:
        payload = pin_xor(payload, pin)
    return payload, nfixed, header


def _read_codewords(modules, size, mask, version, ndata, necc, nbytes):
    """Unmask, read the codeword bits in the QR placement order, correct
    errors and parse the CompactSeedQR. Returns (payload, codewords fixed)."""
    stream = [modules[(r, c)] ^ (1 if MASKS[mask](r, c) else 0)
              for r, c in data_modules_qr_order(size)]
    codewords = [int("".join(map(str, stream[i * 8:i * 8 + 8])), 2)
                 for i in range(ndata + necc)]
    corrected, nfixed = rs_correct(codewords, necc)
    payload = parse_byte_mode(corrected[:ndata], version)
    if len(payload) != nbytes:
        raise DecodeError("not a CompactSeedQR (%d bytes)" % len(payload))
    return payload, nfixed


def parse_byte_mode(data, version):
    bits = "".join(format(b, "08b") for b in data)
    if bits[:4] != "0100":
        raise DecodeError("not byte mode")
    count = int(bits[4:12], 2)  # 8-bit count for versions 1-9
    body = bits[12:12 + 8 * count]
    if len(body) != 8 * count:
        raise DecodeError("truncated data")
    return bytes(int(body[i:i + 8], 2) for i in range(0, len(body), 8))


def read_sequence(objects, n=None):
    """The symbols of a physical sequence read in one direction: its first n
    objects are the dictionary (n = number of distinct objects if not
    given). Objects are any hashable names."""
    n = n or len(set(objects))
    dictionary = objects[:n]
    if len(set(dictionary)) != n:
        raise DecodeError("the first %d objects are not all different" % n)
    index = {obj: i for i, obj in enumerate(dictionary)}
    try:
        return [index[obj] for obj in objects[n:]]
    except KeyError as e:
        raise DecodeError("object %r is not in the dictionary" % (e.args[0],))


def decode_objects(objects, pin=None):
    """Decode a physical sequence read from either end, in either
    direction: tries the readings whose first N objects are all different
    and keeps the one that decodes (SPEC §4)."""
    n = len(set(objects))
    k = n.bit_length() - 1
    if n != 1 << k or not 1 <= k <= 5:
        raise DecodeError("%d kinds of objects: N must be 2, 4, 8, 16 or 32" % n)
    errors = []
    for reading in (list(objects), list(reversed(objects))):
        try:
            return decode(read_sequence(reading, n), k, pin)
        except DecodeError as e:
            errors.append(str(e))
    raise DecodeError("; ".join(errors))


def physical_sequence(symbols, dictionary):
    """Dictionary followed by the objects for the symbols."""
    return list(dictionary) + [dictionary[s] for s in symbols]


# ---- Reed-Solomon over GF(256), as in QR codes ------------------------

_EXP = [0] * 512
_LOG = [0] * 256
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _mul(a, b):
    return 0 if a == 0 or b == 0 else _EXP[_LOG[a] + _LOG[b]]


def _div(a, b):
    if b == 0:
        raise ZeroDivisionError
    return 0 if a == 0 else _EXP[(_LOG[a] + 255 - _LOG[b]) % 255]


def _poly_eval(p, x):
    """p[0] is the highest degree coefficient."""
    y = p[0]
    for c in p[1:]:
        y = _mul(y, x) ^ c
    return y


def rs_correct(codewords, nsym):
    """Corrects up to nsym // 2 wrong codewords (data + error correction).
    Returns (corrected codewords, number corrected)."""
    n = len(codewords)
    synd = [_poly_eval(codewords, _EXP[i]) for i in range(nsym)]
    if not any(synd):
        return list(codewords), 0
    # Berlekamp-Massey: error locator Lambda(x), lowest degree first
    lam, prev, L, m, b = [1], [1], 0, 1, 1
    for i in range(nsym):
        d = synd[i]
        for j in range(1, L + 1):
            d ^= _mul(lam[j], synd[i - j])
        if d == 0:
            m += 1
            continue
        coef = _div(d, b)
        shifted = [0] * m + [_mul(coef, c) for c in prev]
        new = [x ^ y for x, y in zip(lam + [0] * len(shifted), shifted + [0] * len(lam))]
        if 2 * L <= i:
            prev, L, b, m = lam, i + 1 - L, d, 1
        else:
            m += 1
        lam = new
    lam = lam[:L + 1]
    if L == 0 or 2 * L > nsym:
        raise DecodeError("too many errors to correct")
    # Chien search: position p (from the end, degree p) is wrong if
    # Lambda(alpha^-p) == 0
    positions = [p for p in range(n) if _poly_eval(lam[::-1], _EXP[(255 - p) % 255]) == 0]
    if len(positions) != L:
        raise DecodeError("too many errors to correct")
    # Forney: Omega(x) = S(x) Lambda(x) mod x^nsym
    omega = [0] * nsym
    for i, s in enumerate(synd):
        for j, l in enumerate(lam):
            if i + j < nsym:
                omega[i + j] ^= _mul(s, l)
    fixed = list(codewords)
    for p in positions:
        xinv = _EXP[(255 - p) % 255]
        num = 0
        for i, o in enumerate(omega):
            num ^= _mul(o, _EXP[(_LOG[xinv] * i) % 255] if xinv else 0)
        den = 0
        for j in range(1, len(lam), 2):  # formal derivative: odd terms
            den ^= _mul(lam[j], _EXP[(_LOG[xinv] * (j - 1)) % 255])
        # first consecutive root alpha^0: magnitude = X * Omega(X^-1) / Lambda'(X^-1)
        mag = _mul(_EXP[p % 255], _div(num, den))
        fixed[n - 1 - p] ^= mag
    if any(_poly_eval(fixed, _EXP[i]) for i in range(nsym)):
        raise DecodeError("too many errors to correct")
    return fixed, len(positions)
