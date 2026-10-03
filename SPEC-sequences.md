# Seedcraft Sequences (draft v0)

**Status: draft for discussion.** Nothing here is final until v1, and the
encoding may still change. Do not store real funds' seeds with a draft.

A way to back up a BIP-39 seed as a **sequence of physical objects** that can
be made with craft supplies, read back by software, and **reconstructed by
hand** with pencil, paper and the templates of this specification.

- **Objects** can be anything, mixed freely: coloured beads, charms, Lego
  bricks, stickers, stamps… The only requirement is N kinds that are
  distinct and recognisable. The dictionary (§3.6) gives them their meaning.
- **The carrier** is anything that keeps the objects in a fixed order: a
  necklace, a bracelet, a key ring, a stack of bricks, a strip of stamps…
  Open carriers (a stack, a strip) have two ends; closed ones (a necklace,
  a bracelet) mark the start with their clasp or a knot.

The reference implementation is `reference/python/seedcraft_sequences.py`;
`vectors/sequences-v0.json` has test vectors (public test seeds only).

## 1. Idea in one paragraph

Take the seed's **CompactSeedQR** (SeedSigner's binary SeedQR format). Read
its data modules as bits, row by row, and add a short header at the end.
Group the bits into symbols of *k* bits, so there are N = 2ᵏ kinds of
objects. String the N kinds in symbol order (the **dictionary**), then one
object per symbol. Reading the sequence back gives the QR code's modules:
fill them in on a blank template, row by row, and scan it, or let software
do it. The QR code's own error correction repairs a misread object.

## 2. Parameters

| | 12 words | 24 words |
| :--- | :--- | :--- |
| Entropy | 16 bytes | 32 bytes |
| CompactSeedQR | version 1, 21×21 | version 2, 25×25 |
| QR data modules (data + error correction + remainder) | 208 | 359 |
| Header | 5 bits | 5 bits |
| **Bits stored** | **213** | **364** |

Objects needed (symbols + dictionary):

| k | N | 12 words | 24 words |
| :---: | :---: | :--- | :--- |
| 1 | 2 | 213 + 2 = 215 | 364 + 2 = 366 |
| 2 | 4 | 107 + 4 = 111 | 182 + 4 = 186 |
| 3 | 8 | 71 + 8 = **79** | 122 + 8 = 130 |
| 4 | 16 | 54 + 16 = **70** | 91 + 16 = **107** |
| 5 | 32 | 43 + 32 = 75 | 73 + 32 = 105 |

Only powers of two are allowed: each object is a whole number of bits, so the
conversion can be done by hand with a small table, without arithmetic.

## 3. Encoding

1. **Entropy.** The BIP-39 entropy E (16 or 32 bytes) of the seed.
2. **Optional PIN obfuscation.** A PIN is one or more letters (A–Z) and
   digits (0–9), case-insensitive: it is first converted to upper case (so
   `abc12` and `ABC12` are the same PIN). With a PIN, replace E by E ⊕ K,
   where K = PBKDF2-HMAC-SHA256(password = the upper-case PIN as ASCII,
   salt = `"seedcraft/sequences/pin/v0"`, iterations = 10 000,
   length = len(E)). Whether a PIN was used is **not recorded**: the person
   who made the sequence knows. See §8.
3. **QR code.** Encode E as a CompactSeedQR: byte mode, error correction
   level L, version 1 (16 bytes) or 2 (32 bytes), as in SeedSigner. The mask
   pattern M (0–7) is the one the QR standard's penalty rules choose (as
   Project Nayuki's QR Code generator does, used by the reference
   implementations).
4. **Data bits, row by row.** Read the QR code's modules row by row, top to
   bottom, each row left to right, as a person writes. **Skip the function
   patterns**: the three finder patterns with their separators (8×8 each),
   the two timing lines, the format information areas, the dark module and,
   for version 2, the alignment pattern. Dark = 1, light = 0, as drawn
   (masked), so they can be drawn or placed back directly.
