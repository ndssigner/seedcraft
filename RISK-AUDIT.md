English · [Español](RISK-AUDIT.es.md)

# SeedCraft Sequences: risk audit

What each mode of [SPEC-sequences.md](SPEC-sequences.md) protects against,
what it does not, and the evidence for each claim, so that anyone can check
it rather than take it on trust. It covers format version 0 of the
specification. **Nobody independent has audited it yet**: this document is
written so that someone can.

**Notice.** SeedCraft is a mathematics exercise with a creative and artistic
spirit, and it is offered as is, without any warranty. No one independent
has audited it yet. If you use it with a real seed, do so on an offline
computer and at your own risk. We are not liable for any loss of funds or
any other harm, nor for the use anyone makes of this tool or of this
method. While you use it, let no one see your screen: it shows seeds and QR
codes that a camera can capture from afar.

On a computer that is online, use test seeds only: the web tool cannot
connect anywhere, but the rest of the computer can see what is typed in it.

**Status of the evidence.** Each claim below points to its evidence (§6),
in the repository: tests and tools that anyone can run, and that run in CI.
Pad mode (the web tool's **key mode**; the pad is its **key**) is in the
reference implementation (`seedcraft_pad.py`), its test vectors and the web
tool (`web/test.mjs` checks it against the same vectors), and by hand in
`docs/seedcraft-by-hand-en.pdf` (and `-es`).

## 1. Scope and assumptions

- **The method is public.** This specification, its code and this document
  are published. Nothing here relies on an attacker not knowing how
  SeedCraft works.
- **What is protected**: a BIP-39 seed of 12 or 24 words, kept as a
  sequence of things (SPEC §1–§9, the *basic mode*) or as a sequence of
  things plus a random pad (SPEC §10, the *pad mode*).
- **The seed is encoded on a trusted device that is offline**: an
  air-gapped device, or the web tool on a computer with its network off. A
  device that sees the seed while encoding it can leak it: no mode can help
  against that (§3, A5). The web tool cannot connect anywhere, but the rest
  of an online computer (malware, browser extensions, sync, backups) can
  see what is typed in it: on a computer that is online, test seeds only.
- **"Says nothing"** in this document means it in the information-theoretic
  sense: whoever has that object, whatever their computing power and
  knowledge, sees every seed as equally likely as before (§4.1).

## 2. Assets

| Asset | Basic mode | Pad mode |
| :--- | :--- | :--- |
| The sequence | **is the seed**, for anyone who knows the method | says nothing on its own |
| The pad (a string or a text file) | — | says nothing on its own |
| The dictionary | not a secret; hides what the sequence is | not a secret; needed to read either string (a pad file has its own fixed dictionary, number → character) |
| A BIP-39 passphrase, if used | the only real protection of the funds | a third factor, for whoever gets both halves |
| The encoding device | sees the seed | sees the seed and the pad |

## 3. Adversaries and outcomes

| | Adversary | Basic mode | Pad mode |
| :--- | :--- | :--- | :--- |
| A1 | **Finds it by chance**, does not know the method | Sees jewellery, a collection | Same |
| A2 | **Knows the method and has the sequence** (an inspection, hotel staff, a burglar) | **Reads the seed** in under a second, without the dictionary (§4.2) | **Learns nothing**, and cannot even tell that it is a seed (§4.1, §5) |
| A3 | **Coerces whoever carries it** | Does not need the carrier: see A2. With a passphrase, the carrier can give a decoy one | The carrier **cannot** unlock it without the pad, which is elsewhere. Coercion moves to where the pad is; it does not stop the carrier being held |
| A4 | **Reaches digital copies** (cloud, email, a searched phone) | A photo of the sequence is the seed | The pad file alone says nothing. **The pad file and the sequence in reach of the same adversary are the seed**, e.g. the file on the phone of whoever wears the bracelet at a border (§4.4) |
| A5 | **Controls the encoding device** | Has the seed | Has the seed. Out of scope: use a device that is offline |
| A6 | **Time and accident** (loss, fire, decay, a broken string) | One thing to keep (and the dictionary) | Two things to keep apart, and the dictionary; **losing either half loses the seed** (§4.5) |
| A7 | **Gets both halves** (one place where both end up, or two thefts) | — | Has the seed. Only a passphrase still protects the funds |
| A8 | **Makes the sequence for you** from a printed sheet (SPEC §7) | Has the seed | Sees only C: learns nothing, as long as they never see the pad |
| A9 | **Sees the screen while the copy is made or read** (someone nearby, a camera from afar) | Has the seed: the screen shows the words and the QR code | Has the seed: making or reading a copy, the screen shows the words and the QR code in this mode too. Let no one see the screen |

## 4. Claims

### 4.1 Pad mode: one half says nothing

Let $P \in \mathbb{Z}_N^L$ be the basic sequence of the seed ($L$ symbols,
each from $0$ to $N - 1$), with any distribution: it has a known structure
(the QR code's fixed parts, its Reed-Solomon parity), and that does not
matter. Let $K$ be uniform on $\mathbb{Z}_N^L$ and independent of $P$, and
let $C = P + K$, symbol by symbol, mod $N$. Then, for every $c$ and $p$:

$$\Pr[C = c \mid P = p] = \Pr[K = c - p] = N^{-L}$$

which does not depend on $p$. So $\Pr[C = c] = N^{-L}$ and

$$\Pr[P = p \mid C = c] = \frac{\Pr[C = c \mid P = p]\,\Pr[P = p]}{\Pr[C = c]} = \Pr[P = p]$$

that is, $C$ and $P$ are independent: $I(P; C) = 0$. Any function $f(C)$
(the things, read with any dictionary) is independent of $P$ as well. $K$
alone is independent of $P$ by construction.

This holds **only if**:

1. $K$ is uniform: every symbol equally likely, independent of the others;
2. $K$ is independent of the seed and of anything the adversary has;
3. $K$ is used for one seed only (§4.3);
4. the adversary does not have, or get later, both $C$ and $K$ (or enough of
   each, §4.4).

It does not depend on the adversary's computing power, on the dictionary
being secret, or on the method being unknown.

Evidence: E2, E4 (§6).

### 4.2 Basic mode: knowing the method is enough

The dictionary of a basic sequence is not a key. For 12 words, the
CompactSeedQR has 24 bits known in advance (byte mode, length, terminator,
pad byte 0xEC), its Reed-Solomon parity gives 56 linear equations over
$\mathrm{GF}(2)$ in the same bits, and the header has 5 more. With $N = 16$
that makes $24 + 56 + 5 = 85$ equations in $16 \times 4 = 64$ unknowns (4
bits for each kind). For 24 words there is no pad byte, but more parity:
$16 + 80 + 5 = 101$ equations in the same 64 unknowns. Solving them gives
the dictionary, and trying the 8 masks does the rest.
`tools/dictionary_attack.py` does it in hundredths of a second, for 12 and
24 words and every $N \le 16$.

For $N = 32$ there are up to $32 \times 5 = 160$ unknowns, more than the
equations, and how many candidates are left depends on the seed (on how
many of the 32 kinds it uses). Over 300 random seeds, the median is $2^{38}$
for 12 words and $2^{47}$ for 24; one seed in a hundred leaves more than
$2^{58}$ and $2^{62}$. Each candidate is checked in microseconds, with no
PBKDF2 (§4.6): half of all seeds are within reach of a few GPUs, and
$N = 32$ is not a lock either.

So **a basic sequence is the seed** for anyone who has it and knows this
method, as words on paper are. It is a better hiding place, not a lock. Its
protection is a BIP-39 passphrase:

| Passphrase | Bits | Whole space, 1 GPU | Whole space, 1 000 GPUs |
| :--- | ---: | ---: | ---: |
| 8 random characters (a–z, A–Z, 0–9) | 47.6 | ~7 years | ~2.5 days |
| 4 Diceware words | 51.7 | ~116 years | ~42 days |
| 12 random characters | 71.5 | $\sim 10^8$ years | $\sim 10^5$ years |
| 6 Diceware words | 77.5 | $\sim 7 \times 10^9$ years | $\sim 7 \times 10^6$ years |

Bits: $b = n \log_2 62$ for $n$ random characters, $b = n \log_2 7776$ for
$n$ Diceware words. Time to try them all, with $G$ GPUs at $r$ candidates
per second each:

$$t = \frac{2^{b}}{r \, G}$$

and half of that on average. **Assumed rate: $r = 10^6$ candidates per
second per GPU**, an upper-end estimate: each candidate costs
PBKDF2-HMAC-SHA512 with 2048 iterations ($\approx 4096$ SHA-512
compressions), and a high-end GPU does in the order of $10^9$ to $10^{10}$
of those per second; the key derivation and address check that follow are
ignored, in the attacker's favour. Put in your own rate.

Evidence: E1.

### 4.3 Pad mode: a pad used twice

Two seeds with the same pad give

$$C_1 - C_2 \equiv (P_1 + K) - (P_2 + K) \equiv P_1 - P_2 \pmod{N}$$

symbol by symbol. If one seed is ever
known, the other follows at once. If neither is, the difference of two
structured sequences still leaks a lot, and we have **not** quantified how
much: assume both are lost. Copies of one seed can share a pad (their
sequences are then identical) or each have their own; this is safe.

Evidence: E5.

### 4.4 Pad mode: partial and digital copies

- **A partial copy counts as a full one.** Part of $C$ with all of $K$
  gives that part of $P$; the QR code's error correction can then fill in
  up to 7 missing codewords (12 words; 10 for 24 words), and its fixed parts
  help further. Treat a photo of part of the sequence, or a pad file with a few
  rows missing, as the whole thing.
- **A digital pad is harmless alone, but it lasts.** Email, cloud sync,
  backups and messaging servers keep copies for years, beyond the user's
  control, for as long as the funds stay on that seed. An adversary who gets
  such a copy now only needs to see the sequence once, later. How the file
  is stored, sent and encrypted is up to the user (SPEC §10.7); the safe
  rules are: never in reach of any device that travels with the sequence;
  better sent to someone else, or to storage at the destination, than to
  oneself; encrypted with a password; and, after a journey, a fresh pad
  made at the destination.

### 4.5 Pad mode: losing a half

Losing the sequence or the pad loses the seed, with no way back. Losing
every copy of the dictionary, with both halves still there, is not quite
final: the $N!$ orders ($16! \approx 2^{44}$) can be tried by computer, with
the QR code as an instant check of each, which is within reach of a GPU. But that
is a rescue, not a plan. Copies reduce these risks; each copy has to be as
far from the other half as the original.
A 2-of-3 scheme (any two of three parts give the seed) is possible with
additions alone, at twice the length, and is not in the specification
(§8).

### 4.6 Pad mode: a weak pad

A pad that is not uniform (chosen by a person, from a predictable source,
from a die that is biased or read carelessly, or drawn from a bag without
putting the pieces back) breaks §4.1. And it breaks it badly: **the basic
sequence underneath is its own perfect check** (a wrong guess of the pad
gives a QR code that does not decode, in microseconds, with no PBKDF2), so
an adversary who can guess the pad with probability $q$ gets the seed with
probability $q$, at almost no cost per guess. Hence the rules of SPEC
§10.2: a pad comes from a cryptographic generator, or from a fair physical
source read by its rule (a bag with every piece put back, coins, a die with
the faces above the largest power of two thrown again), or from the two
added. A die's rule keeps $2^b$ faces of equal chance and throws the rest
again, so every number from 0 to $N - 1$ is equally likely from a fair die
of any common kind. The sum of two pads is uniform if either part is,
provided the two are made independently: if $K_d$ is uniform and $K_h$ independent of it, with any
distribution, then for every $x \in \mathbb{Z}_N^L$

$$\Pr[K_d + K_h = x] = \sum_{y} \Pr[K_h = y] \, \Pr[K_d = x - y] = N^{-L} \sum_{y} \Pr[K_h = y] = N^{-L}$$

### 4.7 Errors

- **Basic and pad mode**: one misread thing, or one wrong pad symbol,
  changes one symbol of P, and the QR code's Reed-Solomon code always
  repairs it (SPEC §5). Evidence: tests in CI (basic), E3 (pad).
- **Checking a new copy does not lean on that repair.** The web tool
  accepts a copy just made only if it reads back as the same seed with
  **no** codeword corrected, and every piece read matches the one made,
  except pieces that hold nothing but random padding bits (SPEC §3.5, §7).
  A data piece misread in both strings, the two errors cancelling out,
  still blocks. Evidence: `web/test.mjs` (`checkVerdict`, `paddingOnlyRead`).
- **Pad file**: each row's check character is
  $\left(N - \left(\sum_i w_i(d_i) \bmod N\right)\right) \bmod N$, where,
  from the row's last symbol leftwards, $w_i$ alternately doubles a symbol
  ($d \mapsto 2d$ if $2d < N$, else $2d - N + 1$) and leaves it as it is
  (Luhn mod $N$). It catches every wrong symbol, and every swap of two
  neighbours except $0 \leftrightarrow N - 1$, and says in which row (for
  $N = 2$ it is a parity bit and catches no swaps). This holds for every
  even $N$, so for every $N$ of the format; for odd $N$ the doubling is not
  one-to-one and it would not. It is a function of the pad only.
  Evidence: E6.
- **Direction and roles**: software tries both directions and both roles
  (SPEC §10.5, §10.9); only the right one decodes. When checking a new
  copy, the web tool also says if a string was read from its other end, or
  the two strings swapped, and offers to turn the reading round.

## 5. What can give a sequence away

SeedCraft's first defence in both modes is that a sequence does not look
like a backup. What can still give it away:

| Feature | Basic mode | Pad mode |
| :--- | :--- | :--- |
| Analysis by someone who knows the method | **Decisive**: it decodes (§4.2) | $C$ is uniformly random: statistically the same as a string of beads chosen at random. Running the attack only shows that it is not a basic sequence |
| Length | Fixed by SPEC §2 (54 and 91 for $N = 16$) | Same |
| Number of kinds | $N$, a power of two | Same |
| The dictionary | $N$ different things, one of each. $N$ different things in a row happen by chance with probability $N!/N^N$ ($\approx 1.1 \times 10^{-6}$ for $N = 16$): **do not carry it with the sequence** | Same, and the same if it starts the pad's string (SPEC §10.6) |
| A second string | — | Two strings of the same length and kinds, found together, are a pair, and together they are the seed |
| The pad file | — | Rows of 16 hexadecimal characters and a check character look like a key. No header names it by default (SPEC §10.7) |
| The object | A carefully made necklace with no pattern at all is less usual than a child's bracelet of mixed beads: choose things where disorder is normal, at a normal size (54 beads of 6 mm make a 32 cm choker); SPEC §11 compares forms | Same |
| Behaviour | What the carrier says and does gives more away than any analysis | Same |

If SeedCraft becomes well known, "a string of exactly 54 things of 16
kinds" becomes a signature in either mode. In pad mode that only marks the
string as worth looking at; it does not reveal the seed. Breaking the
signature (free decorative pieces outside the dictionary at the ends) is an
open question (§8).

## 6. Evidence

| | Claim | Evidence | Status |
| :--- | :--- | :--- | :--- |
| E1 | A basic sequence gives up its dictionary in $\le 8$ tries for $N \le 16$ | `tools/dictionary_attack.py`; `tests/test_sequences.py` | In the repository, runs in CI |
| E2 | The same attack finds nothing on a pad-mode sequence: its equations are inconsistent for all 8 masks | `tests/test_pad.py`, every pad-mode vector with $N \le 16$ | In the repository, runs in CI |
| E3 | One wrong pad symbol is repaired | `tests/test_pad.py`: every position of every vector, in the pad and in the sequence; `web/test.mjs`: a random position of each, in the web tool | In the repository, runs in CI |
| E4 | $C$ is uniform whatever the seed | Proof in §4.1; `tests/test_pad.py`: $\chi^2$ over many encodings of one seed, each position, all together and neighbouring pairs, for every $N$ (and a check that a slightly biased pad is caught) | In the repository, runs in CI |
| E5 | A reused pad gives away the other seed once one is known | `tools/pad_reuse.py`; `tests/test_pad.py` for every $N$, 12 and 24 words | In the repository, runs in CI |
| E6 | Check characters: every single error, every adjacent swap but $0 \leftrightarrow N - 1$ | `tests/test_pad.py`: exhaustively over the symbol values for every even $N$ from 2 to 32, over random rows, and every wrong symbol in a pad file; `web/test.mjs`: every neighbour swap for $N$ from 4 to 32, and a wrong character in each vector's pad file, in the web tool | In the repository, runs in CI |
| E7 | Every one of the 8 masks gives a valid CompactSeedQR | `tests/test_pad.py`: every test seed, every $N$, both modes | In the repository, runs in CI |
| E8 | How many pieces to buy (SPEC §6, §10.6) | `tools/pieces_tables.py`, 100 000 random seeds and pads per row; CI runs it in short | In the repository; with 100 000 samples it gives the 99.9 % tables of SPEC §6 and §10.6 exactly. CI runs it in short, without checking the figures. The web tool's 90th-percentile estimates (the "about" tables) come from the same kind of simulation; the script does not print them yet |

## 7. Designs considered and rejected

So that reviewers do not have to rediscover them.

1. **The dictionary as a secret** ($16! \approx 2^{44}$ orders). Not a secret
   against anyone who knows the method: $\le 8$ tries (§4.2).
2. **Noise pieces** (things outside the dictionary, dropped by the
   reader) on a basic sequence. The adversary only has to choose which of
   the $N + m$ kinds are noise, and noise is never in the dictionary:
   $\binom{N+m}{m} \cdot 8$ tries,
   $\binom{19}{3} \cdot 8 = 7752 \approx 2^{13}$ for $N = 16$, $m = 3$. As
   disguise they may still have a place (§5); as protection, none.
3. **Only the entropy and a "2-bit mask"** (130 bits, 33 pieces), with a
   secret dictionary and noise, as an earlier draft proposed. The QR code
   has 8 masks, not 4, and any of them gives a valid code, so no mask needs
   storing at all; without the Reed-Solomon parity the QR code cannot be
   drawn by hand; and the protection is at most
   $16! \cdot \binom{19}{3} \approx 2^{54}$ candidates.
   Each one costs a PBKDF2, but at the rate of §4.2 the whole space is about
   640 GPU-years, about eight months for 1 000 GPUs (four on average): not
   enough for funds, and resting on a rate nobody measured.
4. **Noise placed by a generator keyed on the seed.** The positions are then
   a function of the seed: a free check of every guess in basic mode, and a
   leak even under a pad. Randomness that is part of a sequence must come
   from a generator independent of the seed.
5. **A pad over the entropy and checksum only** (132 bits: 33 things and a
   33-symbol pad for 12 words, read back as words by hand). Shorter, but it
   has no error correction (the 4-bit checksum catches 15 errors in 16 and
   repairs none) and it would be a second method to learn by hand.
   Postponed, not ruled out (§8).
6. **A pad derived from a password.** It brings back brute force and cannot
   be computed by hand.

## 8. Out of scope and open questions

**Out of scope**: a compromised encoding device, or one that is online
while it holds a real seed; coercion of someone who knows where both halves
are; whatever the user does with a pad file once it leaves the device
(§4.4 has the advice).

**Open questions, for reviewers too:**

- An independent audit of the method, the reference implementation and the
  web tool: none has been done yet.
- Is the model of §4.1 faithful to how pads are actually made, by devices
  and by hand?
- Is 2-of-2 the right default, or should a 2-of-3 scheme with additions
  alone be specified for those who fear loss more than theft?
- Free decorative pieces to break the length and kinds signature (§5): how
  to add them without making the sequence harder to read.
- The shorter pad mode of §7.5.
- **Error rates by hand** have not been measured: how long reading and
  subtracting takes, and how many mistakes real people make. No figure in
  this document is a usability claim.

To report a mistake in this audit or a weakness in the method, open an
issue in the repository.
