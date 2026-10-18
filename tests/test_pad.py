#!/usr/bin/env python3
"""Tests of pad mode (SPEC §10) against vectors/seedcraft-pad.json, and the
evidence of RISK-AUDIT.md §6 that can run as tests:

    E2  the dictionary attack finds nothing on a pad-mode sequence
    E3  one wrong pad symbol is repaired
    E4  C is uniform whatever the seed (chi-squared)
    E5  a reused pad gives away the other seed once one is known
    E6  the pad file's check characters (Luhn mod N)
    E7  every one of the 8 masks gives a valid CompactSeedQR

    python3 tests/test_pad.py
"""
import json
import math
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))
sys.path.insert(0, str(ROOT / "tools"))
import dictionary_attack  # noqa: E402
import pad_reuse  # noqa: E402
import seedcraft_pad as pad  # noqa: E402
import seedcraft as sc  # noqa: E402

VECTORS = json.loads((ROOT / "vectors" / "seedcraft-pad.json").read_text())["vectors"]
failures = 0


def check(ok, what):
    global failures
    if not ok:
        failures += 1
        print("FAIL", what)


def decodes(cipher, key, k, entropy):
    try:
        return pad.decode(cipher, key, k)[0] == entropy
    except sc.DecodeError:
        return False


def test_vectors():
    rng = random.Random(2)
    for v in VECTORS:
        entropy, k, n = bytes.fromhex(v["entropy"]), v["k"], v["n"]
        name = "%s k=%d" % (v["name"], k)
        seq, key = v["sequence"], v["pad"]
        check(pad.encrypt(v["basic"], key, n) == seq, "encrypt " + name)
        check(pad.decrypt(seq, key, n) == v["basic"], "decrypt " + name)
        check(pad.encode(entropy, k, pad=key, padding=0) == (seq, key), "encode " + name)
        check(pad.decode(seq, key, k) == (entropy, 0, (0, v["mask"]), False), "decode " + name)
        # either end of either string, and the two strings swapped (§10.5)
        for c in (seq, seq[::-1]):
            for kk in (key, key[::-1]):
                check(decodes(c, kk, k, entropy), "directions " + name)
                got = pad.decode(kk, c, k)
                # with N = 2, C - K = K - C: a swap cannot be told, nor matters
                check(got[0] == entropy and got[3] == (n > 2), "swapped " + name)
        # the pad file
        check(pad.write_pad_file(key, n) == v["pad_file"], "write pad file " + name)
        check(pad.read_pad_file(v["pad_file"]) == (key, n), "read pad file " + name)
        # physical strings, each with its own dictionary (SPEC §11.4)
        d1 = ["bead %d" % i for i in range(n)]
        d2 = ["entry %d" % i for i in range(n)]
        rng.shuffle(d1)
        rng.shuffle(d2)
        got = pad.decode_objects(sc.physical_sequence(seq, d1)[::-1],
                                 sc.physical_sequence(key, d2), d1, d2)
        check(got[0] == entropy and not got[3], "objects " + name)
        # a fresh random pad, and one added to a pad made by hand (§10.2)
        c, kk = pad.encode(entropy, k)
        hand = [rng.randrange(n) for _ in kk]
        both = pad.add_pads(kk, hand, n)
        check(decodes(c, kk, k, entropy), "random pad " + name)
        check(decodes(pad.encrypt(pad.decrypt(c, kk, n), both, n), both, k, entropy),
              "device + hand pad " + name)
        # the basic sequence is not the pad-mode one (no pad: no seed)
        check(not decodes(seq, [0] * len(seq), k, entropy) or seq == v["basic"], "no pad " + name)


def test_pad_file_format():
    text = VECTORS[3]["pad_file"]  # 54 16
    key, n = pad.read_pad_file(text)
    # notes, blank lines, CRLF and lower case are fine
    loose = "# a shopping list\r\n\r\n" + text.lower().replace("\n", "  # x\r\n")
    check(pad.read_pad_file(loose) == (key, n), "pad file: notes, CRLF, lower case")
    check(pad.read_pad_file(text.replace(" ", "  ")) == (key, n), "pad file: spaces")
    lines = text.splitlines()

    def error_line(t):
        try:
            pad.read_pad_file(t)
        except pad.PadFileError as e:
            return e.line if e.line is not None else 0
        return None

    # every single wrong symbol is caught, in its line (E6, in a real file)
    for li in range(1, len(lines)):
        for pos, ch in enumerate(lines[li][:-1]):
            if ch == " ":
                continue
            for wrong in pad.DIGITS[:n]:
                if wrong != ch:
                    bad = lines[:li] + [lines[li][:pos] + wrong + lines[li][pos + 1:]] + lines[li + 1:]
                    if error_line("\n".join(bad)) != li + 1:
                        check(False, "pad file: wrong symbol line %d pos %d" % (li + 1, pos))
    check(error_line(text.replace("54 16", "53 16")) == 0, "pad file: count")
    check(error_line(text.replace("54 16", "54 12")) == 1, "pad file: N")
    check(error_line("\n".join(lines[:1] + [lines[1][:-2] + "X"] + lines[2:])) == 2, "pad file: no check")
    check(error_line("\n".join(lines[:1] + [lines[1].replace(" ", "", 1)[1:]] + lines[2:])) == 2,
          "pad file: short row")
    check(error_line("\n".join(lines[:1] + [lines[1][:-1] + "W"] + lines[2:])) == 2, "pad file: range")
    check(error_line("") == 0, "pad file: empty")


