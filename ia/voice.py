import requests
from django.conf import settings

MAX_BYTES = 10 * 1024 * 1024


class VoiceError(Exception):
    pass


def transcribe(audio_file, language: str | None = None) -> str:
    if not settings.GROQ_API_KEY:
        raise VoiceError("GROQ_API_KEY manquante")
    if audio_file.size > MAX_BYTES:
        raise VoiceError("Enregistrement trop long (10 Mo maximum)")

    data = {"model": settings.GROQ_STT_MODEL, "response_format": "json", "temperature": 0}
    if language in ("fr", "ar", "en"):
        data["language"] = language  # sans ce champ, Whisper détecte la langue

    r = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        files={"file": (audio_file.name or "voice.webm", audio_file.read(),
                        audio_file.content_type or "audio/webm")},
        data=data,
        timeout=60,
    )
    r.raise_for_status()
    return (r.json().get("text") or "").strip()