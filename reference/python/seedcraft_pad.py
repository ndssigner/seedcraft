"""Seedcraft Sequences, pad mode (SPEC-sequences.md §10), reference
implementation.

The basic sequence P (seedcraft_sequences.encode: data, header, padding
bits) plus a random pad K, symbol by symbol, mod N: C = P + K. C is what is
made as a sequence of things; K is kept apart, as a second string or as a
text file (§10.7). Alone, either says nothing about the seed (RISK-AUDIT.md
§4.1). The basic mode is untouched: this module only adds and subtracts.
"""
import os

import seedcraft_sequences as sc

DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUV"  # symbol -> character, N <= 32
ROW = 16  # pad symbols per row of a pad file
GROUP = 4  # characters per group in a row


def _check_n(n):
    if n not in (2, 4, 8, 16, 32):
        raise ValueError("N must be 2, 4, 8, 16 or 32")


# ---- the pad -----------------------------------------------------------

def new_pad(length, n):
    """A pad of length symbols, each uniform in 0..N-1 and independent, from
    the operating system's cryptographic generator. N divides 256, so taking
    the low bits of each byte has no bias."""
    _check_n(n)
    return [b % n for b in os.urandom(length)]


def add_pads(a, b, n):
    """Two pads made independently, added mod N (§10.2): the result is
    uniform if either one is (RISK-AUDIT.md §4.6). For the device's pad and
    one made by hand with coins, a die or a bag."""
    if len(a) != len(b):
        raise ValueError("the two pads have different lengths (%d, %d)" % (len(a), len(b)))
    return [(x + y) % n for x, y in zip(a, b)]


def encrypt(plain, pad, n):
    """C = (P + K) mod N, over the whole basic sequence."""
    return add_pads(plain, pad, n)


def decrypt(cipher, pad, n):
    """P = (C - K) mod N."""
    if len(cipher) != len(pad):
        raise ValueError("the sequence has %d symbols and the pad %d" % (len(cipher), len(pad)))
    return [(c - p) % n for c, p in zip(cipher, pad)]


def encode(entropy, k, pad=None, padding=None):
    """(C, K): the pad-mode sequence and its pad, for a 16- or 32-byte
    entropy. A new pad is drawn unless one is given (the test vectors fix
    it, and padding, as seedcraft_sequences.encode does)."""
    n = 1 << k
    plain = sc.encode(entropy, k, padding=padding)
    if pad is None:
        pad = new_pad(len(plain), n)
    elif len(pad) != len(plain):
        raise ValueError("the pad has %d symbols; this sequence needs %d" % (len(pad), len(plain)))
    return encrypt(plain, pad, n), list(pad)


def decode(cipher, pad, k):
    """The entropy from a pad-mode sequence and its pad. Tries the sequence
    in both directions against the pad, and both roles (C - K and K - C, in
    case the two were swapped), and decodes each result in both directions
    as a basic sequence (SPEC §4, §10.9); only the right one decodes.
    Returns (entropy, codewords corrected, header as read, swapped), where
    swapped says that what was given as the pad is the sequence (with N = 2
    the two roles give the same result, and swapped is False)."""
    n = 1 << k
    if len(cipher) != len(pad):
        raise sc.DecodeError("the sequence has %d things and the pad %d: they must be equal"
                             % (len(cipher), len(pad)))
    errors = []
    for swapped in (False, True):
        for seq in (list(cipher), list(reversed(cipher))):
            plain = decrypt(pad, seq, n) if swapped else decrypt(seq, pad, n)
            for reading in (plain, plain[::-1]):
                try:
                    entropy, nfixed, header = sc.decode(reading, k)
                    return entropy, nfixed, header, swapped
                except sc.DecodeError as e:
                    errors.append(str(e))
    raise sc.DecodeError("no direction or role decodes: " + errors[0])


