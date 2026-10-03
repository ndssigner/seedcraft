"""Data for the by-hand manual (docs/manual/): templates, tables, worked example.

    python3 tools/gen_manual_data.py > docs/manual/data.json

Everything the manual draws comes from the reference implementation, so the
templates and tables cannot drift from the specification.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "reference", "python"))
from qrcodegen import QrCode, QrSegment  # noqa: E402
import seedcraft_sequences as sc  # noqa: E402

EXAMPLE = "height demise useless trap grow lion found off key clown transfer enroll"  # NDS-Signer test seed
EXAMPLE_K = 4


def fixed_patterns(nbytes, mask):
    """Rows of the template for that size and mask: '1' fixed dark, '0' fixed
    light (format information included), '.' a data module to fill in."""
    version, size = sc.LAYOUTS[nbytes][:2]
    qr = QrCode.encode_segments([QrSegment.make_bytes(bytes(nbytes))], QrCode.Ecc.LOW,
                                minversion=version, maxversion=version, mask=mask, boostecl=False)
    func = sc.function_modules(size)
    return ["".join(("1" if qr.get_module(c, r) else "0") if (r, c) in func else "."
                    for c in range(size)) for r in range(size)]


def main():
    templates = {}
    for nbytes, (version, size, ndata, necc) in sc.LAYOUTS.items():
        masks = [fixed_patterns(nbytes, m) for m in range(8)]
        ndatamod = len(sc.data_modules_row_major(size))
        counts = [row.count(".") for row in masks[0]]
        assert sum(counts) == ndatamod and all(
            [r.count(".") for r in m] == counts for m in masks)
        templates[str(size)] = {
            "words": 12 if nbytes == 16 else 24, "version": version, "size": size,
            "data_modules": ndatamod, "row_counts": counts, "masks": masks,
            # symbols (without the dictionary) for k = 1..5
            "symbols": [-(-(ndatamod + sc.HEADER_BITS) // k) for k in range(1, 6)],
        }

    with open(os.path.join(os.path.dirname(__file__), "..", "vectors", "sequences-v0.json")) as f:
        vector = next(v for v in json.load(f)["vectors"]
                      if v["mnemonic"] == EXAMPLE and v["k"] == EXAMPLE_K and v["pin"] is None)
    entropy = bytes.fromhex(vector["entropy"])
    qr = sc.compact_seedqr(entropy)
    size = qr.get_size()
    symbols = sc.encode(entropy, EXAMPLE_K)
    bits = sc.symbols_to_bits(symbols, EXAMPLE_K)
    ndatamod = len(sc.data_modules_row_major(size))
    assert symbols == vector["symbols"] and sc.decode(symbols, EXAMPLE_K)[0] == entropy
    example = {
        "mnemonic": EXAMPLE, "k": EXAMPLE_K, "mask": qr.get_mask(), "size": size,
        "modules": ["".join("1" if qr.get_module(c, r) else "0" for c in range(size))
                    for r in range(size)],
        "symbols": symbols, "bits": "".join(map(str, bits)),
        "data_modules": ndatamod,
    }
    json.dump({"templates": templates, "example": example}, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
