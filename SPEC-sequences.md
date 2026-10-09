# Seedcraft Sequences (draft v0)

**Status: draft for discussion.** Nothing here is final until v1, and the
encoding may still change. Do not store real funds' seeds with a draft.

A way to back up a BIP-39 seed as a **sequence of physical things** that can
be made with craft supplies, read back by software, and **reconstructed by
hand** with pencil, paper and the templates of this specification.

- **Things** can be anything, mixed freely, as long as there are N kinds that
  are told apart at a glance and that stay so: coloured beads, charms, Lego
  bricks, stickers, stamps, marks punched in metal… A kind can also be a
  *category* rather than one exact object:
  - N = 4: the four suits of a deck of cards (Spanish: oros, copas, espadas,
    bastos; French: hearts, clubs, spades, diamonds), or four materials
    (metal, plastic, glass, wood);
  - N = 8: street types in an address book of made-up contacts (street,
    avenue, square, way, road, lane, walk, boulevard), colours of things of
    any nature, figurines of a collection, authors of the books on a shelf.

  So a sequence can be in plain sight, looking like a collection.
- **The carrier** is anything that keeps the things in a fixed order **for
  ever**, with no thing able to come off: a necklace, a bracelet, a key
  ring, a stack of glued bricks, a strip of stickers on a surface, an
  engraved plate, cards kept in order… Open carriers (a stack, a strip) have
  two ends; closed ones (a necklace) mark the start with their clasp or a
  knot.
- **The dictionary** — the N kinds, one of each, in symbol order — is **kept
  apart** from the sequence (§3.6): another little string (a bracelet to
  match the necklace), a written list, photos. Without it the sequence looks
  like anything but a seed. It is not a lock, though: see §9.

The reference implementation is `reference/python/seedcraft_sequences.py`;
`vectors/sequences-v0.json` has test vectors (public test seeds only).

## 1. Idea in one paragraph

Take the seed's **CompactSeedQR** (SeedSigner's binary SeedQR format). Read
its data modules as bits, row by row, and add a short header at the end.
Group the bits into symbols of *k* bits, so there are N = 2ᵏ kinds of
things. The **dictionary** says which thing is which symbol: 0, 1, …, N − 1.
The sequence is one thing per symbol. Reading it back with the dictionary
gives the QR code's modules: fill them in on a blank template, row by row,
and scan it, or let software do it. The QR code's own error correction
repairs a misread thing.

## 2. Parameters

| | 12 words | 24 words |
| :--- | :--- | :--- |
| Entropy | 16 bytes | 32 bytes |
| CompactSeedQR | version 1, 21×21 | version 2, 25×25 |
| QR data modules (data + error correction + remainder) | 208 | 359 |
| Header | 5 bits | 5 bits |
| **Bits stored** | **213** | **364** |

Things in the sequence (the dictionary, kept apart, has N more):

| k | N | 12 words | 24 words |
| :---: | :---: | :---: | :---: |
| 1 | 2 | 213 | 364 |
| 2 | 4 | 107 | 182 |
| 3 | 8 | 71 | 122 |
| 4 | 16 | **54** | **91** |
| 5 | 32 | 43 | 73 |

Only powers of two are allowed: each thing is a whole number of bits, so the
conversion can be done by hand with a small table, without arithmetic.
N = 16 is the recommended size: short sequences, and a dictionary small
enough to make and check easily.

## 3. Encoding

1. **Entropy.** The BIP-39 entropy E (16 or 32 bytes) of the seed.
2. **QR code.** Encode E as a CompactSeedQR: byte mode, error correction
   level L, version 1 (16 bytes) or 2 (32 bytes), as in SeedSigner. The mask
   pattern M (0–7) is the one the QR standard's penalty rules choose (as
   Project Nayuki's QR Code generator does, used by the reference
   implementations).
3. **Data bits, row by row.** Read the QR code's modules row by row, top to
   bottom, each row left to right, as a person writes. **Skip the function
   patterns**: the three finder patterns with their separators (8×8 each),
   the two timing lines, the format information areas, the dark module and,
   for version 2, the alignment pattern. Dark = 1, light = 0, as drawn
   (masked), so they can be drawn or placed back directly.
4. **Header**, after the data bits, most significant bit first:
   - format version V (2 bits): 0 for this specification. 1 and 2 are
     reserved for future versions; 3 means an extended header follows
     (defined by a future version), so the field never runs out;
   - QR mask pattern M (3 bits): the mask the QR code was drawn with, so
     that a person filling in a template knows which one to take (its
     format information is already drawn on it).
5. **Symbols.** Split data bits + header into groups of k bits, most
   significant first. The bits that complete the last group are **random**
   (zeros would make the last thing easier to guess); a reader ignores them.
6. **Dictionary.** N different things, in the order of their symbols: the
   first is 0, the next 1, … the last N − 1. Make it first, apart from the
   seed (§7), and keep it apart. One dictionary serves any number of
   sequences; different sequences can have different dictionaries.
7. **Physical sequence.** One thing per symbol, in order, from the start:
   the clasp or a knot on a closed carrier, or one end of an open one.

## 4. Decoding

1. With the dictionary, map each thing to its symbol, then each symbol to k
   bits.
2. The number of things tells the size (§2: for example 54 things with
   N = 16 is 12 words, 91 is 24 words). The bits after the data modules are
   the header; the last few are padding.
