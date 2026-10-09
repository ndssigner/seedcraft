#!/usr/bin/env python3
"""Writes vectors/sequences-v0.json: public test seeds encoded as Seedcraft
Sequences for every alphabet size, with and without a PIN. Needs embit
(mnemonic -> entropy); the reference implementation itself does not.

    tools/gen_vectors.py > vectors/sequences-v0.json
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "reference" / "python"))
from embit import bip39  # noqa: E402

import seedcraft_sequences as sc  # noqa: E402

# Public test seeds ONLY: NDS-Signer's test seed and SeedSigner's SeedQR test
# vectors (docs/seed_qr/README.md). Never put a real seed here.
SEEDS = [
    ("NDS-Signer test seed", "height demise useless trap grow lion found off key clown transfer enroll"),
    ("SeedSigner SeedQR test vector 4", "forum undo fragile fade shy sign arrest garment culture tube off merit"),
    ("SeedSigner SeedQR test vector 5", "good battle boil exact add seed angle hurry success glad carbon whisper"),
    ("SeedSigner SeedQR test vector 1", "attack pizza motion avocado network gather crop fresh patrol unusual wild "
     "holiday candy pony ranch winter theme error hybrid van cereal salon goddess expire"),
    ("SeedSigner SeedQR test vector 3", "sound federal bonus bleak light raise false engage round stock update "
     "render quote truck quality fringe palace foot recipe labor glow tortoise potato still"),
]


def main():
    vectors = []
    for name, mnemonic in SEEDS:
        entropy = bip39.mnemonic_to_bytes(mnemonic)
        for k in range(1, 6):
            # padding 0: the bits that complete the last symbol are random in
            # use (SPEC §3.5), fixed here so that the vectors are reproducible
            symbols = sc.encode(entropy, k, padding=0)
            vectors.append({
                "name": name, "mnemonic": mnemonic, "entropy": entropy.hex(),
                "k": k, "n": 1 << k, "mask": sc.compact_seedqr(entropy).get_mask(),
                "symbols": symbols,
            })
    json.dump({"format": "seedcraft-sequences", "version": sc.FORMAT_VERSION,
               "note": "Public test seeds only. Symbols = data + header + padding (0 here, "
                       "random in use), in reading order. The dictionary is kept apart.",
               "vectors": vectors}, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