5. **Header**, after the data bits, most significant bit first:
   - format version V (2 bits): 0 for this specification. 1 and 2 are
     reserved for future versions; 3 means an extended header follows
     (defined by a future version), so the field never runs out;
   - QR mask pattern M (3 bits).
6. **Symbols.** Split data bits + header into groups of k bits, most
   significant first; pad the last group with zeros.
7. **Physical sequence.** Choose N distinct objects. The sequence is:
   **start | dictionary (the objects for symbols 0, 1, …, N−1) | the
   symbols**, where the start is the clasp or a knot on a closed carrier, or
   simply the end of an open one.

## 4. Decoding

1. Find the dictionary: the end of the sequence that starts with N objects
   all different from each other. That fixes where reading starts and in
   which direction.
2. Map each object to its symbol with the dictionary, then each symbol to k
   bits.
3. The number of bits tells the size (213 or 364 bits, plus padding: 21×21
   or 25×25). The bits after the data modules are the header.
4. **By hand:** take the blank template of that size (fixed patterns
   already drawn); draw the format information for level L and mask M
   (table in §7); fill the data modules row by row. Instead of drawing, the
   modules can be placed on a pegboard (fusible bead boards are usually
   29×29 pegs) or a Lego baseplate with dark and light pieces. Scan the
   result.
5. **By software:** unmask with M, read the codewords, correct errors,
   check that the result is a CompactSeedQR (byte mode, 16 or 32 bytes).
   **The header has no error correction, so software does not trust it:**
   it tries the mask it reads first, then the other seven (only the right
   one decodes), and treats any version value as 0 while no other version
   exists.
6. With a PIN, undo §3.2 with it.

If the dictionary end is ambiguous (the data happens to start with N
distinct symbols too), try both ends and both directions: only one reading
gives a QR code that decodes and has the right length.

## 5. Errors

Error correction is not a design goal: a sequence does not wear out like
print, and a mistake comes from making or reading it, which the person can
check and repeat. What the QR code brings for free is enough: its
Reed-Solomon code (level L) repairs up to 3 wrong codewords in version 1
and 5 in version 2. One object touches at most 3 (version 1) or 5 (version
2) codewords for any k, so **one misread object is always repaired**.
(The QR standard lets readers stop at 2 and 4 codewords, so a phone
scanning a hand-made code may have less margin.)

A missing or extra object shifts everything after it: the reading fails,
and the person checks the sequence against the list, row by row.

## 6. How many objects of each kind

The stream's composition depends on the seed. A shopping list with the
exact counts would leak a little information about it: buy the same number
of each kind, enough for any seed (the number of symbols is a safe amount).

## 7. Tables and templates (to be completed)

- Symbol → bits for k = 1…5.
- Format information bits for error correction level L and masks 0–7.
- Blank templates for 21×21 and 25×25 with the fixed patterns drawn, and
  the number of data modules in each row (to check each row while
  filling it in).

## 8. Security considerations

- **Whoever has the sequence and knows this method has the seed**, like a
  paper backup or a SeedQR. Keep it as safe as one.
- **A short PIN is obfuscation.** Four digits are 10 000 tries; with the
  seed's checksum or an address lookup an attacker checks them in seconds.
  It stops someone who does not know what they hold, not someone who does.
  Each try costs 10 000 HMAC-SHA256 iterations, so length matters: 8 letters
  and digits are 36⁸ ≈ 2.8 × 10¹² tries. A sequence kept on paper (§7's
  sheet) should have a PIN of 8 characters or more.
  Every PIN gives a valid seed, so a wrong or forgotten PIN silently gives a
  different (empty) wallet. For real protection use a BIP-39 passphrase.
- **Encode on an air-gapped device only** (e.g. NDS-Signer). The web tool is
  for learning and testing with test seeds.
- Colours fade and look alike in poor light: choose objects that differ in
  shape or size as well as colour, and that last.

## 9. Open questions for v1

- More test vectors (other masks).
