# Seedcraft Tones (draft v0)

**Status: draft for discussion.** Nothing here is final until v1, and the
encoding may still change. Do not store real funds' seeds with a draft.

A way to move Bitcoin data — PSBTs, seeds, xpubs, descriptors — as **DTMF
tones**, the sounds of a telephone keypad: through an audio cable, or through
the air, between devices that share no network, no camera and no storage. And
to keep a seed as a sound recording, or **key it in by hand** on any phone.

- **Data mode** carries [UR](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md)
  parts, the same ones that animated QR codes carry, in frames with
  Reed-Solomon error correction. Any software that speaks UR only needs the
  sound layer.
- **Keypad mode** carries a seed as the digits of a Standard SeedQR, between
  `*` and `#`, with the 12 keys that every telephone has.

The reference implementation is `reference/python/seedcraft_tones.py`;
`vectors/tones-v0.json` has test vectors (public test seeds and PSBTs only).

## 1. Tones

The 16 DTMF tones of ITU-T Q.23: each is the sum of one low and one high
frequency (Hz):

| | 1209 | 1336 | 1477 | 1633 |
| ---: | :---: | :---: | :---: | :---: |
| **697** | `1` | `2` | `3` | `A` |
| **770** | `4` | `5` | `6` | `B` |
| **852** | `7` | `8` | `9` | `C` |
| **941** | `*` | `0` | `#` | `D` |

In data mode each tone is a **nibble** (4 bits): `0`–`9` are 0–9, `A`–`D`
are 10–13, `*` is 14 and `#` is 15 — hexadecimal, with `*#` for E and F.
Bytes are sent high nibble first.

### 1.1 Timing

- A tone lasts **at least 40 ms**, and is followed by **at least 40 ms** of
  silence (a tone repeated twice is two tones with a silence between them).
- The receiver finds where each tone starts and ends, so the sender chooses
  the pace within those limits — a person pressing keys works too.
- Recommended, data mode: **50 ms tone + 50 ms silence by cable** (10 tones
  per second, 5 bytes per second); **80 ms + 80 ms through the air**.
- Data mode only: the silences **inside a frame** are at most 150 ms; frames
  are separated by **at least 300 ms** of silence (recommended 400 ms by
  cable, 600 ms through the air).

### 1.2 Levels and sampling

Any sample rate of 8000 Hz or more. Each frequency at about −10 dBFS, the
high one 2 dB louder than the low one (it is attenuated more on the way). A
receiver should accept frequencies within ±1.5 % and a level difference
between the two of up to 8 dB. Appendix A describes a receiver.

## 2. Data mode

### 2.1 Frame

After at least 300 ms of silence:

    A D | codeword (2 tones per byte) | silence

`A D` is the **sync**: a keypad cannot send it, so a receiver tells the
modes apart by the first tone. The **codeword** is a shortened Reed-Solomon
codeword over GF(256) with 10 parity bytes at the end, the same code as QR
codes (primitive polynomial x⁸ + x⁴ + x³ + x² + 1, generator with roots
α⁰ … α⁹). It repairs **5 wrong bytes**, that is, at least 5 misheard tones,
anywhere in the frame. Its data bytes are:

| Bytes | Field |
| :--- | :--- |
| 1 | format version (high nibble): 0; kind (low nibble): 0 = a single-part UR, 1 = a part of a multi-part UR |
| 1 | UR type code (§2.2) |
| 1 | body length L (1–255) |
| (1 + n) | only with type code 0: the type's length n and its n ASCII characters |
| L | body |

The codeword is at most 255 bytes, so a body has at most 242 bytes (less
with a named type). A frame with an odd number of tones, a length that does
not add up, or more errors than the code repairs is discarded; in a
multi-part message the next frames make up for it (§2.3).

### 2.2 UR types

| Code | Type | Code | Type |
| :---: | :--- | :---: | :--- |
| 0 | named in the frame | 6 | `account-descriptor` |
| 1 | `crypto-psbt` | 7 | `crypto-output` |
| 2 | `psbt` | 8 | `output-descriptor` |
| 3 | `crypto-seed` | 9 | `bytes` |
| 4 | `seed` | 10 | `crypto-hdkey` |
| 5 | `crypto-account` | 11 | `hdkey` |

Codes 12–255 are reserved. Any other type goes by name (code 0).

### 2.3 Body: the UR, without bytewords

The body is the binary content that the UR's bytewords would spell, without
the bytewords' CRC-32:

