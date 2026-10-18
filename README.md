English · [Español](README.es.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.png">
  <img src="docs/images/hero-light.png" alt="SeedCraft — a seed kept as a string of things: 16 coloured beads on a thread">
</picture>

# SeedCraft

SeedCraft keeps the 12 or 24 words of a Bitcoin seed as the order of some
objects: beads on a necklace, bricks, stickers, photos… and reads that order
back into words, with the web tool or **by hand** with a pencil. An open
specification with reference tools, from the
[NDS-Signer](https://github.com/ndssigner/nds-signer) project, but meant for
any wallet or signer.

## Why: it goes unnoticed

Next to a copy in words or as a QR code, which anyone recognises as a seed,
a string done well looks like a necklace, an album or a shelf. If it is done
well: choose a form that makes sense where you keep it.

## What they look like

Three sample strings, all made with the same **public test seed** of 12
words. Never keep a seed with funds this way without changing it: these
photos show every piece, in order.

<table>
<tr>
<td width="50%"><img src="docs/images/samples/sd16-small-string.jpg" width="100%" alt="A long and a short bead string lying on graph paper, made of green, blue, wood-coloured, yellow and brown beads of several shapes."></td>
<td width="50%"><img src="docs/images/samples/sd16-small-pieces.jpg" width="100%" alt="Sixteen different beads, numbered 0 to 15 by hand in red, one per square of a grid drawn on graph paper."></td>
</tr>
<tr><td colspan="2"><b>Without a key, N = 16, glass and wooden beads.</b> The
necklace is the seed: 54 beads. The bracelet is its dictionary, the 16 kinds
in order, kept apart. Right: the same 16 kinds, numbered 0 to 15.</td></tr>
<tr>
<td width="50%"><img src="docs/images/samples/sd16-wood-string.jpg" width="100%" alt="A long and a short string of mostly wooden beads, brown, black, cream and a few bright ones, on a brown cord over graph paper."></td>
<td width="50%"><img src="docs/images/samples/sd16-wood-pieces.jpg" width="100%" alt="Sixteen numbered wooden beads laid out on a drawn grid, next to a short beaded cord with a knot."></td>
</tr>
<tr><td colspan="2"><b>Without a key, N = 16, wooden beads on a cord.</b> The
long string is the seed: 54 beads. The short one, knotted, is its
dictionary. Right: the 16 kinds, numbered 0 to 15, next to it.</td></tr>
<tr>
<td width="50%"><img src="docs/images/samples/skd8-strings.jpg" width="100%" alt="Two long blue-and-wooden bead necklaces and a small ring with metal clasps, laid in loops on graph paper."></td>
<td width="50%"><img src="docs/images/samples/skd8-pieces.jpg" width="100%" alt="Top view of an egg carton used as a bead box: eight cups hold a different bead type each, the rest are empty."></td>
</tr>
<tr><td colspan="2"><b>With a key, N = 8.</b> Two necklaces of 71 beads
each: the seed plus the key, and the key. The small ring is the dictionary
they share, the 8 kinds in order. Right: the box of pieces: an egg
carton, one kind per cup.</td></tr>
</table>

## Two modes

- **Without a key.** One string. Keep it as you keep the copies of a seed:
  it is the seed. What hides it is the thing itself, as long as the
  dictionary is not next to it; it is **not a lock**: someone who knows this
  method reads the seed from the string alone in a fraction of a second
  ([SPEC §9](SPEC.md#9-security-considerations),
  `tools/dictionary_attack.py`). For a backup in a place you control; add a
  BIP-39 passphrase for real protection.
- **With a key.** Two strings (or a string and a file), kept apart. Either
  one alone says nothing about the seed; both are needed to rebuild it. For
  places you do not control: travel, hotels, inspections. The price:
  **losing either half loses the seed.** The specification calls it pad
  mode ([SPEC §10](SPEC.md#10-pad-mode)).

[SPEC §11](SPEC.md#11-choosing-a-mode-and-a-form) helps choose a
mode and a form, and says what not to do. [RISK-AUDIT.md](RISK-AUDIT.md),
the threat model, sets out what each mode protects against and what it does
not, with the evidence.

## How it works

The seed's CompactSeedQR (SeedSigner's QR code for seeds) is read row by row
as bits; every group of bits is one of N kinds of things (16 recommended: 54
things for 12 words, 91 for 24). A **dictionary** — one thing of each kind,
in order, kept apart — says which thing is which number. Read back with the
dictionary, the sequence gives the QR code again: drawn on a template and
scanned, or decoded by software. With a key, a random number is added to
each piece, on a clock of N, before it is made.

The things can be anything in any carrier, as long as the order is fixed
for ever and no piece can come off. See [SPEC.md](SPEC.md).

## By hand, or with the tool

It can be done by hand: with the documentation, a pencil, and squared paper
to paint the QR code. You don't even need a calculator.

- [`docs/seedcraft-by-hand-en.pdf`](docs/seedcraft-by-hand-en.pdf)
  ([español](docs/seedcraft-by-hand-es.pdf)): from a sequence to its QR
  code and back with a pencil. A guide, a worked example, the number → bits
  and mask tables, a worksheet, and a template for each size and mask with
  the fixed parts already drawn; and, for the key, how to make it with dice,
  the addition tables, the key file and a worked example.
- [`docs/seedqr-templates-en.pdf`](docs/seedqr-templates-en.pdf)
  ([español](docs/seedqr-templates-es.pdf)): templates to copy a SeedQR,
  Standard (25 × 25, 29 × 29) or Compact (21 × 21, 25 × 25), from SeedSigner
  or a compatible signer like NDS-Signer, with every fixed part already
  drawn.

Both are 210 × 279 mm, to print unscaled on A4 and US Letter, and are built
reproducibly with Typst from the reference implementation
(`docs/manual/build.sh`; CI checks them byte for byte).

**The web tool** is an optional, educational aid:
[**ndssigner.github.io/seedcraft**](https://ndssigner.github.io/seedcraft/),
also in each [release](https://github.com/ndssigner/seedcraft/releases) to
use on an offline computer. English and Spanish. It walks through both
journeys, one question per slide: **back up a seed** (the mode, the form,
the pieces, the dictionary, the key, the sequence turn by turn, checking it
and storing it) and **recover a seed** (each piece in order, painting its
squares of the QR code). Every seed it shows comes with its fingerprint
(BIP-32, with no passphrase), to check the words without reading them out.

It is a single file that cannot connect anywhere: its Content-Security-Policy
forbids every network request, external script and `eval`; only its own
inline script and style run, pinned by their SHA-256. It stores nothing.
Check it with your operating system (`shasum -a 256
seedcraft.html`) against the hash published with the release;
`node web/build.mjs` rebuilds it byte for byte. The page cannot connect, but
the rest of an online computer can see what is typed in it: on a computer
that is online, use test seeds only.

## Slowly and calmly

Making the string properly takes time and concentration. Give it what it
needs: an offline computer (or pencil and paper), time, calm and the pieces
at hand. Read it all back before you trust it.

## Notice

SeedCraft is a mathematics exercise with a creative and artistic spirit, and
it is offered as is, without any warranty. No one independent has audited it
yet. If you use it with a real seed, do so on an offline computer and at
your own risk. We are not liable for any loss of funds or any other harm,
nor for the use anyone makes of this tool or of this method.

While you use it, let no one see your screen: it shows seeds and QR codes
that a camera can capture from afar.

## In this repository

The repository holds the documentation that matters: the threat model, the
mathematical development of the system and the code, open for anyone to
review.

- [`SPEC.md`](SPEC.md): the specification, format
  version 0: the mode without a key and pad mode (with a key).
- [`RISK-AUDIT.md`](RISK-AUDIT.md): the threat model: what each mode
  protects against, and the evidence.
- `reference/python/seedcraft.py`: reference implementation
  (standard library only, plus Project Nayuki's QR Code generator, MIT,
  unmodified); `seedcraft_pad.py`: pad mode, on top of it.
- `vectors/seedcraft-v0.json`: test vectors from public test seeds
  (`tools/gen_vectors.py`, needs `embit`); `vectors/seedcraft-pad.json`:
  the same seeds in pad mode, with fixed public pads
  (`tools/gen_pad_vectors.py`).
- `tests/test_seedcraft.py`: every vector, a misread thing repaired, either
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
- `docs/images/samples/`: the sample photos above, without metadata.

```bash
python3 tests/test_seedcraft.py          # the Python reference
python3 tests/test_pad.py                # pad mode and the audit's evidence
node web/test.mjs                        # the JavaScript (Node.js ≥ 18)
node web/build.mjs                       # dist/seedcraft.html + its SHA-256
docs/manual/build.sh                     # the PDFs (Typst 0.15.1)
python3 tools/bundle.py vX.Y.Z           # the release zip
python3 tools/readme_hero.py             # this README's picture (needs Chrome)
```

## Download

[Releases](https://github.com/ndssigner/seedcraft/releases) have everything in
one reproducible zip: the web tool, the PDFs and the specification (and,
from the next release on, the risk audit), with a `SHA256SUMS`.

## Sister projects

- [NDS-Signer](https://github.com/ndssigner/nds-signer): an air-gapped
  signer for the Nintendo DSi, signing PSBTs from QR codes or tones.
- [ur-tones](https://github.com/ndssigner/ur-tones): PSBTs and seeds as
  telephone tones, by cable or through the air.

## Donate

SeedCraft is free and has no funding. Donations help keep it going:

<table>
<tr><td align="center"><img src="docs/images/donate-bitcoin.png" width="180" alt="Bitcoin"><br><b>Bitcoin</b><br><code>bc1qx5snc0wlc8cg9gwxhyx27y6pkru8rnngyq7uja</code></td>
<td align="center"><img src="docs/images/donate-lightning.png" width="180" alt="Lightning"><br><b>Lightning</b><br><code>ndssigner@coinos.io</code><br><sub>LNURL (for wallets without Lightning addresses):<br><code>LNURL1DP68GURN8GHJ7CM0D9HX7UEWD9HJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHKUERNWD5KWMN9WGQ8XE42</code></sub></td></tr>
</table>

The same addresses as [NDS-Signer](https://github.com/ndssigner/nds-signer#donate).

## License

MIT, see [LICENSE](LICENSE). The QR code generator is Project Nayuki's (MIT):
its TypeScript source and the JavaScript compiled from it with TypeScript
5.6.3 are in `web/third_party/`.