def decode_objects(objects, pad_objects, dictionary, pad_dictionary=None):
    """A pad-mode sequence and a pad kept as a second string, each read from
    either end with its dictionary (the same one unless the pad has its own,
    SPEC §11.4)."""
    n = len(dictionary)
    k = n.bit_length() - 1
    if n != 1 << k or not 1 <= k <= 5:
        raise sc.DecodeError("%d objects in the dictionary: N must be 2, 4, 8, 16 or 32" % n)
    pad_dictionary = dictionary if pad_dictionary is None else pad_dictionary
    if len(pad_dictionary) != n:
        raise sc.DecodeError("the two dictionaries have different sizes")
    return decode(sc.read_sequence(objects, dictionary),
                  sc.read_sequence(pad_objects, pad_dictionary), k)


# ---- the pad file (§10.7, §10.9) ---------------------------------------

class PadFileError(ValueError):
    """A pad file that cannot be read. line is its line number (from 1), or
    None if the problem is not in one line."""

    def __init__(self, message, line=None):
        super().__init__(message if line is None else "line %d: %s" % (line, message))
        self.line = line


def check_character(symbols, n):
    """Luhn mod N (§10.9): from the last symbol leftwards, weights 2, 1, 2,
    1...; doubling d gives 2d if 2d < N, else 2d - N + 1. The check is
    (N - (sum mod N)) mod N. It is a function of the pad only."""
    total = 0
    for i, d in enumerate(reversed(symbols)):
        if i % 2 == 0:
            d = 2 * d if 2 * d < n else 2 * d - n + 1
        total += d
    return (n - total % n) % n


def write_pad_file(pad, n):
    """The pad as text: "L N", then rows of 16 symbols in groups of 4, each
    row ending in its check character. No header says what it is."""
    _check_n(n)
    if any(not 0 <= s < n for s in pad):
        raise ValueError("pad symbols are 0 to N - 1")
    lines = ["%d %d" % (len(pad), n)]
    for i in range(0, len(pad), ROW):
        row = pad[i:i + ROW]
        chars = "".join(DIGITS[s] for s in row)
        groups = [chars[j:j + GROUP] for j in range(0, len(chars), GROUP)]
        lines.append(" ".join(groups + [DIGITS[check_character(row, n)]]))
    return "\n".join(lines) + "\n"


def read_pad_file(text):
    """(pad, N) from a pad file. Raises PadFileError, with the line, for a
    wrong check character, a character out of range, a row of the wrong
    length or a count that does not match."""
    rows = []
    for number, line in enumerate(text.splitlines(), 1):
        line = line.split("#", 1)[0].strip()
        if line:
            rows.append((number, line))
    if not rows:
        raise PadFileError("empty pad file")
    number, first = rows[0]
    try:
        length, n = (int(x) for x in first.split())
    except ValueError:
        raise PadFileError("the first line is the number of symbols and N, e.g. '54 16'", number)
    if n not in (2, 4, 8, 16, 32):
        raise PadFileError("N must be 2, 4, 8, 16 or 32, not %d" % n, number)
    pad = []
    for i, (number, line) in enumerate(rows[1:]):
        groups = line.upper().split()
        if len(groups) < 2 or len(groups[-1]) != 1:
            raise PadFileError("a row ends in a space and its check character", number)
        values = []
        for ch in "".join(groups):
            v = DIGITS.find(ch)
            if not 0 <= v < n:
                raise PadFileError("%r is not a symbol for N = %d" % (ch, n), number)
            values.append(v)
        row, check = values[:-1], values[-1]
        last = i == len(rows) - 2
        if len(row) > ROW or (not last and len(row) != ROW):
            raise PadFileError("%d symbols in this row; every row but the last has %d"
                               % (len(row), ROW), number)
        if check_character(row, n) != check:
            raise PadFileError("the check character does not match: a symbol in this row "
                               "is copied wrong", number)
        pad.extend(row)
    if len(pad) != length:
        raise PadFileError("the first line says %d symbols, the rows have %d" % (length, len(pad)))
    return pad, n
