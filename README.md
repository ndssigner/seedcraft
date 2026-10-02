# seedcraft

Open specifications, with reference tools, for moving Bitcoin seeds and
transactions through **things you can make or hear**: sequences of craft
objects (beads, charms…) and audio tones. From the
[NDS-Signer](https://github.com/ndssigner/nds-signer) project, but meant for
any wallet or signer to implement.

> ⚠️ **Drafts.** The formats can still change. Do not back up the seed of real
> funds with a draft format.

## Specifications

| | Status |
| :--- | :--- |
| [Sequences](SPEC-sequences.md): a seed as a sequence of N kinds of objects, via its CompactSeedQR; reconstructible by hand | Draft v0 |
| Tones: UR parts (PSBTs, seeds, xpubs) over DTMF, with framing and error correction | Planned |

## In this repository

- `SPEC-sequences.md`: the Sequences specification (draft v0).
- `reference/python/`: reference implementation (standard library only,
  plus Project Nayuki's QR Code generator, MIT, unmodified).
- `vectors/sequences-v0.json`: test vectors from public test seeds
  (`tools/gen_vectors.py` regenerates them; needs `embit`).
- `tests/test_sequences.py`: encodes and decodes every vector, repairs
  misread objects, reads sequences from either end. Run it with
  `python3 tests/test_sequences.py`; give it a quirc `qrdecode` binary to
  also check that the QR code drawn back from a sequence is the seed's
  CompactSeedQR.

## Planned contents

- **Specifications** with test vectors (public test seeds only).
- **A single-file web tool** (one HTML file, no dependencies) to try the
  formats offline. It cannot make network connections (Content-Security-
  Policy), warns when the computer seems online, and is for learning and
  testing: real seeds are encoded on an air-gapped device. Its SHA-256 is
  published and the file is reproducible from this repository; check it
  with your operating system's tools, as a page cannot vouch for itself.
- **Printable PDFs**: how each format works, how to reconstruct a seed by
  hand (templates and tables), worked examples. Built with Typst,
  reproducibly.
- **Reference implementations** in JavaScript (web tool) and Python
  (MicroPython, for NDS-Signer), sharing the test vectors.

## License

MIT, see [LICENSE](LICENSE).
