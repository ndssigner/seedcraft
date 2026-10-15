#!/usr/bin/env python3
"""Why one pad is for one seed only (SPEC §10.8, RISK-AUDIT.md §4.3): two
seeds encoded with the same pad, and one of them known, give away the other.

    python3 tools/pad_reuse.py

C1 - C2 = (P1 + K) - (P2 + K) = P1 - P2 (mod N), so P2 = C2 - C1 + P1, and
the pad is not even needed: K = C1 - P1. Public test seeds only.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))
import seedcraft_pad as pad  # noqa: E402
import seedcraft_sequences as sc  # noqa: E402


def recover_other(c1, entropy1, c2, k):
    """The second seed's entropy, from both pad-mode sequences and the first
    seed. The padding bits of P1 are not known, so each value of them is
    tried (they are at most k - 1 bits of the last symbol)."""
    n = 1 << k
    for padding in range(1 << (k - 1)):
        p1 = sc.encode(entropy1, k, padding=padding)
        if len(p1) != len(c1):
            raise ValueError("the two sequences are not of the same size")
        key = pad.decrypt(c1, p1, n)  # the reused pad itself
        try:
            return sc.decode(pad.decrypt(c2, key, n), k)[0]
        except sc.DecodeError:
            continue
    return None


def main():
    vectors = json.loads((ROOT / "vectors" / "sequences-v0.json").read_text())["vectors"]
    k = 4
    seeds = [v for v in vectors if v["k"] == k and len(v["entropy"]) == 64]
    a, b = seeds[0], seeds[1]
    e1, e2 = bytes.fromhex(a["entropy"]), bytes.fromhex(b["entropy"])
    shared = pad.new_pad(len(a["symbols"]), 1 << k)
    c1, _ = pad.encode(e1, k, pad=shared)
    c2, _ = pad.encode(e2, k, pad=shared)
    print("Two 24-word test seeds, N = 16, ONE pad for both (never do this).")
    print("The adversary has both sequences and learns the first seed:")
    print("  ", a["mnemonic"])
    got = recover_other(c1, e1, c2, k)
    print("and so has the second at once, without the pad:")
    print("  ", b["mnemonic"] if got == e2 else "(not recovered: a bug)")
    sys.exit(0 if got == e2 else 1)


if __name__ == "__main__":
    main()
