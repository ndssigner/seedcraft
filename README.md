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

## By hand

[`docs/seedcraft-by-hand-en.pdf`](docs/seedcraft-by-hand-en.pdf)
([español](docs/seedcraft-by-hand-es.pdf)): go from a sequence to its QR code,
and from a CompactSeedQR to a sequence, with a pencil — no computer, no
arithmetic. A step-by-step guide, a worked example, the number → bits and
mask tables, a worksheet, and a template for each size and mask with the
fixed parts already drawn. Page size 210 × 279 mm prints unscaled on both A4
and US Letter.

The tables and templates come from the reference implementation
(`tools/gen_manual_data.py`); `docs/manual/build.sh` rebuilds the PDFs with
Typst 0.15.1 and its bundled fonts, byte for byte (CI checks it).

## Web tool

`dist/seedcraft-sequences.html`: a single HTML file (no dependencies), in
English and Spanish, made to be understood by a child:

- **Make a sequence**, step by step: the seed, the things (ready-made sets —
  coloured beads, animal charms, charms, Lego bricks, beads + charms — or
  your own, each with an emoji, a colour and a name), then the string drawn
  as beads on a thread, a shopping list, and a *build it step by step* view.
- **A printable sheet** for whoever makes it: shopping list, simple
  instructions on one side, the drawing (with boxes to tick) on the other,
  saying nothing about what it is. It recommends a PIN, and can make one up.
- **Read a sequence** by tapping the things in order (or typing their names),
  from either end.
- Nothing is stored: closing the page forgets everything.

- **It cannot connect anywhere.** Its Content-Security-Policy forbids every
  network request, external script and `eval`; only its own inline script
  and style run (pinned by their SHA-256). It warns when the computer is
  online.
- **Check it with your operating system**, not with the page itself:
  `shasum -a 256 seedcraft-sequences.html`, against the hash published with
  the release. The file is reproducible: `node web/build.mjs` prints the
  hash of the file it builds.
- **For learning and testing only**: encode real seeds on an air-gapped
  device.

Build and test (Node.js ≥ 18):

```bash
node web/build.mjs                       # dist/seedcraft-sequences.html + its SHA-256
node web/test.mjs                        # the JavaScript against the test vectors
python3 tests/test_sequences.py          # the Python reference
```

The QR code generator is Project Nayuki's (MIT): the TypeScript source and the
JavaScript compiled from it with TypeScript 5.6.3 are in `web/third_party/`.

## Planned contents

- **Specifications** with test vectors (public test seeds only).
- **Printable PDFs** for the Tones format too.
- **Reference implementations** in JavaScript (web tool) and Python
  (MicroPython, for NDS-Signer), sharing the test vectors.

## License

MIT, see [LICENSE](LICENSE).
