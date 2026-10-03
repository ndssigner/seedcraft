"""Seedcraft, shared by the reference implementations: the PIN (Sequences
SPEC §3.2, also Tones §4), Reed-Solomon over GF(256) as in QR codes, CRC-32.

Standard library only, and MicroPython-friendly (no zlib.crc32 there).
"""
import hashlib

PIN_SALT = b"seedcraft/sequences/pin/v0"
PIN_ITERATIONS = 10000


class DecodeError(ValueError):
    pass


# ---- PIN obfuscation (SPEC §3.2) --------------------------------------

def normalize_pin(pin):
    """A PIN is letters A-Z and digits 0-9, case-insensitive (SPEC §3.2)."""
    pin = pin.upper()
    if not pin or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" for ch in pin):
        raise ValueError("a PIN is letters A-Z and digits 0-9")
    return pin


def pin_xor(entropy, pin):
    """Entropy XOR PBKDF2-HMAC-SHA256(PIN). Its own inverse."""
    key = hashlib.pbkdf2_hmac("sha256", normalize_pin(pin).encode("ascii"), PIN_SALT,
                              PIN_ITERATIONS, len(entropy))
    return bytes(a ^ b for a, b in zip(entropy, key))


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


# ---- Reed-Solomon encoder (the code of rs_correct: QR codes' code) ----------

def _generator(nsym):
    """Product of (x - alpha^i), i = 0 .. nsym - 1; highest degree first."""
    g = [1]
    for i in range(nsym):
        g = [a ^ _mul(b, _EXP[i]) for a, b in zip(g + [0], [0] + g)]
    return g


def rs_encode(data, nsym):
    """The parity bytes: remainder of data(x) * x^nsym divided by g(x)."""
    g = _generator(nsym)
    rem = list(data) + [0] * nsym
    for i in range(len(data)):
        coef = rem[i]
        if coef:
            for j in range(1, len(g)):
                rem[i + j] ^= _mul(g[j], coef)
    return bytes(rem[len(data):])


# ---- CRC-32 (as zlib's) -------------------------------------------------

_CRC = []
for _n in range(256):
    _c = _n
    for _k in range(8):
        _c = 0xEDB88320 ^ (_c >> 1) if _c & 1 else _c >> 1
    _CRC.append(_c)


def crc32(data):
    c = 0xFFFFFFFF
    for b in data:
        c = _CRC[(c ^ b) & 255] ^ (c >> 8)
    return c ^ 0xFFFFFFFF
