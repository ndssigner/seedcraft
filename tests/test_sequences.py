#!/usr/bin/env python3
"""Tests of the reference implementation against vectors/sequences-v0.json.

    python3 tests/test_sequences.py [path to a quirc 'qrdecode' binary]

With a QR decoder, also checks that the QR code drawn back from the symbols
is the seed's CompactSeedQR as another reader sees it.
"""
import json
import pathlib
import random
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))
import seedcraft_sequences as sc  # noqa: E402

VECTORS = json.loads((ROOT / "vectors" / "sequences-v0.json").read_text())["vectors"]
failures = 0


def check(ok, what):
    global failures
    if not ok:
        failures += 1
        print("FAIL", what)


def draw_qr(symbols, k):
    """The QR code redrawn from the symbols, as a person would: fixed
    patterns, format information for level L and the mask, data modules."""
    bits = sc.symbols_to_bits(symbols, k)
    size = 21 if len(bits) < 300 else 25
    nmod = len(sc.data_modules_qr_order(size))
    mask = sc.parse_header(bits[nmod:nmod + sc.HEADER_BITS])[1]
    ref = sc.compact_seedqr(bytes(16 if size == 21 else 32))  # fixed patterns
    grid = [[ref.get_module(c, r) for c in range(size)] for r in range(size)]
    # format information for (L, mask): from a QR code with that mask
    fmt = sc.QrCode.encode_segments([sc.QrSegment.make_bytes(bytes(16 if size == 21 else 32))],
                                    sc.QrCode.Ecc.LOW, minversion=1 if size == 21 else 2,
                                    maxversion=1 if size == 21 else 2, mask=mask, boostecl=False)
    func = sc.function_modules(size)
    for r, c in func:
        grid[r][c] = fmt.get_module(c, r)
    for (r, c), b in zip(sc.data_modules_qr_order(size), bits[:nmod]):
        grid[r][c] = bool(b)
    return grid


def to_pgm(grid, scale=8, border=4):
    n = len(grid)
    w = (n + 2 * border) * scale
    rows = []
    for y in range(w):
        r = y // scale - border
        row = bytearray()
        for x in range(w):
            c = x // scale - border
            dark = 0 <= r < n and 0 <= c < n and grid[r][c]
            row.append(0 if dark else 255)
        rows.append(bytes(row))
    return b"P5 %d %d 255\n" % (w, w) + b"".join(rows)


def main():
    qrdecode = sys.argv[1] if len(sys.argv) > 1 else None
    rng = random.Random(1)
    for v in VECTORS:
        entropy = bytes.fromhex(v["entropy"])
        k, pin = v["k"], v["pin"]
        name = "%s k=%d pin=%s" % (v["name"], k, pin)
        # encoding matches the vector
        check(sc.encode(entropy, k, pin) == v["symbols"], "encode " + name)
        # decoding gives the entropy back
        got, fixed, header = sc.decode(v["symbols"], k, pin)
        check(got == entropy and fixed == 0 and header == (0, v["mask"]), "decode " + name)
        # a wrong PIN gives a different, valid-length entropy (no error)
        if pin:
            other, _, _ = sc.decode(v["symbols"], k, "9999")
            check(other != entropy and len(other) == len(entropy), "wrong PIN " + name)
        # misread objects are corrected (SPEC §5): with k = 1, 2 or 4 every
        # object lies within one codeword, so 2 misread objects are always
        # repaired; with k = 3 or 5 an object can straddle two codewords and
        # only 1 is guaranteed
        for nerr in ((1, 2) if 8 % k == 0 else (1,)):
            sym = list(v["symbols"])
            for pos in rng.sample(range(len(sym)), nerr):
                sym[pos] = (sym[pos] + rng.randrange(1, 1 << k)) % (1 << k) if k > 0 else sym[pos]
            try:
                got, fixed, _ = sc.decode(sym, k, pin)
                ok = got == entropy
            except sc.DecodeError:
                ok = False
            check(ok, "%d misread object(s) %s" % (nerr, name))
        # the physical sequence reads back from either end, in either direction
        objects = ["obj%02d" % i for i in range(1 << k)]
        rng.shuffle(objects)
        seq = sc.physical_sequence(v["symbols"], objects)
        for reading in (seq, seq[::-1]):
            got, _, _ = sc.decode_objects(reading, pin)
            check(got == entropy, "objects %s" % name)
        # drawn back by hand, the QR code is the CompactSeedQR another reader sees
        if qrdecode and pin is None:
            out = subprocess.run([qrdecode], input=to_pgm(draw_qr(v["symbols"], k)),
                                 capture_output=True).stdout
            check(out == entropy + b"\n", "redrawn QR read by quirc " + name)
    print("%s: %d vectors, %d failures" % ("ok" if not failures else "FAIL", len(VECTORS), failures))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
