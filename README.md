<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.png">
  <img src="docs/images/hero-light.png" alt="Seedcraft — a seed kept as a string of things: 16 coloured beads on a thread">
</picture>

# seedcraft

Keep a Bitcoin seed as **a sequence of things** — beads on a necklace, glued
bricks, stickers in an album, the entries of an address book — and read it back,
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

## What protects what

There are two modes, for two kinds of risk.

**Basic.** The sequence alone is the seed. What hides it is the thing
itself: a necklace or a collection that nobody takes for a backup, as long
as the dictionary (one of each kind, in a row) is not next to it. It is
**not a lock**: someone who knows this method rebuilds the dictionary from
the QR code's structure and reads the seed in a fraction of a second (with
up to 16 kinds; [SPEC §9](SPEC-sequences.md#9-security-considerations),
`tools/dictionary_attack.py`). For a backup in a place you control: keep it
as safe as the words, and use a BIP-39 passphrase for real protection.

**Pad.** For places you do not control: travel, hotels, inspections. A
random pad is added to the sequence, number by number, and kept somewhere
else, as a second string or a text file. Then the sequence alone, or the
pad alone, says nothing about the seed, whoever has it; only both together
give it ([SPEC §10](SPEC-sequences.md#10-pad-mode)). The price: **losing
either half loses the seed.** It is in the reference implementation and
the web tool; the PDFs do not have it yet.

[SPEC §11](SPEC-sequences.md#11-choosing-a-mode-and-a-form) helps choose a
mode and a form, and says what not to do. [RISK-AUDIT.md](RISK-AUDIT.md)
sets out what each mode protects against and what it does not, with the
evidence.

## Web tool

[**ndssigner.github.io/seedcraft**](https://ndssigner.github.io/seedcraft/) —
also in each [release](https://github.com/ndssigner/seedcraft/releases), to
use offline. English and Spanish.

Two journeys, each a sequence of steps along a thread:

- **Back up a seed**: plan, one question at a time, with drawings (the
  mode, with what each one protects; the form, from those of [SPEC
  §11.2](SPEC-sequences.md#112-which-form) that keep their order, the
  others shown only as what to avoid; the number of words and of kinds),
  get the pieces (how many of each kind, and what else the form needs),
  the dictionary (name the pieces one by one, with a photo if you like,
  check it against the real thing, save it as a file; or a ready-made one,
  or the address book's conventional order), the key (pad mode only: made
  first, piece by piece, by chance), the sequence (turn by turn, each piece
  from the QR code's squares; a drawing in the form's shape, a list, the QR
  code it keeps, and a printable sheet for whoever makes it), check (read
  it all back: it must give the same seed) and store (what goes where).
- **Recover a seed**: what you have (mode, form, dictionary and, in pad
  mode, how the key is kept: a sequence with its collection, or a file),
  recover (turn by turn: tap each piece in order from either end, or type
  its name, with the key's piece taken off on the clock; each one paints
  its squares of the QR code) and the seed.

In pad mode, which the page calls "with a key" (a lock and its key: plainer
than "pad"), the page makes the key first, piece by piece, by chance: from your own bag,
coins or dice, or from the device (for learning only). Then it shows the
way turn by turn: each piece of the sequence comes from the QR code's squares,
plus the key's piece on the clock of N; recovering and checking read it back
the same way. The key is kept as a second sequence of things (the same
kinds, or another collection with its own dictionary, SPEC §11.4) or as a
text file. The printable sheet shows only the sequence: in this mode whoever
makes it learns nothing. In the basic mode that sheet is the seed for
anyone who knows this method: only for someone you trust completely.

Every seed the page shows comes with its fingerprint (BIP-32, with no
passphrase), the eight characters wallets show, to check the words without
reading them out. It is computed in the page itself: SHA-512, PBKDF2,
RIPEMD-160 and secp256k1 in plain JavaScript, checked against Node's
crypto by `web/test.mjs`.

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
one reproducible zip: the web tool, the PDFs and the specification (and,
from the next release on, the risk audit), with a `SHA256SUMS`.

## In this repository

- `SPEC-sequences.md`: the specification (draft): the basic mode and the
  pad mode.
- `RISK-AUDIT.md`: what each mode protects against, and the evidence.
- `reference/python/seedcraft_sequences.py`: reference implementation
  (standard library only, plus Project Nayuki's QR Code generator, MIT,
  unmodified); `seedcraft_pad.py`: pad mode, on top of it.
- `vectors/sequences-v0.json`: test vectors from public test seeds
  (`tools/gen_vectors.py`, needs `embit`); `vectors/sequences-pad.json`:
  the same seeds in pad mode, with fixed public pads
  (`tools/gen_pad_vectors.py`).
- `tests/test_sequences.py`: every vector, a misread thing repaired, either
  end, random padding, and the dictionary attack; give it a quirc
  `qrdecode` binary to also check that the QR code drawn back is the seed's
  CompactSeedQR.
- `tests/test_pad.py`: pad mode against its vectors, and the evidence of
  `RISK-AUDIT.md` §6 (the attack finds nothing, errors repaired, uniformity,
  check characters, every mask).
- `tools/dictionary_attack.py`: reads a seed from its sequence without the
  dictionary (SPEC §9).
- `tools/pad_reuse.py`: why one pad is for one seed only.
- `tools/pieces_tables.py`: how many pieces to buy (SPEC §6, §10.6), by
  simulation.
- `web/`: the web tool (`web/test.mjs` checks it against the same vectors).

```bash
python3 tests/test_sequences.py          # the Python reference
python3 tests/test_pad.py                # pad mode and the audit's evidence
node web/test.mjs                        # the JavaScript (Node.js ≥ 18)
node web/build.mjs                       # dist/seedcraft-sequences.html + its SHA-256
docs/manual/build.sh                     # the PDFs (Typst 0.15.1)
python3 tools/bundle.py vX.Y.Z           # the release zip
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
