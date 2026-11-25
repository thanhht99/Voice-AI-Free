"""Run VieNeu voices and encode their audio as MP3."""

import base64
import json
import os
import shutil
import subprocess
import sys
from contextlib import redirect_stdout
import numpy as np

PROFILE_VERSION = "nano1:"
SPEAKER_SIZE = 192
STYLE_SHAPE = (50, 256)
SAMPLE_RATE = 24000


def send(message):
    print(json.dumps(message, ensure_ascii=False), flush=True)


def encode_mp3(audio, sample_rate, speed, ffmpeg):
    result = subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error",
            "-f", "f32le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
            "-af", f"atempo={speed}", "-codec:a", "libmp3lame", "-b:a", "96k",
            "-f", "mp3", "pipe:1",
        ],
        input=audio.astype("<f4", copy=False).tobytes(),
        capture_output=True,
        check=True,
        timeout=30,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    return base64.b64encode(result.stdout).decode("ascii")


def encode_profile(speech, sample):
    pcm = base64.b64decode(sample, validate=True)
    waveform = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768
    if not 3 * SAMPLE_RATE <= waveform.size <= 8 * SAMPLE_RATE:
        raise ValueError("Invalid reference length.")
    voiced = np.flatnonzero(np.abs(waveform) >= max(0.008, float(np.max(np.abs(waveform))) * 0.04))
    if voiced.size < SAMPLE_RATE // 4:
        raise ValueError("The reference is too quiet.")
    margin = SAMPLE_RATE // 8
    waveform = waveform[max(0, voiced[0] - margin):voiced[-1] + margin + 1]
    speaker, style = speech.engine.prepare_reference(waveform, sr=SAMPLE_RATE, denoise=False)
    if speaker.shape != (SPEAKER_SIZE,) or style.shape != STYLE_SHAPE:
        raise RuntimeError("Unexpected VieNeu profile shape.")
    data = np.concatenate([speaker, style.reshape(-1)]).astype("<f4", copy=False)
    return PROFILE_VERSION + base64.b64encode(data.tobytes()).decode("ascii")


def decode_profile(profile):
    if not isinstance(profile, str) or not profile.startswith(PROFILE_VERSION):
        raise ValueError("Invalid profile format.")
    data = np.frombuffer(base64.b64decode(profile[len(PROFILE_VERSION):], validate=True), dtype="<f4")
    if data.size != SPEAKER_SIZE + np.prod(STYLE_SHAPE) or not np.all(np.isfinite(data)) or np.max(np.abs(data)) > 1000:
        raise ValueError("Invalid profile data.")
    return {"speaker_emb": data[:SPEAKER_SIZE], "style": data[SPEAKER_SIZE:].reshape(STYLE_SHAPE)}


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("Install FFmpeg and add it to PATH.")

    with redirect_stdout(sys.stderr):
        from vieneu import Vieneu

        model = os.environ.get("VIENEU_MODE", "v3nano")
        if model not in {"v3nano", "v3turbo"}:
            raise ValueError("VIENEU_MODE must be v3nano or v3turbo.")
        options = {"backend": "onnx"} if model == "v3turbo" else {}
        speech = Vieneu(mode=model, **options)
        voices = {}
        for _, voice_id in speech.list_preset_voices():
            voice = speech.get_preset_voice(voice_id)
            description = voice.get("description", "").split(" · ")
            region = description[1] if len(description) > 1 else ""
            voices[voice_id] = {
                "id": voice_id,
                "name": voice_id,
                "gender": voice.get("gender", ""),
                "region": {"Bắc": "north", "Trung": "central", "Nam": "south"}.get(region, ""),
            }
    send({"ready": list(voices.values()), "personalVoice": model == "v3nano"})

    for line in sys.stdin:
        try:
            request = json.loads(line)
            if "sample" in request and model == "v3nano":
                try:
                    with redirect_stdout(sys.stderr):
                        profile = encode_profile(speech, request["sample"])
                except ValueError:
                    send({"error": "invalidSample"})
                    continue
                send({"profile": profile})
                continue
            if "profile" in request and model == "v3nano":
                try:
                    voice = decode_profile(request["profile"])
                except ValueError:
                    send({"error": "invalidProfile"})
                    continue
            else:
                voice = request["voice"]
                if voice not in voices:
                    raise ValueError("Invalid preset voice.")
            speed = request["speed"]
            if not 0.75 <= speed <= 1.25:
                raise ValueError("Invalid speed.")
            with redirect_stdout(sys.stderr):
                audio = speech.infer(request["text"], voice=voice)
            if not audio.size:
                raise ValueError("The script did not produce any audio.")
            send({"audio": encode_mp3(audio, speech.sample_rate, speed, ffmpeg)})
        except Exception:
            # Avoid logging script content from third-party exceptions.
            print("VieNeu could not generate or encode audio.", file=sys.stderr)
            send({"error": True})


if __name__ == "__main__":
    main()
