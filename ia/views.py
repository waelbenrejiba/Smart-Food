import logging
import re

import requests
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .graph import run_chat, _norm
from .voice import VoiceError, transcribe

log = logging.getLogger(__name__)
ARABE = re.compile(r"[\u0600-\u06FF]")



OUI = {"oui", "ok", "okay", "confirme", "confirmer", "valide", "yes", "ouais",
       "d'accord", "daccord", "vas", "نعم", "اه", "ايوه"}
NON = {"non", "annule", "annuler", "no", "stop", "لا"}


def confirmation(texte: str) -> str | None:
    tokens = re.findall(r"[\w']+", _norm(texte).replace("’", "'"))
    if not tokens or len(tokens) > 4:
        return None
    if tokens[0] in OUI:
        return "oui"
    if tokens[0] in NON:
        return "non"
    return None
log = logging.getLogger(__name__)
ARABE = re.compile(r"[\u0600-\u06FF]")


def _clean_history(raw) -> list[dict]:
    out = []
    for h in raw if isinstance(raw, list) else []:
        if isinstance(h, dict) and h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            out.append({"role": h["role"], "content": h["content"][:4000]})
    return out[-8:]


def _answer(user, message: str, history: list[dict]):
    try:
        result = run_chat(user, message, history)
    except Exception:
        log.exception("Erreur assistant IA")
        return Response({"detail": "Assistant IA indisponible."}, status=status.HTTP_502_BAD_GATEWAY)
    result["lang"] = "ar-SA" if ARABE.search(result["reply"]) else "fr-FR"
    return Response(result)


class ChatIn(serializers.Serializer):
    message = serializers.CharField(max_length=4000)
    history = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChatIn(data=request.data)
        s.is_valid(raise_exception=True)
        return _answer(request.user, s.validated_data["message"], _clean_history(s.validated_data["history"]))


class VoiceView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        audio = request.FILES.get("audio")
        if not audio:
            return Response({"detail": "Fichier audio manquant."}, status=400)

        try:
            texte = transcribe(audio, request.data.get("language"))
        except VoiceError as e:
            return Response({"detail": str(e)}, status=400)
        except requests.RequestException:
            log.exception("Erreur Whisper")
            return Response({"detail": "Transcription indisponible."}, status=502)

        if not texte:
            return Response({"detail": "Je n'ai rien entendu, réessayez."}, status=400)

        try:
            history = _clean_history(json.loads(request.data.get("history", "[]")))
        except ValueError:
            history = []

        resp = _answer(request.user, texte, history)
        if resp.status_code == 200:
            resp.data["transcript"] = texte
        return resp