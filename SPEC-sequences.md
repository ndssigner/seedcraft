# Seedcraft Sequences (draft)

**Status: draft for discussion.** Nothing here is final until v1, and the
encoding may still change. Do not store real funds' seeds with a draft.
The pad mode (§10) is in the reference implementation, its test vectors
and the web tool, not yet in the PDFs.

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

There are **two modes**, for two kinds of risk:

- **Basic** (§1–§9): the sequence alone is the seed. It looks like
  anything but a seed, so it is a better hiding place than words on paper
  or metal, but someone who knows this method can read it in a fraction of
  a second (§9). For a backup kept in a place you control, as safe as the
  words themselves; add a BIP-39 passphrase for real protection.
- **Pad** (§10): the basic sequence plus a random **pad**, symbol by symbol.
  The sequence alone, or the pad alone, says **nothing** about the seed,
  whatever the computing power and knowledge of whoever has it; only both
  together give it. For places you do not control: travel, hotels,
  inspections. The price: two things to keep apart, and losing either
  loses the seed.

Which mode and which form suit which situation: §11. `RISK-AUDIT.md` sets
out what each mode protects against and what it does not, with the
evidence, so that anyone can check it.

The reference implementation is `reference/python/seedcraft_sequences.py`,
and `seedcraft_pad.py` for pad mode; `vectors/sequences-v0.json` and
`vectors/sequences-pad.json` have test vectors (public test seeds and pads
only).

## 1. Idea in one paragraph

Take the seed's **CompactSeedQR** (SeedSigner's binary SeedQR format). Read
its data modules as bits, row by row, and add a short header at the end.
Group the bits into symbols of *k* bits, so there are N = 2ᵏ kinds of
things. The **dictionary** says which thing is which symbol: 0, 1, …, N − 1.
The sequence is one thing per symbol. Reading it back with the dictionary
gives the QR code's modules: fill them in on a blank template, row by row,
and scan it, or let software do it. The QR code's own error correction
repairs a misread thing. In pad mode (§10) each symbol of that same
sequence has a random number added to it (mod N), and the person subtracts
it again before anything else.

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
   The header comes after the data, so the mask is only known from the
   last things of the sequence (the last 2 for N = 16 and 32, and for
   N = 8 with 12 words; the last 3 for N = 8 with 24 words and for N = 4;
   the last 5 for N = 2): to pick the template before drawing, read those
   first. The
   data modules are in the same places in all eight templates of a size;
   the mask changes only the format information.
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
implementation, `tools/pieces_tables.py`), in packs of 5:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 words: of each kind | 130 | 45 | 25 | **15** | 10 |
| 24 words: of each kind | 215 | 70 | 35 | **20** | 15 |

Plus one of each for the dictionary. With the seed known, the most that any
kind is used, plus one, rounded up to a pack, is enough
(`pieces_to_buy()`). For pad mode, see §10.6.

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

In pad mode, make the pad first, then the sequence, and check both
together before storing them apart (§10.4).

## 8. Tables and templates

`docs/seedcraft-by-hand-en.pdf` (and `-es`) has them, generated from the
reference implementation by `tools/gen_manual_data.py`:

- symbol → bits for k = 1…5;
- the format information of level L for masks 0–7, drawn;
- a template for each size (21×21, 25×25) and mask, with every function
  pattern, the format information included, already drawn, and the number
  of data modules in each row (to check each row while filling it in);
- a worksheet and a worked example.

For pad mode (§10) they will also need, not yet in the PDFs: the
subtraction table, a table to work out the pad file's check characters,
and a sheet to write a pad on.

## 9. Security considerations

This section is about the basic mode; for pad mode see §10.
`RISK-AUDIT.md` covers both in detail.

- **Whoever has the sequence and knows this method has the seed**, like a
  paper backup or a SeedQR — even without the dictionary. Keep it as safe
  as one. For real protection use a **BIP-39 passphrase**, kept elsewhere.
