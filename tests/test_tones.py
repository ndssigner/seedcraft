#!/usr/bin/env python3
"""Tests of the Tones reference implementation against vectors/tones-v0.json:
URs and seeds to tones and back, error correction, and audio (rendered,
with noise, detuned, at several paces and sample rates) back to tones.

    python3 tests/test_tones.py
"""
import json
import pathlib
import random
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "reference" / "python"))
import seedcraft_tones as st  # noqa: E402

VECTORS = json.loads((ROOT / "vectors" / "tones-v0.json").read_text())["vectors"]
failures = 0
checks = 0


def check(ok, what):
    global failures, checks
    checks += 1
    if not ok:
        failures += 1
        print("FAIL", what)


def raises(f, *args):
    try:
        f(*args)
    except st.DecodeError:
        return True
    return False


def damage(frame, n, rng):
    """Changes n tones of a frame, each in a different byte, not the sync."""
    tones = list(frame)
    for byte in rng.sample(range((len(frame) - 2) // 2), n):
        i = 2 + 2 * byte + rng.randrange(2)
        tones[i] = rng.choice([k for k in st.KEYS if k != tones[i]])
    return "".join(tones)


def noisy(samples, level, rng):
    return [x + rng.gauss(0, level) for x in samples]


def main():
    rng = random.Random(1)
    for v in VECTORS:
        name = "%s pin=%s" % (v["name"], v.get("pin"))
        if "entropy" in v:
            entropy, pin = bytes.fromhex(v["entropy"]), v["pin"]
            check(st.seed_to_keypad(entropy, pin) == v["keypad"], "keypad " + name)
            check(st.keypad_to_seed(v["keypad"], pin) == entropy, "keypad back " + name)
            check(st.seed_to_ur(entropy, pin) == v["ur"], "seed UR " + name)
            check(st.ur_to_seed(v["ur"], pin) == entropy, "seed UR back " + name)
            urs = [v["ur"]]
            # a mistyped digit: the BIP-39 checksum catches most (not all)
            if pin is None:
                caught = sum(raises(st.keypad_to_seed, v["keypad"][:i] + str((int(v["keypad"][i]) + 1) % 10)
                                    + v["keypad"][i + 1:]) for i in range(1, len(v["keypad"]) - 1))
                check(caught >= 0.8 * (len(v["keypad"]) - 2), "keypad checksum %s: %d" % (name, caught))
        else:
            urs = v["urs"]
        for ur, frame in zip(urs, v["frames"]):
            check(st.ur_to_frame(ur) == frame, "frame " + name)
            check(st.frame_to_ur(frame) == (ur, 0), "frame back " + name)
            # Reed-Solomon: 5 wrong bytes are repaired, 6 are not
            got = st.frame_to_ur(damage(frame, 5, rng))
            check(got == (ur, 5), "5 errors repaired " + name)
            check(raises(st.frame_to_ur, damage(frame, 6, rng))
                  or st.frame_to_ur(damage(frame, 6, rng))[0] != ur, "6 errors not silently accepted " + name)
            # a lost or an extra tone: the frame is discarded, not misread
            check(raises(st.frame_to_ur, frame[:40] + frame[41:]), "lost tone " + name)
            check(raises(st.frame_to_ur, frame[:40] + "5" + frame[40:]), "extra tone " + name)

    # audio: a keypad seed, a seed frame and a PSBT frame, in one recording
    seed = next(v for v in VECTORS if v.get("pin") is None and "keypad" in v)
    psbt = next(v for v in VECTORS if "psbt_base64" in v)
    groups = [seed["keypad"], seed["frames"][0], psbt["frames"][0]]
    expect = [("seed", bytes.fromhex(seed["entropy"])), ("ur", seed["ur"]), ("ur", psbt["urs"][0])]
    for rate, tone, gap, detune, noise in [(8000, 40, 40, 1.0, 0.01), (8000, 50, 50, 1.015, 0.03),
                                          (16000, 50, 50, 0.985, 0.03), (44100, 80, 80, 1.0, 0.05),
                                          (48000, 50, 50, 1.01, 0.02)]:
        audio = noisy(st.render(groups, rate, tone, gap, detune=detune), noise, rng)
        got = st.receive(audio, rate)
        check(got == expect, "audio %d Hz %d/%d ms detune %.3f noise %.2f: %s"
              % (rate, tone, gap, detune, noise, [g[:2] for g in got]))

    # keypad mode keyed by a person: uneven tones and long pauses
    keys = seed["keypad"]
    audio = []
    for k in keys:
        audio += st.render([k], 8000, rng.randint(60, 250), 0, pause_ms=rng.randint(150, 1200))
    check(st.receive(audio, 8000) == [expect[0]], "keypad at a person's pace")

    # a WAV file round trip
    with tempfile.TemporaryDirectory() as d:
        path = pathlib.Path(d) / "seed.wav"
        st.write_wav(path, st.render([seed["frames"][0]], 44100), 44100)
        samples, rate = st.read_wav(path)
        check(st.receive(samples, rate) == [expect[1]], "WAV round trip")

    print("%s: %d vectors, %d checks, %d failures" % ("ok" if not failures else "FAIL",
                                                      len(VECTORS), checks, failures))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
