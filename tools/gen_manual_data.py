"""Data for the printable PDFs (docs/manual/): templates, tables, worked example.

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


# Template sizes: QR version -> what uses it. Error correction level L in all
# of them, as SeedSigner makes them, so they share the format information.
# Version 3 (29x29) is only for the classic (Standard) SeedQR of 24 words.
VERSIONS = {1: 21, 2: 25, 3: 29}


def function_modules(version):
    """sc.function_modules() extended to version 3 (alignment at 22, 22)."""
    size = VERSIONS[version]
    if version < 3:
        return sc.function_modules(size)
    f = set()
    for r0, c0 in ((0, 0), (0, size - 8), (size - 8, 0)):
        f.update((r, c) for r in range(r0, r0 + 8) for c in range(c0, c0 + 8))
    for i in range(size):
        f.update({(6, i), (i, 6)})
    f.update((r, c) for r in range(20, 25) for c in range(20, 25))
    f.add((size - 8, 8))
    for i in range(9):
        f.update({(8, i), (i, 8)})
    for i in range(8):
        f.update({(8, size - 1 - i), (size - 1 - i, 8)})
    return {(r, c) for r, c in f if 0 <= r < size and 0 <= c < size}


def fixed_patterns(version, mask):
    """Rows of the template for that version and mask: '1' fixed dark, '0'
    fixed light (format information included), '.' a data module to fill in."""
    size = VERSIONS[version]
    qr = QrCode.encode_segments([QrSegment.make_bytes(bytes(16))], QrCode.Ecc.LOW,
                                minversion=version, maxversion=version, mask=mask, boostecl=False)
    func = function_modules(version)
    return ["".join(("1" if qr.get_module(c, r) else "0") if (r, c) in func else "."
                    for c in range(size)) for r in range(size)]


def main():
    templates = {}
    for version, size in VERSIONS.items():
        masks = [fixed_patterns(version, m) for m in range(8)]
        ndatamod = sum(r.count(".") for r in masks[0])
        # data modules = codewords * 8 + remainder bits (ISO/IEC 18004, level L)
        assert ndatamod == {1: 26 * 8, 2: 44 * 8 + 7, 3: 70 * 8 + 7}[version]
        counts = [row.count(".") for row in masks[0]]
        assert all([r.count(".") for r in m] == counts for m in masks)
        # the format information is the same in every size
        assert all(m[8][:9] == masks_v1[8][:9] for m, masks_v1 in zip(masks, templates.get("21", {}).get("masks", masks)))
        templates[str(size)] = {
            "version": version, "size": size,
            "data_modules": ndatamod, "row_counts": counts, "masks": masks,
            # sequence symbols (without the dictionary) for k = 1..5
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
