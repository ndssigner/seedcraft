#!/usr/bin/env python3
"""How much does keeping the dictionary apart protect a sequence? This
recovers the seed from the sequence ALONE, without the dictionary, as anyone
who knows this specification could (SPEC §9).

    python3 tools/dictionary_attack.py

Every bit of the QR code's data modules is one bit of some object's unknown
symbol. The CompactSeedQR has parts known in advance (byte mode 0100, the
length, the terminator, the pad bytes 0xEC 0x11, the header's version 00),
and its Reed-Solomon parity is a set of linear equations over GF(2) in those
same bits. Gaussian elimination solves them: with N = 2 to 16 kinds of
objects nothing is left to guess but the mask (8 tries); with N = 32 there
are more unknowns than equations and some bits are left to brute force,
how many depending on the seed.
"""
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "reference", "python"))
import seedcraft_sequences as sc  # noqa: E402


def _equations(objects, k, nbytes, mask):
    """Rows (bitset over the unknown bits, constant) for one mask, and the
    number of unknown bits. Unknown bit o*k + j = bit j of object o's
    symbol."""
    version, size, ndata, necc = sc.LAYOUTS[nbytes]
    order = sc.data_modules_row_major(size)
    position = {m: i for i, m in enumerate(order)}
    placement = sc.data_modules_qr_order(size)  # codeword bit n -> module
    kinds = {o: j for j, o in enumerate(sorted(set(objects)))}

    def unknown(i):  # reading-order bit i -> unknown bit
        return kinds[objects[i // k]] * k + i % k

    def codeword_bit(n):  # (unknowns, constant) of codeword bit n, MSB first
        r, c = placement[n]
        return 1 << unknown(position[(r, c)]), 1 if sc.MASKS[mask](r, c) else 0

    known = "0100" + format(nbytes, "08b")
    rest = 8 * ndata - len(known) - 8 * nbytes - 4
    tail = "0000" + "".join(format(p, "08b") for p in [0xEC, 0x11] * 20)[:rest]
    rows = []
    for n, b in list(enumerate(known)) + [(len(known) + 8 * nbytes + i, b) for i, b in enumerate(tail)]:
        m, c = codeword_bit(n)
        rows.append((m, c ^ int(b)))
    ncw = ndata + necc
    for j in range(necc):  # syndrome j: sum of C_i * alpha^(j * (ncw - 1 - i)) = 0
        acc = [(0, 0)] * 8
        for i in range(ncw):
            coef = sc._EXP[(j * (ncw - 1 - i)) % 255]
            for b in range(8):  # the codeword's bit of value 1 << b
                image = sc._mul(coef, 1 << b)
                m, c = codeword_bit(8 * i + 7 - b)
                for ob in range(8):
                    if image >> ob & 1:
                        acc[ob] = (acc[ob][0] ^ m, acc[ob][1] ^ c)
        rows += acc
    for t, b in enumerate("00" + format(mask, "03b")):  # the header
        rows.append((1 << unknown(len(order) + t), int(b)))
    return rows, len(kinds) * k, kinds


def _solve(rows):
    """Gaussian elimination: {pivot bit: (row, constant)}, or None if the
    equations contradict each other."""
    pivots = {}
    for m, c in rows:
        for p, (pm, pc) in pivots.items():
            if m >> p & 1:
                m, c = m ^ pm, c ^ pc
        if not m:
            if c:
                return None
            continue
        p = m.bit_length() - 1
        for q, (qm, qc) in list(pivots.items()):
            if qm >> p & 1:
                pivots[q] = (qm ^ m, qc ^ c)
        pivots[p] = (m, c)
    return pivots


def attack(objects, k, nbytes, max_free=16):
    """(entropy, free bits per mask) from the objects alone, or (None, free
    bits) if more than max_free bits are left to brute force."""
    frees = []
    for mask in range(8):
        rows, nvar, kinds = _equations(objects, k, nbytes, mask)
        pivots = _solve(rows)
        if pivots is None:
            continue
        free = [v for v in range(nvar) if v not in pivots]
        frees.append(len(free))
        if len(free) > max_free:
            continue
        for guess in range(1 << len(free)):
            value = {v: guess >> t & 1 for t, v in enumerate(free)}
            for p, (m, c) in pivots.items():
                value[p] = c ^ sum(value[v] for v in free if m >> v & 1) % 2
            symbol = {o: sum(value[j * k + t] << (k - 1 - t) for t in range(k)) for o, j in kinds.items()}
            if len(set(symbol.values())) != len(kinds):
                continue
            try:
                return sc.decode([symbol[o] for o in objects], k)[0], frees
            except sc.DecodeError:
                pass
    return None, frees


def tries_bits(objects, k, nbytes):
    """log2 of the candidates this attack has to try: 2^(free bits) for each
    mask whose equations are consistent, added up."""
    total = 0
    for mask in range(8):
        rows, nvar, _ = _equations(objects, k, nbytes, mask)
        pivots = _solve(rows)
        if pivots is not None:
            total += 1 << (nvar - len(pivots))
    return math.log2(total)


def main():
    print("Recovering test seeds from their sequences alone (random dictionaries):\n")
    print("| Words | N | Without the method: N! orders | Knowing the method | Recovered |")
    print("| :---: | :---: | :--- | :--- | :---: |")
    for nbytes, words in ((16, 12), (32, 24)):
        for k in range(1, 6):
            n = 1 << k
            ok, worst, t0 = 0, 0, time.time()
            for trial in range(3):
                rng = random.Random(1000 * k + nbytes + trial)
                entropy = bytes(rng.randrange(256) for _ in range(nbytes))
                secret = list(range(n))
                rng.shuffle(secret)
                objects = ["object %d" % secret[s] for s in sc.encode(entropy, k)]
                got, frees = attack(objects, k, nbytes)
                ok += got == entropy
                worst = max([worst] + frees)
            tries = "at most 8 tries (%.2f s)" % ((time.time() - t0) / 3) if worst == 0 \
                else "up to 2^%d tries for these 3 seeds (see below)" % (worst + 3)
            print("| %d | %d | 2^%.0f | %s | %d/3 |" % (words, n, math.log2(math.factorial(n)), tries, ok))
    # With N = 32 the tries depend on the seed: how many kinds it uses, and
    # so how many unknowns there are. Their spread over random seeds:
    print("\nN = 32, tries over 300 random seeds (the 32 values must also all differ, so fewer):\n")
    print("| Words | Median | 1 seed in 10 above | 1 seed in 100 above | Most |")
    print("| :---: | ---: | ---: | ---: | ---: |")
    for nbytes, words in ((16, 12), (32, 24)):
        bits = []
        for trial in range(300):
            rng = random.Random("N = 32, %d, %d" % (nbytes, trial))
            entropy = bytes(rng.randrange(256) for _ in range(nbytes))
            secret = list(range(32))
            rng.shuffle(secret)
            bits.append(tries_bits(["object %d" % secret[s] for s in sc.encode(entropy, 5)], 5, nbytes))
        bits.sort()
        print("| %d | 2^%.0f | 2^%.0f | 2^%.0f | 2^%.0f |" % (words, bits[150], bits[270], bits[297], bits[-1]))


if __name__ == "__main__":
    main()
