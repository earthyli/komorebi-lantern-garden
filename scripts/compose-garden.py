"""Render the original sixteen-bar courtyard loop as a stereo WAV."""
import sys
import wave
import numpy as np

rate = 32000
beat = 60 / 78
length = round(16 * 4 * beat * rate)
mix = np.zeros((length, 2))
rng = np.random.default_rng(78)

def voice(at, midi, duration, level, pan, timbre):
    t = np.arange(round(duration * rate)) / rate
    f = 440 * 2 ** ((midi - 69) / 12)
    phase = 2 * np.pi * f * t
    if timbre == 'pluck':
        tone = sum(a * np.sin(phase * h) * np.exp(-t * decay)
                   for h, a, decay in [(1, 1, 1.7), (2.002, .46, 3.7), (3.006, .24, 5), (5.02, .12, 8)])
        tone *= 1 - np.exp(-t * 150)
    elif timbre == 'flute':
        vib = .034 * np.sin(2 * np.pi * 4.5 * t)
        tone = (np.sin(phase + vib) + .13 * np.sin(2 * phase + 2 * vib))
        tone *= (1 - np.exp(-t * 8)) * np.exp(-.8 * t)
    else:
        tone = (np.sin(phase) + .19 * np.sin(2 * phase)) * (1 - np.exp(-t * 15)) * np.exp(-t * 1.35)
    tone *= np.minimum(1, (duration - t) / .16).clip(0, 1) * level
    stereo = tone[:, None] * [np.sqrt(1 - pan), np.sqrt(pan)]
    indices = (round(at * beat * rate) + np.arange(len(t))) % length
    mix[indices] += stereo

# D major, moving between the tonic, suspended colours and a gentle cadence.
chords = [(50,57,62,66),(47,54,59,62),(43,55,59,62),(45,57,62,64),
          (50,57,62,66),(54,57,61,66),(43,55,59,64),(45,55,61,64),
          (47,54,59,62),(42,54,57,61),(43,55,59,62),(50,57,62,66),
          (40,55,59,64),(43,55,59,62),(45,57,61,64),(50,57,62,66)]
melody = [[(0,69,1),(1.5,74,1),(3,76,.8)],[(0,78,2),(2.5,74,1)],[(.5,71,1.5),(2.5,69,1)],
          [(0,66,2.4)],[(.5,69,1),(2,74,1.5)],[(0,78,1.5),(2,81,1.2)],[(0,79,1),(1.5,76,1),(3,74,.8)],
          [(0,73,2)],[(0,74,1.5),(2,71,1.6)],[(.5,69,2)],[(0,67,1),(1.5,71,1),(3,74,.8)],
          [(0,78,2)],[(0,76,1),(1.5,71,1),(3,67,.8)],[(.5,69,1),(2,71,1)],[(0,73,1),(1.5,76,1),(3,69,.7)],[(0,74,2.5)]]
for bar, (chord, phrase) in enumerate(zip(chords, melody)):
    start = bar * 4
    voice(start, chord[0]-12, 2.8, .16, .49, 'bass')
    for offset, index in [(0,1),(.75,2),(1.5,3),(2.5,2),(3.25,1)]:
        voice(start+offset+rng.uniform(0,.018), chord[index], 2.3, rng.uniform(.09,.14), .31, 'pluck')
    for offset, note, hold in phrase:
        voice(start+offset+.03, note, hold*beat+.22, .125, .64, 'flute')
dry = mix.copy()
for delay, gain in [(.13,.12),(.267,.09),(.391,.055),(.54,.038)]:
    mix += np.roll(dry[:, ::-1], round(delay*rate), axis=0) * gain
mix *= .64 / np.max(np.abs(mix))
with wave.open(sys.argv[1], 'wb') as audio:
    audio.setparams((2, 2, rate, 0, 'NONE', 'not compressed'))
    audio.writeframes((mix*32767).astype('<i2').tobytes())
