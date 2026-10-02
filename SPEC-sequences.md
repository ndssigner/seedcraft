# Seedcraft Sequences (draft v0)

**Status: draft for discussion.** Nothing here is final until v1, and the
encoding may still change. Do not store real funds' seeds with a draft.

A way to back up a BIP-39 seed as a **sequence of physical objects** that can
be made with craft supplies, read back by software, and **reconstructed by
hand** with pencil, paper and the tables in this document.

- **Objects** can be anything, mixed freely: coloured beads, charms, Lego
  bricks, stickers, stamps… The only requirement is N kinds that are
  distinct and recognisable. The dictionary (§3.7) gives them their meaning.
- **The carrier** is anything that keeps the objects in a fixed order: a
  necklace, a bracelet, a key ring, a stack of bricks, a strip of stamps…
  Open carriers (a stack, a strip) have two ends; closed ones (a necklace,
  a bracelet) mark the start with their clasp or a knot.

## 1. Idea in one paragraph

Take the seed's **CompactSeedQR** (SeedSigner's binary SeedQR format). Read
the QR code's data modules, row by row, as bits. Group the bits into symbols
of *k* bits, so there are N = 2ᵏ different symbols. Pick N different objects
and string them: first the N objects in symbol order (the **dictionary**),
then one object per symbol. Reading the sequence back gives the QR code's
modules: draw them on a blank QR template and scan it, or let software do it.
The QR code's own error correction repairs a few misread objects.

## 2. Parameters

| | 12 words | 24 words |
| :--- | :--- | :--- |
| Entropy | 16 bytes | 32 bytes |
| CompactSeedQR | version 1, 21×21 | version 2, 25×25 |
| QR data modules (data + error correction) | 208 | 359 |
| Header | 6 bits | 6 bits |
| **Bits stored** | **214** | **365** |

Objects needed (stream + dictionary):

| k | N | 12 words | 24 words |
| :---: | :---: | :--- | :--- |
| 1 | 2 | 214 + 2 = 216 | 365 + 2 = 367 |
| 2 | 4 | 107 + 4 = 111 | 183 + 4 = 187 |
| 3 | 8 | 72 + 8 = **80** | 122 + 8 = 130 |
| 4 | 16 | 54 + 16 = **70** | 92 + 16 = 108 |
| 5 | 32 | 43 + 32 = 75 | 73 + 32 = 105 |

Only powers of two are allowed: each object is a whole number of bits, so
the conversion can be done by hand with a small table, without arithmetic.

## 3. Encoding

1. **Entropy.** The BIP-39 entropy E (16 or 32 bytes) of the seed.
2. **Optional PIN obfuscation.** With a PIN (decimal digits), replace E by
   E ⊕ K, where K = PBKDF2-HMAC-SHA256(password = PIN as ASCII,
   salt = `"seedcraft/sequences/pin/v0"`, iterations = 10 000,
   length = len(E)). See §8: this is obfuscation, not protection.
3. **QR code.** Encode E as a CompactSeedQR: byte mode, error correction
   level L, version 1 (16 bytes) or 2 (32 bytes), as in SeedSigner. The mask
   pattern M (0–7) is the one the QR standard's penalty rules choose.
4. **Data bits.** Read the QR code's modules row by row, top to bottom, each
   row left to right, **skipping the function patterns**: the three finder
   patterns with their separators (8×8 each), the two timing lines, the
   format information areas, the dark module and, for version 2, the
   alignment pattern. Dark = 1, light = 0. These are the modules as drawn
   (masked), so they can be drawn back directly.
5. **Header.** 6 bits, before the data bits, most significant first:
   - format version V (2 bits): 0 for this specification. 1 and 2 are
     reserved for future versions; 3 means an extended header follows
     (defined by a future version), so the field never runs out;
   - QR mask pattern M (3 bits);
   - PIN flag (1 bit): 1 = obfuscated with a PIN.
6. **Symbols.** Concatenate header and data bits; split into groups of k bits,
   most significant first; pad the last group with zeros.
7. **Physical sequence.** Choose N distinct objects. The sequence is:
   **start | dictionary (the objects for symbols 0, 1, …, N−1) | the
   symbols**, where the start is the clasp or a knot on a closed carrier,
   or simply the end of an open one.

## 4. Decoding

1. Find the dictionary: the end of the sequence that starts with N objects
   all different from each other. That fixes where reading starts and in
   which direction.
2. Map each object to its symbol with the dictionary, then each symbol to k
   bits.
3. Header: version V (only 0 is defined), mask M and PIN flag. The number
   of symbols tells the size (214 or 365 bits, plus padding: 21×21 or
   25×25).
4. Draw: a blank template of that size with its fixed patterns; the format
   information for level L and mask M (table in §7); the data bits in the
   order of §3.4.
5. Decode the QR code (any QR reader, or the error correction by hand…
   in practice, a scanner). With the PIN flag set, undo step 3.2 with the PIN.

If the dictionary end is ambiguous (the data happens to start with N
distinct symbols too), try both ends and both directions: only one reading
gives a QR code that decodes and has the right length.

## 5. Errors

The QR code's Reed-Solomon code (level L) corrects up to 2 wrong bytes in
version 1 and 4 in version 2. One wrong object changes k bits, which touch
one or two bytes: roughly one or two misread objects can be repaired. A
missing or extra object shifts everything after it; software can try
deleting or inserting one object at each position.

## 6. How many objects of each kind

The stream's composition depends on the seed. A shopping list with the exact
counts would leak a little information about it: buy the same number of each
object, enough for any seed (the stream length is a safe amount).

## 7. Tables (to be completed)

- Symbol → bits for k = 1…5.
- Format information bits for error correction level L and masks 0–7.
- Blank templates for 21×21 and 25×25 with the data module reading order.

## 8. Security considerations

- **Whoever has the sequence and knows this method has the seed.** Like a
  paper backup or a SeedQR. Keep it as safe as one.
- **The PIN is obfuscation.** Four digits are 10 000 tries; with the seed's
  checksum or an address lookup, an attacker checks them in seconds. It
  stops someone who does not know what they hold, not someone who does. Every
  PIN gives a valid seed, so a wrong PIN silently gives a different (empty)
  wallet. For real protection use a BIP-39 passphrase.
- **Encode on an air-gapped device only** (e.g. NDS-Signer). The web tool is
  for learning and testing with test seeds.
- Colours fade and look alike in poor light: choose objects that differ in
  shape or size as well as colour, and that last.

## 9. Open questions for v1

- Mask selection: encoders choose it with the QR standard's penalty rules
  (as Project Nayuki's QR Code generator, used by the reference
  implementations); decoders accept any of the 8.
- Test vectors: the public test seeds of SeedSigner and NDS-Signer.
- Software help for a missing or extra object (§5).
