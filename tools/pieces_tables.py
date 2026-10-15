#!/usr/bin/env python3
"""Reproduces the tables of how many pieces to buy (SPEC §6 and §10.6) by
simulation: random seeds (and pads), the most any kind is used, plus one
spare, at the 99.9th percentile, rounded up to packs of 5.

    python3 tools/pieces_tables.py [samples]     # default 100 000

With 100 000 samples it takes some minutes (it uses every core); a few
thousand are enough to see the shape. The seeds come from a seeded generator
so that the output is reproducible.
"""
import multiprocessing
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "reference", "python"))
import seedcraft_sequences as sc  # noqa: E402

PACK, SPARE, PERMILLE = 5, 1, 999  # packs of 5, one spare, 99.9 %
KS = range(1, 6)


def _most(symbols, other, n):
    counts = [0] * n
    for s in symbols:
        counts[s] += 1
    for s in other:
        counts[s] += 1
    return max(counts)


def _sample(args):
    """For one random seed: {(k, what): most used kind}, what being the basic
    sequence, a pad alone, or a pad-mode sequence and its pad together."""
    nbytes, index = args
    rng = random.Random("pieces %d %d" % (nbytes, index))
    entropy = bytes(rng.randrange(256) for _ in range(nbytes))
    bits = sc.symbols_to_bits(sc.encode(entropy, 1), 1)  # data + header: one QR code for every k
    out = {}
    for k in KS:
        n = 1 << k
        plain = sc.bits_to_symbols(bits + [rng.getrandbits(1) for _ in range(-len(bits) % k)], k)
        key = [rng.randrange(n) for _ in plain]
        cipher = [(p + q) % n for p, q in zip(plain, key)]
        out[k, "basic"] = _most(plain, [], n)
        out[k, "pad"] = _most(key, [], n)
        out[k, "both"] = _most(cipher, key, n)
    return out


def to_buy(mosts):
    """Enough for 99.9 % of the samples, in whole packs."""
    need = sorted(m + SPARE for m in mosts)
    q = need[-(-PERMILLE * len(need) // 1000) - 1]
    return -(-q // PACK) * PACK


def tables(samples, processes=None):
    """{(nbytes, k, what): pieces of each kind to buy}."""
    result = {}
    with multiprocessing.Pool(processes) as pool:
        for nbytes in (16, 32):
            rows = pool.map(_sample, [(nbytes, i) for i in range(samples)], chunksize=200)
            for key in rows[0]:
                result[(nbytes,) + key] = to_buy([r[key] for r in rows])
    return result


def main():
    samples = int(sys.argv[1]) if len(sys.argv) > 1 else 100000
    t = tables(samples)
    head = "| N | " + " | ".join(str(1 << k) for k in KS) + " |\n| :--- |" + " ---: |" * len(KS)
    for what, title, label in (
            ("basic", "SPEC §6: the sequence (basic mode)", "of each kind"),
            ("both", "SPEC §10.6: both strings of pad mode", "of each kind, both strings"),
            ("pad", "SPEC §10.6: one string alone (a pad, or a pad-mode sequence)", "of each kind")):
        print("%s, %d samples:\n\n%s" % (title, samples, head))
        for nbytes, words in ((16, 12), (32, 24)):
            print("| %d words: %s | %s |" % (words, label, " | ".join(
                str(t[nbytes, k, what]) for k in KS)))
        print()


if __name__ == "__main__":
    main()
