from pathlib import Path
import wave
import numpy as np

SAMPLE_RATE = 22050
DURATION = 90
OUT = Path('/home/ubuntu/LensiQ/public/audio')
OUT.mkdir(parents=True, exist_ok=True)


def smooth_noise(length: int, seed: int, cutoff: int = 700) -> np.ndarray:
    rng = np.random.default_rng(seed)
    raw = rng.normal(0, 1, length // 80 + 2)
    expanded = np.interp(np.linspace(0, len(raw) - 1, length), np.arange(len(raw)), raw)
    kernel_size = max(3, int(SAMPLE_RATE / cutoff))
    kernel = np.ones(kernel_size) / kernel_size
    filtered = np.convolve(expanded, kernel, mode='same')
    return filtered / max(1e-9, np.max(np.abs(filtered)))


def write_wav(path: Path, left: np.ndarray, right: np.ndarray) -> None:
    stereo = np.column_stack([left, right])
    stereo = np.clip(stereo, -1, 1)
    pcm = (stereo * 0.78 * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def bed(freqs, seed, warmth=0.24, motion=0.045, noise_level=0.008, bass=0.08):
    t = np.arange(SAMPLE_RATE * DURATION, dtype=np.float64) / SAMPLE_RATE
    signal = np.zeros_like(t)
    for index, frequency in enumerate(freqs):
        phase = 0.7 * index + seed * 0.013
        slow = 0.72 + 0.28 * np.sin(2 * np.pi * (0.006 + index * 0.0013) * t + phase)
        signal += slow * np.sin(2 * np.pi * frequency * t + phase) / len(freqs)
    signal += bass * np.sin(2 * np.pi * 41.2 * t + 0.4 * np.sin(t * 0.01))
    signal += noise_level * smooth_noise(len(t), seed)
    fade = np.minimum(1, t / 6) * np.minimum(1, (DURATION - t) / 8)
    signal *= np.clip(fade, 0, 1)
    signal /= max(1e-9, np.max(np.abs(signal)))
    movement = 1 + motion * np.sin(2 * np.pi * 0.008 * t)
    left = signal * movement
    right = signal * (1 - motion * 0.7 * np.sin(2 * np.pi * 0.007 * t + 1.2))
    return left, right


# A small set of user-selectable beds. All are deliberately slow, low, and voice-safe.
profiles = {
    'live-class-deep-focus.wav': ([55.0, 73.42, 110.0], 17, 0.25, 0.032, 0.004, 0.11),
    'live-class-warm-drift.wav': ([65.41, 82.41, 130.81], 29, 0.20, 0.05, 0.006, 0.08),
    'live-class-night-library.wav': ([48.999, 61.735, 98.0], 43, 0.31, 0.025, 0.003, 0.14),
}

for filename, args in profiles.items():
    write_wav(OUT / filename, *bed(*args))
    print(OUT / filename)