3. **By hand:** take the template of that size and mask (`docs/`, §8): its
   fixed patterns and format information are already drawn; fill in the
   data modules row by row. Instead of drawing, the modules can be placed
   on a pegboard (fusible bead boards are usually 29×29 pegs) or a Lego
   baseplate with dark and light pieces. Scan the result.
4. **By software:** unmask with M, read the codewords, correct errors,
   check that the result is a CompactSeedQR (byte mode, 16 or 32 bytes).
   **The header has no error correction, so software does not trust it:**
   it tries the mask it reads first, then the other seven (only the right
   one decodes), and treats any version value as 0 while no other version
   exists.

If it is not clear which end is the start (an open carrier, or a closed
one read without its clasp), try both directions: only one gives a QR code
that decodes.

## 5. Errors

Error correction is not a design goal: a sequence does not wear out like
print, and a mistake comes from making or reading it, which the person can
check and repeat. What the QR code brings for free is enough: its
Reed-Solomon code (level L) repairs up to 3 wrong codewords in version 1
and 5 in version 2. One thing touches at most 3 (version 1) or 5 (version
2) codewords for any k, so **one misread thing is always repaired**.
(The QR standard lets readers stop at 2 and 4 codewords, so a phone
scanning a hand-made code may have less margin.)

A missing or extra thing shifts everything after it: the reading fails,
and the person checks the sequence against the list, row by row.

## 6. How many of each kind to buy

Beads and the like come in packs (often of 5 or 10). Buy **the same number
of each kind**, before the seed is chosen; a list with the exact count of
each kind would tell something about the seed, and its order should not
follow the dictionary's.

Enough for 99.9 % of seeds, with one spare (simulated with the reference
implementation), in packs of 5:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 words: of each kind | 130 | 45 | 25 | **15** | 10 |
| 24 words: of each kind | 215 | 70 | 35 | **20** | 15 |

Plus one of each for the dictionary. With the seed known, the most that any
kind is used, plus one, rounded up to a pack, is enough
(`pieces_to_buy()`).

## 7. Making one

1. **Get the pieces** (§6): N kinds, told apart at a glance.
2. **Make the dictionary first**: one of each kind, all different, in any
   order, fixed on its own carrier. It is a simple job that anyone can do,
   and it is not the seed. Before going on, check:
   - can every piece be told from the others, even in poor light?
   - will what tells them apart last? Paint fades: colour alone may not be
     enough; shape, size and material last longer;
   - is the order fixed for ever? No piece may fall off, break or swap
     places, and the carrier must not break.
3. **Name it** in the software, piece by piece in order (with photos if
   possible), and check it against the real thing piece by piece. It can be
   saved as a file (names, or names and photos) and kept apart.
4. **Make the sequence**, piece by piece, then **read it back** to check it
   gives the seed.

Someone else can make the sequence from a printed sheet that shows the
pieces in order but not the dictionary's order. **That is only safe with
someone you trust completely**: the sequence alone is the seed for anyone
who knows this method (§9).

## 8. Tables and templates

`docs/seedcraft-by-hand-en.pdf` (and `-es`) has them, generated from the
reference implementation by `tools/gen_manual_data.py`:

- symbol → bits for k = 1…5;
- the format information of level L for masks 0–7, drawn;
- a template for each size (21×21, 25×25) and mask, with every function
  pattern, the format information included, already drawn, and the number
  of data modules in each row (to check each row while filling it in);
- a worksheet and a worked example.

## 9. Security considerations

- **Whoever has the sequence and knows this method has the seed**, like a
  paper backup or a SeedQR — even without the dictionary. Keep it as safe
  as one. For real protection use a **BIP-39 passphrase**, kept elsewhere.
- **The dictionary is not a key.** Keeping it apart hides that the sequence
  is a seed at all: without it, it is a necklace or a collection, and
  someone who does not know this method sees nothing in it. But someone who
  does can rebuild the dictionary. The CompactSeedQR has parts known in
  advance (byte mode, the length, the terminator, the pad bytes, the
  header's version) and its Reed-Solomon parity is a set of linear equations
  in the very bits of the unknown things: solved together, they give the
  dictionary. `tools/dictionary_attack.py` does it:

  | N | Orders of the dictionary (N!) | Tries, knowing this method |
  | :---: | :--- | :--- |
  | 2 | 2 | ≤ 8, instantly |
  | 4 | 24 | ≤ 8, instantly |
  | 8 | 40 320 ≈ 2¹⁵ | ≤ 8, instantly |
  | 16 | 2.1 × 10¹³ ≈ 2⁴⁴ | **≤ 8: a few hundredths of a second** |
  | 32 | 2.6 × 10³⁵ ≈ 2¹¹⁸ | ≤ 2⁵⁴ ≈ 1.8 × 10¹⁶ (fewer: the 32 values must all differ) — within reach of anyone with a few GPUs |

  The same holds for 12 and 24 words. N! is what someone faces who knows
  nothing of the QR code inside; the right column is what someone who knows
  this specification faces.
- **Encode on an air-gapped device only** (e.g. NDS-Signer). The web tool is
  for learning and testing with test seeds.
- **Durability**: colours fade and look alike in poor light; strings break;
  glue gives way. Choose things that differ in shape, size or material as
  well as colour, and a carrier that lasts.

## 10. Open questions for v1

- More test vectors (other masks).
- Illustrated instructions with real beads.