def test_e2_attack_finds_nothing():
    """E2: on a pad-mode sequence the dictionary attack's equations are
    inconsistent for all 8 masks, and it recovers nothing. On the basic
    sequence of the same seed it works (tests/test_seedcraft.py)."""
    for v in VECTORS:
        if v["k"] > 4:
            continue  # N = 32 leaves free bits even for a basic sequence (SPEC §9)
        objects = ["object %d" % ((s * 7 + 3) % v["n"]) for s in v["sequence"]]
        got, frees = dictionary_attack.attack(objects, v["k"], len(v["entropy"]) // 2)
        check(got is None and frees == [], "E2 attack on pad mode %s k=%d: %r" % (v["name"], v["k"], frees))


def test_e3_one_wrong_symbol():
    """E3: one wrong pad symbol, or one misread thing, is always repaired
    (SPEC §10.5): it changes one symbol of the basic sequence (SPEC §5).
    Every position, a random wrong value."""
    rng = random.Random(3)
    for v in VECTORS:
        entropy, k, n = bytes.fromhex(v["entropy"]), v["k"], v["n"]
        for which in ("pad", "sequence"):
            for i in range(len(v["pad"])):
                wrong = list(v[which])
                wrong[i] = (wrong[i] + rng.randrange(1, n)) % n
                c, kk = (wrong, v["pad"]) if which == "sequence" else (v["sequence"], wrong)
                check(decodes(c, kk, k, entropy), "E3 wrong %s symbol %d %s k=%d" % (which, i, v["name"], k))


def chi2_critical(df, alpha):
    """Upper alpha point of chi-squared with df degrees of freedom
    (Wilson-Hilferty; good to a few per cent, ample for alpha = 1e-6)."""
    lo, hi = 0.0, 40.0
    for _ in range(100):  # z with upper tail alpha, by bisection
        z = (lo + hi) / 2
        if 0.5 * math.erfc(z / math.sqrt(2)) > alpha:
            lo = z
        else:
            hi = z
    a = 2 / (9 * df)
    return df * (1 - a + z * math.sqrt(a)) ** 3


def chi2(counts):
    expected = sum(counts) / len(counts)
    return sum((c - expected) ** 2 / expected for c in counts)


def uniformity_failures(sequences, n, alpha=1e-6):
    """Chi-squared tests of the symbols: each position, all positions
    together, and pairs of neighbours together. Each at alpha (Bonferroni
    over the positions), so a correct generator fails about once in 10^5
    runs."""
    length = len(sequences[0])
    bad = []
    crit = chi2_critical(n - 1, alpha / length)
    for i in range(length):
        counts = [0] * n
        for s in sequences:
            counts[s[i]] += 1
        if chi2(counts) > crit:
            bad.append("position %d" % i)
    counts = [0] * n
    pairs = [0] * (n * n)
    for s in sequences:
        for i, x in enumerate(s):
            counts[x] += 1
            if i:
                pairs[s[i - 1] * n + x] += 1
    if chi2(counts) > chi2_critical(n - 1, alpha):
        bad.append("all positions")
    if chi2(pairs) > chi2_critical(n * n - 1, alpha):
        bad.append("pairs")
    return bad


def test_e4_uniform():
    """E4: over many encodings of ONE seed, C is uniform: every position,
    and pairs of neighbours (RISK-AUDIT.md §4.1). Also checks that the test
    would notice a slightly biased pad."""
    entropy = bytes.fromhex(VECTORS[0]["entropy"])
    rng = random.Random(4)
    for k in range(1, 6):
        n = 1 << k
        plains = [sc.encode(entropy, k, padding=p) for p in range(1 << (k - 1))]
        samples = 20000 if k == 4 else 6000
        seqs = []
        for _ in range(samples):
            p = rng.choice(plains)
            seqs.append(pad.encrypt(p, pad.new_pad(len(p), n), n))
        bad = uniformity_failures(seqs, n)
        check(not bad, "E4 C not uniform, N = %d: %s" % (n, bad))
    # power: a pad where 0 comes up a fifth less often than the other values
    n, length = 16, 54

    def biased():
        out = []
        while len(out) < length:
            x = pad.new_pad(1, n)[0]
            if x != 0 or rng.random() < 0.8:
                out.append(x)
        return out
    check(uniformity_failures([biased() for _ in range(20000)], n), "E4 a biased pad goes unnoticed")


def test_e5_reuse():
    """E5: two seeds with one pad, and one seed known, give the other."""
    basic = json.loads((ROOT / "vectors" / "seedcraft-v0.json").read_text())["vectors"]
    for k in range(1, 6):
        for nbytes in (16, 32):
            seeds = [bytes.fromhex(v["entropy"]) for v in basic
                     if v["k"] == k and len(v["entropy"]) == 2 * nbytes]
            e1, e2 = seeds[0], seeds[1]
            c1, shared = pad.encode(e1, k)
            c2, _ = pad.encode(e2, k, pad=shared)
            check(pad_reuse.recover_other(c1, e1, c2, k) == e2, "E5 reuse k=%d %d bytes" % (k, nbytes))


def test_e6_check_character():
    """E6: Luhn mod N catches every single wrong symbol and every swap of
    two neighbours but 0 <-> N - 1, for every even N from 2 to 32 (N = 2:
    a parity bit, no swaps). Shown exhaustively over the symbol values (the
    check is a sum, so a change is caught whatever the rest of the row), and
    by the implementation over random rows."""
    def dbl(d, n):
        return 2 * d if 2 * d < n else 2 * d - n + 1
    rng = random.Random(6)
    for n in range(2, 33, 2):
        # single errors: both weights are permutations of 0..N-1
        check(sorted(dbl(d, n) for d in range(n)) == list(range(n)), "E6 doubling N=%d" % n)
        # swaps: d -> dbl(d) - d mod N is one-to-one except at 0 and N - 1
        for a in range(n):
            for b in range(a + 1, n):
                caught = (dbl(a, n) - a - dbl(b, n) + b) % n != 0
                check(caught == ((a, b) != (0, n - 1)), "E6 swap %d %d N=%d" % (a, b, n))
        for _ in range(200):
            row = [rng.randrange(n) for _ in range(rng.randrange(2, 17))]
            c = pad.check_character(row, n)
            i = rng.randrange(len(row))
            wrong = list(row)
            wrong[i] = (wrong[i] + rng.randrange(1, n)) % n
            check(pad.check_character(wrong, n) != c, "E6 single error N=%d" % n)
            j = rng.randrange(len(row) - 1)
            sw = list(row)
            sw[j], sw[j + 1] = sw[j + 1], sw[j]
            if {row[j], row[j + 1]} != {0, n - 1} and row[j] != row[j + 1]:
                check(pad.check_character(sw, n) != c, "E6 swap N=%d" % n)
    # the example of SPEC §10.7
    example = "54 16\n3A37 DFE7 0239 3E0F 6\nA6C8 BBC2 A299 E490 2\nBBED 2CF3 DFC8 DF07 2\n413D F4 5\n"
    check(len(pad.read_pad_file(example)[0]) == 54, "E6 the example of SPEC §10.7")


def test_e7_every_mask():
    """E7: the QR code of a seed is valid with any of the 8 masks, so the
    mask carries nothing about the seed that needs keeping."""
    seen = set()
    for v in VECTORS:
        entropy, k = bytes.fromhex(v["entropy"]), v["k"]
        if (entropy, k) in seen:
            continue
        seen.add((entropy, k))
        for mask in range(8):
            symbols = sc.encode(entropy, k, padding=0, mask=mask)
            got = sc.decode(symbols, k)
            check(got == (entropy, 0, (0, mask)), "E7 mask %d %s k=%d" % (mask, v["name"], k))
            key = pad.new_pad(len(symbols), 1 << k)
            check(decodes(pad.encrypt(symbols, key, 1 << k), key, k, entropy),
                  "E7 mask %d pad mode %s k=%d" % (mask, v["name"], k))


def main():
    for test in (test_vectors, test_pad_file_format, test_e2_attack_finds_nothing,
                 test_e3_one_wrong_symbol, test_e4_uniform, test_e5_reuse,
                 test_e6_check_character, test_e7_every_mask):
        before = failures
        test()
        print("%-30s %s" % (test.__name__, "ok" if failures == before else "FAIL"))
    print("%s: %d vectors, %d failures" % ("ok" if not failures else "FAIL", len(VECTORS), failures))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