- **kind 0**: the message's CBOR (the UR `ur:<type>/<bytewords>`).
- **kind 1**: the part's CBOR, `[seqNum, seqLen, messageLen, checksum,
  fragment]` (the UR `ur:<type>/<seqNum>-<seqLen>/<bytewords>`).

So a receiver rebuilds the exact UR text — `ur:`, the type, the sequence
numbers read from the part's CBOR, and the body in minimal bytewords with
its CRC-32 — and hands it to any UR decoder. Messages too big for one frame
are sent as multi-part URs, with UR's fountain codes: the sender plays parts
in a loop, mixed parts included, until the receiver has enough; a lost frame
costs one frame, not the whole message. Recommended fragment length: 100
bytes (about 25 s per frame by cable).

A seed goes as `crypto-seed` or `seed`.

## 3. Keypad mode

For a seed, with the 12 keys of any telephone:

    * | the seed's Standard SeedQR digits | #

The digits are those of a [Standard SeedQR](https://github.com/SeedSigner/seedsigner/blob/dev/docs/seed_qr/README.md):
each word's index in the BIP-39 English list (0–2047), in four digits, so 48
digits for 12 words and 96 for 24. A person can key them from the word list
and its numbers, on a phone, onto an answering machine or a voice recorder,
at any pace.

There is no error correction: the BIP-39 checksum catches most mistakes. Send
it two or three times; a receiver compares the copies.

## 4. PIN

Optional, for seeds, in either mode: exactly as Seedcraft Sequences §3.2
(letters and digits, case-insensitive; entropy ⊕ PBKDF2-HMAC-SHA256 with
salt `"seedcraft/sequences/pin/v0"`, 10 000 iterations), so the same PIN gives
the same result in both specifications. In keypad mode the words are then
recomputed from the new entropy, checksum included. Whether a PIN was used is
not recorded; a wrong PIN gives a different, valid (empty) wallet. See
Sequences §8 for what a PIN does and does not protect.

## 5. Cables

By cable, nothing else can hear the tones and the levels are steady. The
cable carries analogue sound in one direction and nothing else; one cable per
direction.

- **Headphone output → line input** (computers, recorders, USB sound
  adapters): a 3.5 mm stereo cable, **TRS male to TRS male**.
- **Headphone output → a phone's or laptop's headset socket** (one socket for
  headphones and microphone, **TRRS**, usually the CTIA wiring): the
  microphone is on the second ring. Use a **headset splitter** (TRRS male to
  two TRS female, headphones and microphone) with a TRS–TRS cable into its
  microphone socket, or a **TRS-to-TRRS microphone cable** made for phones.
  Some phones only accept a microphone that looks like one (about 1–2 kΩ):
  splitters and cables made for external microphones handle this; plain
  cables may not.
- **Simplest and most reliable receiver: a USB sound adapter** with separate
  headphone and microphone sockets (a few euros), with a TRS–TRS cable.
- **Levels:** a headphone output is much louder than a microphone input
  expects. Start with the sender's volume low (20–30 %) and raise it until
  the receiver hears clean tones; or use an **attenuating cable** (−20 to
  −40 dB), sold for recording from line outputs into microphone inputs.
- **Hum:** prefer devices on battery. Two devices plugged into the mains and
  joined by a cable can hum (a ground loop).
- **Nintendo DSi** (NDS-Signer): headphone output and microphone through its
  3.5 mm socket. Which wiring and levels work is to be tested on hardware.

Through the air, the phone's or computer's microphone in front of the
speaker, in a quiet room: it works, slower (§1.1). **Never send a seed
through the air**: any microphone in the room — a phone, a smart speaker, a
laptop — can record it.

## 6. Security considerations

- **A recording of a seed is the seed**, like a paper backup: whoever finds
  it, has it. Never keep it as a voice note on a phone: they are synchronised
  to the cloud. Use a recorder, a cassette or a card that stays offline.
- **Seeds only by cable**, or by keypad into a device that is offline.
- A PSBT does not give access to funds, but it does tell about them: amounts,
  addresses, change.
- Tones are not authenticated: the signer must show what it signs, as with
  QR codes.
- The receiver accepts only well-formed frames; a UR decoder must still check
  what it gets, as with QR codes.

## 7. Open questions for v1

- The DSi's socket: wiring, levels, and whether its microphone input works
  through the socket.
- Faster modulations (beyond DTMF) as an optional mode, for large PSBTs.
- Frame length versus error rate through the air: measurements.

## Appendix A. A receiver (informative)

1. Cut the audio in blocks of about 10 ms (for example 205 samples at
   8000 Hz) and measure the eight frequencies with the Goertzel algorithm.
2. A block holds a tone when the strongest low and the strongest high
   frequency are both well above the others in their group (for example
   6 dB), their sum is most of the block's energy, and their difference is
   within 8 dB.
3. A tone is the same key in at least 2 consecutive blocks; silence is at
   least 2 blocks without a tone. Short glitches are ignored.
4. Group the tones by the silences between them (§1.1): a group that starts
   with `A D` is a data frame; one that starts with `*` is keypad mode and
   ends at `#`, whatever the silences.