- **The dictionary is not a key.** Keeping it apart hides that the sequence
  is a seed at all: without it, it is a necklace or a collection, and
  someone who does not know this method sees nothing in it. But someone who
  does can rebuild the dictionary. The CompactSeedQR has parts known in
  advance (byte mode, the length, the terminator, the pad byte of 12-word
  codes, the header's version) and its Reed-Solomon parity is a set of
  linear equations in the very bits of the unknown things: solved together,
  they give the dictionary. `tools/dictionary_attack.py` does it:

  | N | Orders of the dictionary (N!) | Tries, knowing this method |
  | :---: | :--- | :--- |
  | 2 | 2 | ≤ 8, instantly |
  | 4 | 24 | ≤ 8, instantly |
  | 8 | 40 320 ≈ 2¹⁵ | ≤ 8, instantly |
  | 16 | 2.1 × 10¹³ ≈ 2⁴⁴ | **≤ 8: a few hundredths of a second** |
  | 32 | 2.6 × 10³⁵ ≈ 2¹¹⁸ | Depends on the seed: half of all seeds under 2³⁸ (12 words) or 2⁴⁷ (24 words), one in a hundred over 2⁵⁸ or 2⁶². Each try takes microseconds: half of all seeds are within reach of a few GPUs |

  For N ≤ 16 the same holds for 12 and 24 words. N! is what someone faces
  who knows nothing of the QR code inside; the right column is what someone
  who knows this specification faces.
- **Encode on an air-gapped device only** (e.g. NDS-Signer). The web tool is
  for learning and testing with test seeds.
- **Durability**: colours fade and look alike in poor light; strings break;
  glue gives way. Choose things that differ in shape, size or material as
  well as colour, and a carrier that lasts.


## 10. Pad mode

### 10.1 Idea

In the basic mode, the sequence itself is the seed. In pad mode it is not:
a random number is added to each number of the basic sequence, and the
results are what is made as a sequence of things. Those random numbers, one
for each thing, are the **pad**, and they are kept somewhere else: as a
second string of things, or written in a file.

**The sequence alone is useless**: without the pad it could be any seed at
all, even for someone who knows this method and has all the computers in
the world. **The pad alone is useless too.** Together they give the seed.

To read it back, subtract the pad from the sequence, number by number.
What is left is a basic sequence, read as in §4.

This holds as long as the pad is pure chance, is kept secret and is used
for one seed only: `RISK-AUDIT.md` has the proof, and what happens when
one of those fails.

(This pad has nothing to do with the QR code's pad bytes of §9.)

### 10.2 Making the pad

The pad has as many numbers as the sequence has things (§2: 54 for 12
words with N = 16, 91 for 24 words), each from 0 to N − 1. Its safety
rests on one thing: **every number must be pure chance**, with every value
just as likely.

- The **encoding device** (e.g. NDS-Signer) draws it.
- If you like, add to it a pad made by hand, number by number, as in §10.3:
  the result is safe as long as either of the two is. By hand, with any of
  these:
  - **coins**: 4 tosses per number for N = 16, heads 1 and tails 0, read as
    in the table of §8;
  - **a die with N faces** (16 for N = 16; the face 16 counts as 0);
  - **a bag** with one piece of each kind: take one without looking, note
    it, **put it back** and shake the bag. If the pieces are not put back,
    it is not chance.
- **Never** numbers chosen by a person, nor taken from the seed, a
  password, a date or anything else.
- **One pad for one seed** (§10.8).

### 10.3 Adding and subtracting

- **To make the sequence**: for each thing, the number of the basic
  sequence plus the number of the pad. If the result is N or more,
  subtract N.
- **To read it back**: the number of the sequence minus the number of the
  pad. If the result is below 0, add N.

With N = 16: 9 + 12 = 21, which gives 21 − 16 = **5**. Back: 5 − 12 = −7,
which gives −7 + 16 = **9**. The PDF will have a table, so that no
arithmetic is needed (§8).

### 10.4 Making one

1. Get the pieces (§10.6) and make the dictionary (§7).
2. Make the pad (§10.2), as a string or as a file.
3. Make the sequence piece by piece, as the software says.
4. Read both back with the software and check that they give the seed.
5. Store them apart (§10.8), each with a copy of the dictionary.

Someone else can make the sequence for you from the printed sheet (§7): in
this mode they learn nothing, as long as they never see the pad.

### 10.5 Reading one

1. Read the sequence with the dictionary, number by number, and the pad,
   from its string or its file.
2. Subtract (§10.3).
3. Go on as with a basic sequence (§4). By hand, the mask for the template
   is in the last numbers (§4.3): subtract those first.

The software finds the start of each, and notices if the two strings have
been swapped. By hand you have to know: **mark the start of each, and
which is which** (a clasp, a pendant on the sequence and none on the pad, a
label).

A misread thing or a wrong number in the pad is repaired, as in the basic
mode (§5).

### 10.6 The pad as a string of things

The pad can be a second string, made like the first, with the same
dictionary. Both look alike: two strings of beads in no particular order,
and neither says which is which.

The dictionary is still no secret, but both strings need it to be read:
**keep a copy with each one**. Without it neither can be read by hand. It
can go at the start of the pad's string (one of each kind, then the pad),
which saves a third object; but N different pieces in a row is an unusual
pattern, which marks the string as something (not the seed).

**How many to buy.** For both strings from the same kinds of pieces,
enough for 99.9 % of pads with one spare, in packs of 5:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 words: of each kind, both strings | 250 | 80 | 35 | **20** | 15 |
| 24 words: of each kind, both strings | 410 | 125 | 55 | **30** | 20 |

Plus one of each kind for each copy of the dictionary. For one string
alone, the table of §6 holds (except N = 2 and 12 words: 135).

### 10.7 The pad as a file

A text file that a person can read and the web tool can open:

    54 16
    3A37 DFE7 0239 3E0F 6
    A6C8 BBC2 A299 E490 2
    BBED 2CF3 DFC8 DF07 2
    413D F4 5

(An example only. **Never use a pad taken from a document.**)

- **First line**: how many numbers there are, and N.
- **Then the pad**: 16 numbers per row, in groups of 4, each written as one
  character: `0` to `9`, then `A` for 10, `B` for 11, and so on (up to `V`
  for 31).
- **The last character of each row is a check.** If a number is copied
  wrong, the check of its row no longer matches, and the software says
  which row. It comes from the pad alone and says nothing about the seed.
- **The file does not say what it is.** A file called "seed" on a phone
  that gets searched gives itself away. Lines that start with `#` are
  notes, if you want any.

**How to keep, send or encrypt it is up to you.** Alone it is harmless;
but a copy that ends up near the sequence, or within reach of whoever has
it, is the seed. `RISK-AUDIT.md` goes through the cases.

### 10.8 Rules

1. **One pad, one seed.** A pad used for two seeds gives each away as soon
   as the other is known. Copies of the same sequence can share its pad.
2. **Never together**: not in the same place, on the same device, in the
   same cloud account, on the same journey.
3. **Losing either loses the seed**, for good. Keep copies of each if you
   need them, every copy as far from the other half as the original.
4. **A copy of the dictionary with each.**
5. **Check both together before storing them apart.**
6. The web tool makes pads **for learning and testing only**; for real
   funds, an air-gapped device (§9).

### 10.9 For implementers

- **Encoding.** P: the symbols of the basic sequence (§3, all of them:
  data, header with version 0, padding bits). K: the pad, L symbols from
  a cryptographic random number generator, optionally added mod N to a
  pad made by hand. C[i] = (P[i] + K[i]) mod N. Decoding: P[i] = (C[i] −
  K[i]) mod N.
- **Decoding software** tries C and C reversed against K, and both roles
  (C − K and K − C), and decodes each result as in §4, in both directions;
  only the right one decodes.
- **Pad file.** ASCII, lines ending in LF or CRLF. Empty lines and
  everything from `#` to the end of a line are ignored. First line: L and
  N in decimal. Then rows of 16 symbols (the last one with the rest), one
  character each, `0`–`9` `A`–`V`, case-insensitive; spaces between groups
  are ignored. The last group of a row is its check character.
- **Check character** (Luhn mod N): from the row's last symbol leftwards,
  weights 2, 1, 2, 1… Doubling d gives 2d if 2d < N, else 2d − N + 1. The
  check is (N − (sum mod N)) mod N. It catches every single wrong symbol
  and every swap of two neighbours except 0 and N − 1; for N = 2 it is a
  parity bit and catches no swaps.
- **Pieces to buy**: simulated over 100 000 random pads per entry
  (`tools/pieces_tables.py`).

## 11. Choosing a mode and a form

Two questions decide it:

1. **Who could come across it, and would they know what to look for?**
2. **What would hurt more: someone finding it, or you losing it?**

### 11.1 Which mode

| Where it is, who can reach it | Mode |
| :--- | :--- |
| At home or in a place you control, among things that belong there: a book on a shelf, a box of stickers, a jewellery box | **Basic**. Like a paper backup, but far better hidden. A BIP-39 passphrase if the funds matter |
| Carried on you, or where others go through your things: travel, hotels, a shared flat, an inspection | **Pad**, with the other half somewhere else, never on the same journey |
| Losing it worries you more than theft: a single backup, a long time, heirs | **Basic** with copies, and a passphrase. Pad mode doubles what can be lost |
| Large amounts | **Pad**, or a passphrase, or both. Seedcraft can also keep one of the keys of a multisig wallet |

The basic mode is enough **as long as nobody who knows this method has a
reason to look at that thing**. Its strength is that nobody looks: the
better the disguise, the more it is worth. Once someone suspects, it is the
seed (§9). The pad mode does not depend on that.

### 11.2 Which form

A good form is one that **belongs where it is kept**, **keeps its order
for ever**, and has kinds that **cannot be confused**. Lengths for 12 words
(24 words in brackets), the same in both modes (§2):

| Form | N | Things | Blends in | Keeps its order | Notes |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Address book**, the kind of street of each entry | 8 | 71 (122) | Very well, on a shelf or in a drawer | Yes, if handwritten and never rewritten | See §11.3 |
| **Sticker album or strip** | 8–16 | 71–54 (122–91) | Very well, among children's things | Yes, if glued | Fades in the sun |
| **Necklace or bracelet** of beads | 16 | 54 (91) | Well, and it can be worn | Yes, on wire or strong cord, with a clasp marking the start | Strings break: check it now and then |
| **Gemstones**, in a multi-strand bracelet or a box with compartments | 8–16 | 71–54 | Well, as a collection or jewellery | Only if strung or glued | Natural stones vary in colour: choose kinds that differ in more than colour |
| **Glued Lego bricks** | 8–16 | 71–54 | As a toy | Yes | Very durable |
| **Books on a shelf**, by author | 8 | 71 (122) | Perfectly | **No**: anyone tidying the shelf destroys it | Not for the only copy |
| **Playing cards**, by suit | 4 | 107 (182): four decks (six), as one suit can come up far more often than the others (§6) | Perfectly | **No**: one game destroys it | Not for the only copy |

### 11.3 The address book

An address book is perhaps the best disguise: it is meant to be full of
entries, to sit on a shelf for years, and to be of no interest to anyone.

- **The kinds** are the street types (with N = 8: avenue, boulevard, lane,
  road, square, street, walk, way). Every entry has exactly one, written
  out in full.
- **The dictionary** can simply be a **fixed, conventional order**, such as
  the alphabetical order of the street types above. It is no secret in
  either mode (§9, §10.6), so it does not need keeping anywhere, and it
  cannot be lost. Write down which order you used, where you keep your
  notes on the backup.
- **The order of the entries** is the reading order. In a handwritten book
  with tabs A–Z, read the A tab from the top, then B, and so on: give each
  entry a name with the right initial to put it where it has to go.
- **Never add, remove or rewrite an entry** in the middle. A book that is
  never updated is itself a little odd: keep it as an old one, put away.
- **Real-looking, rather than real.** Shops, restaurants, offices and other
  public places of a real city make entries that are plausible, can be
  checked on a map, and give the right street types where you need them.
  The private addresses of real people would draw them into it, if the
  book were ever examined.

### 11.4 Two collections in pad mode

In pad mode, the two halves can be **two different collections**, each in
the place where it belongs: an address book on a shelf at home and a
necklace you travel with, for example.

- **The same N and the same number of things in both** (§2): an address
  book with N = 8 goes with a necklace of 8 kinds of beads, 71 things each
  for 12 words (71 beads of 6 mm make about 43 cm).
- **Each half with its own dictionary**: the conventional order of §11.3
  for the address book, a little matching string or a list for the
  necklace. Neither is a secret.
- **Decide once which one is the pad**, and note it with the dictionaries.
  Two different collections are hard to swap by mistake, and software
  tries both roles anyway (§10.5).
- **Never together**: the necklace does not travel with the address book,
  nor with a photo of it (§10.8).

### 11.5 What not to do

There are as many forms as there are collections, and imagination is
welcome. But some ideas look clever and are not:

- **A pad from anything that already exists.** A book, a poem, a song, a
  date, a phone number, a pattern you like, a password, a piece of the
  seed: any of these can be guessed, and each guess is checked in an
  instant (`RISK-AUDIT.md` §4.6). A pad is pure chance, nothing else
  (§10.2).
- **Improvements of your own**: an extra shuffle, a secret order, a cipher
  of your own on top. They add nothing that the pad does not already give,
  and they are the most likely reason why the seed cannot be read back
  later, by you, by the software or by your heirs.
- **Counting on a secret dictionary.** In the basic mode it hides what the
  sequence is, but it is not a lock (§9).
- **Things that can change their order**: loose things (books, cards,
  stones in a bag), things other people use or tidy, things that are kept
  up to date. Not for the only copy.
- **Kinds that can be confused**, now or in twenty years: close shades,
  colours that fade, natural variation, anything that depends on the light.
- **Adding or removing things to disguise it.** A sequence has exactly the
  number of things of §2; one more or one less and it does not read.
  (Decorative pieces that a reader skips are an open question: §12.)
- **Something only you can read**: a form of your own, notes in a code of
  your own, an app or a phone that may not be there tomorrow.
- **Something odd where it is kept**: a necklace in a toolbox, a children's
  sticker album in a house with no children.
- **Both halves together**, even as photos on the same phone (§10.8).
- **Leaving no trace for your heirs.** They need to know that the thing is
  a backup, where the other half is, and where to find this specification.

When in doubt, three questions: **will it keep its order for ever? Could
someone else tell every kind apart, in poor light, in twenty years? Would
anyone find it odd where it is?**

## 12. Open questions for v1

- More test vectors (other masks).
- Pad mode in the PDFs.
- Free decorative pieces outside the dictionary, to break the signature of
  a fixed length and N kinds (`RISK-AUDIT.md` §5).
- Illustrated instructions with real beads.
