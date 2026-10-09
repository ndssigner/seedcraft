<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.png">
  <img src="docs/images/hero-light.png" alt="Seedcraft — a seed kept as a string of things: 16 coloured beads on a thread">
</picture>

# seedcraft

Keep a Bitcoin seed as **a sequence of things** — beads on a necklace, bricks,
cards ordered by suit, stickers in a row, books on a shelf — and read it back,
by software or **by hand** with a pencil. An open specification with
reference tools, from the [NDS-Signer](https://github.com/ndssigner/nds-signer)
project, but meant for any wallet or signer.

> ⚠️ **Draft.** The format can still change. Do not back up the seed of real
> funds with a draft format.

Its sister project, [ur-tones](https://github.com/ndssigner/ur-tones), moves
PSBTs and seeds as telephone tones.

## How it works

The seed's CompactSeedQR (SeedSigner's QR code for seeds) is read row by row
as bits; every group of bits is one of N kinds of things (16 recommended: 54
things for 12 words, 91 for 24). A **dictionary** — one thing of each kind,
in order, kept apart — says which thing is which number. Read back with the
dictionary, the sequence gives the QR code again: drawn on a template and
scanned, or decoded by software.

1. **Get the pieces**: N kinds, easy to tell apart, enough of each (the tool
   says how many).
2. **Make the dictionary first**: a little string of the N kinds, all
   different, in any order. Check that every piece is distinct, that what
   makes it distinct will last, and that the order can never change.
3. **Name it** in the tool, piece by piece (with photos), check it, save it
   apart.
4. **Make the sequence**, step by step, and read it back.

The things can be anything in any carrier, as long as the order is fixed
for ever and no piece can come off. See [SPEC-sequences.md](SPEC-sequences.md).

**What protects what.** Keeping the dictionary apart hides that the sequence
is a seed at all — it is just a necklace, or a collection. It is **not a
lock**: someone who knows this method can rebuild the dictionary from the
QR code's structure and read the seed in a fraction of a second (with 16
kinds; [SPEC §9](SPEC-sequences.md#9-security-considerations),
`tools/dictionary_attack.py`). Keep the sequence as safe as the words, and
use a BIP-39 passphrase for real protection.

## Web tool

[**ndssigner.github.io/seedcraft**](https://ndssigner.github.io/seedcraft/) —
also in each [release](https://github.com/ndssigner/seedcraft/releases), to
use offline. English and Spanish.

- **What to buy**: how many of each kind, before you start.
- **My dictionary**: name the pieces one by one — the previous and next ones
  in view, the whole dictionary below, a photo for each if you like — check
  it against the real thing, save it as a file (names, or names and photos)
  and open it another day. Or try a ready-made one.
- **Make a sequence**: step by step, forwards and backwards, a drawing, a
  list, the QR code it keeps, and a printable sheet for whoever makes it
  (shopping list without the dictionary's order, instructions, the drawing
  with boxes to tick).
- **Read a sequence**: tap the pieces in order from a selector (or type
  their names), from either end; the seed appears as soon as it is complete.

It is a single file that cannot connect anywhere: its Content-Security-Policy
forbids every network request, external script and `eval`; only its own
inline script and style run, pinned by their SHA-256. It stores nothing.
Check it with your operating system (`shasum -a 256
seedcraft-sequences.html`) against the hash published with the release;
`node web/build.mjs` rebuilds it byte for byte. **For learning and
testing**: encode real seeds on an air-gapped device.

## By hand

[`docs/seedcraft-by-hand-en.pdf`](docs/seedcraft-by-hand-en.pdf)
([español](docs/seedcraft-by-hand-es.pdf)): from a sequence to its QR code
and back with a pencil — no computer, no arithmetic. A guide, a worked
example, the number → bits and mask tables, a worksheet, and a template for
each size and mask with the fixed parts already drawn.

[`docs/seedqr-templates-en.pdf`](docs/seedqr-templates-en.pdf)
([español](docs/seedqr-templates-es.pdf)): templates to copy a SeedQR,
Standard (25 × 25, 29 × 29) or Compact (21 × 21, 25 × 25), from SeedSigner or
a compatible signer like NDS-Signer, with every fixed part already drawn.

Both are 210 × 279 mm, to print unscaled on A4 and US Letter, and are built
reproducibly with Typst from the reference implementation
(`docs/manual/build.sh`; CI checks them byte for byte).

## Download

[Releases](https://github.com/ndssigner/seedcraft/releases) have everything in
one reproducible zip: the web tool, the PDFs and the specification, with a
`SHA256SUMS`.

## In this repository

- `SPEC-sequences.md`: the specification (draft v0).
- `reference/python/seedcraft_sequences.py`: reference implementation
  (standard library only, plus Project Nayuki's QR Code generator, MIT,
  unmodified).
- `vectors/sequences-v0.json`: test vectors from public test seeds
  (`tools/gen_vectors.py`, needs `embit`).
- `tests/test_sequences.py`: every vector, a misread thing repaired, either
  end, random padding, and the dictionary attack; give it a quirc
  `qrdecode` binary to also check that the QR code drawn back is the seed's
  CompactSeedQR.
- `tools/dictionary_attack.py`: reads a seed from its sequence without the
  dictionary (SPEC §9).
- `web/`: the web tool (`web/test.mjs` checks it against the same vectors).

```bash
python3 tests/test_sequences.py          # the Python reference
node web/test.mjs                        # the JavaScript (Node.js ≥ 18)
node web/build.mjs                       # dist/seedcraft-sequences.html + its SHA-256
docs/manual/build.sh                     # the PDFs (Typst 0.15.1)
python3 tools/bundle.py v0.3.0           # the release zip
python3 tools/readme_hero.py             # this README's picture (needs Chrome)
```

## Donate

Seedcraft is free and has no funding. Donations help keep it going:

<table>
<tr><td align="center"><img src="docs/images/donate-bitcoin.png" width="180" alt="Bitcoin"><br><b>Bitcoin</b><br><code>bc1qx5snc0wlc8cg9gwxhyx27y6pkru8rnngyq7uja</code></td>
<td align="center"><img src="docs/images/donate-lightning.png" width="180" alt="Lightning"><br><b>Lightning</b><br><code>ndssigner@coinos.io</code><br><sub>LNURL (for wallets without Lightning addresses):<br><code>LNURL1DP68GURN8GHJ7CM0D9HX7UEWD9HJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHKUERNWD5KWMN9WGQ8XE42</code></sub></td></tr>
</table>

The same addresses as [NDS-Signer](https://github.com/ndssigner/nds-signer#donate).

## License

MIT, see [LICENSE](LICENSE). The QR code generator is Project Nayuki's (MIT):
its TypeScript source and the JavaScript compiled from it with TypeScript
5.6.3 are in `web/third_party/`.
