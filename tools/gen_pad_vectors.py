#!/usr/bin/env python3
"""Writes vectors/seedcraft-pad.json: the test vectors of
vectors/seedcraft-v0.json in pad mode (SPEC §10), with fixed pads.

    tools/gen_pad_vectors.py > vectors/seedcraft-pad.json

The pads are fixed so that the vectors are reproducible: SHAKE-256 of a
public label, one byte per symbol, mod N. A pad anyone can compute is no
pad at all: these are for tests only, like the seeds.
"""
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))
import seedcraft_pad as pad  # noqa: E402
import seedcraft as sc  # noqa: E402


def test_pad(length, n, label):
    """A fixed, public pad: for test vectors only, never for a seed."""
    data = hashlib.shake_256(("seedcraft test pad: " + label).encode()).digest(length)
    return [b % n for b in data]


def main():
    basic = json.loads((ROOT / "vectors" / "seedcraft-v0.json").read_text())["vectors"]
    vectors = []
    for v in basic:
        entropy = bytes.fromhex(v["entropy"])
        k, n = v["k"], v["n"]
        k_pad = test_pad(len(v["symbols"]), n, "%s, N = %d" % (v["name"], n))
        cipher, _ = pad.encode(entropy, k, pad=k_pad, padding=0)
        assert pad.decrypt(cipher, k_pad, n) == v["symbols"]
        vectors.append({
            "name": v["name"], "mnemonic": v["mnemonic"], "entropy": v["entropy"],
            "k": k, "n": n, "mask": v["mask"],
            "basic": v["symbols"], "pad": k_pad, "sequence": cipher,
            "pad_file": pad.write_pad_file(k_pad, n),
        })
    json.dump({"format": "seedcraft-pad", "version": sc.FORMAT_VERSION,
               "note": "Public test seeds and public test pads only: never use a pad from a "
                       "document. basic = the basic sequence of vectors/seedcraft-v0.json "
                       "(padding 0); sequence = (basic + pad) mod n, what is made as things; "
                       "pad_file = the pad as a text file (SPEC §10.7).",
               "vectors": vectors}, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
