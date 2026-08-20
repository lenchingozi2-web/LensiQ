from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 22_050
DURATION = 90
OUTPUT = Path('/home/ubuntu/LensiQ/public/audio/live-class-piano.wav')


def midi_frequency(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def add_note(buffer: np.ndarray, start: float, duration: float, midi: int, amplitude: float) -> None:
    start_index = int(start * SAMPLE_RATE)
    end_index = min(len(buffer), start_index + int(duration * SAMPLE_RATE))
    if end_index <= start_index:
        return
    t = np.arange(end_index - start_index, dtype=np.float64) / SAMPLE_RATE
    frequency = midi_frequency(midi)
    partials = (
        (1.00, 1.00),
        (2.01, 0.42),
        (3.02, 0.20),
        (4.04, 0.10),
        (5.08, 0.045),
    )
    tone = np.zeros_like(t)
    for multiplier, strength in partials:
        tone += strength * np.sin(2.0 * math.pi * frequency * multiplier * t)
    attack = np.minimum(1.0, t / 0.018)
    decay = np.exp(-1.35 * t)
    tail = np.exp(-0.10 * np.maximum(0.0, t - 1.2))
    envelope = attack * decay * tail
    buffer[start_index:end_index] += tone * envelope * amplitude


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    samples = SAMPLE_RATE * DURATION
    audio = np.zeros(samples, dtype=np.float64)
    beats = 60.0 / 68.0
    bar = beats * 4.0
    progression = [
        (48, [60, 64, 67, 71]),  # Cmaj7
        (45, [57, 60, 64, 67]),  # Am7
        (41, [53, 57, 60, 64]),  # Fmaj7
        (43, [55, 59, 62, 67]),  # Gsus2/G6
    ]
    bars = int(DURATION / bar) + 1
    for bar_index in range(bars):
        chord_root, chord = progression[bar_index % len(progression)]
        start = bar_index * bar
        add_note(audio, start, bar * 1.10, chord_root, 0.075)
        for step, note in enumerate(chord[1:]):
            add_note(audio, start + step * beats * 0.78, bar * 0.92, note, 0.045)
        motif = [chord[1], chord[2], chord[3], chord[2], chord[1], chord[2]]
        for step, note in enumerate(motif):
            note_start = start + 0.45 * beats + step * 0.54 * beats
            if note_start < DURATION:
                add_note(audio, note_start, 0.68 * beats, note + 12, 0.032)

    fade = int(3.0 * SAMPLE_RATE)
    audio[:fade] *= np.linspace(0.0, 1.0, fade)
    audio[-fade:] *= np.linspace(1.0, 0.0, fade)
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = np.clip(audio / peak * 0.42, -1.0, 1.0)
    stereo = np.column_stack((audio, audio * 0.985))
    pcm = (stereo * 32767).astype(np.int16)
    with wave.open(str(OUTPUT), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())
    print(f'Wrote {OUTPUT} ({DURATION}s, {SAMPLE_RATE}Hz stereo)')


if __name__ == '__main__':
    main()
