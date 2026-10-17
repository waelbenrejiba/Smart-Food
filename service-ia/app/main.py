from __future__ import annotations

import json
import os
import unicodedata
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal, TypedDict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

app = FastAPI(title="Assistant IA du chef", version="0.2.0")

SYSTEM_PROMPT = """Tu es l’assistant IA d’un chef de restaurant en Tunisie.
Réponds en français clair, précis et pratique. Utilise les données de stock
fournies comme source de vérité. Si une information manque, demande-la au lieu
de l’inventer. Tu peux proposer des plans de préparation, d’achat, de rotation
FIFO/FEFO et de réduction des pertes, mais ne prétends jamais avoir modifié le stock.

Sécurité alimentaire : une date dépassée, une altération, une contamination ou
une conservation incertaine impose de ne pas servir le produit, de l’isoler et
de suivre la procédure d’hygiène du restaurant. Ne propose jamais de masquer un
défaut par une recette ou une promotion. N’invente pas de durée de conservation
ni de température réglementaire : privilégie l’étiquette, le fournisseur et la
procédure validée du restaurant. Une date ou une température seule ne suffit pas
à déclarer un aliment salubre.
"""

INTENT_GUIDANCE = {
    "stock": "Présente clairement les quantités et emplacements connus. Signale les données absentes.",
    "echeances": "Classe les produits périmés puis ceux dont l’échéance approche. L’alerte interne est à cinq jours. Ne recommande jamais de servir un produit douteux.",
    "achats": "Aide à prioriser les achats à partir des quantités et seuils réellement fournis. Signale les données nécessaires si elles manquent.",
    "hygiene": "Donne des rappels généraux de séparation, étiquetage, rotation et suivi des procédures locales validées.",
    "anti_gaspillage": "Propose des actions concrètes : planifier les préparations, ajuster les achats, appliquer FEFO et valoriser uniquement les produits encore sûrs.",
    "general": "Réponds à la demande du chef et propose une prochaine action concrète liée à son restaurant.",
}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    stock: list[dict] | None = None


class ChatState(TypedDict, total=False):
    question: str
    history: list[BaseMessage]
    stock: list[dict]
    intent: str
    answer: str


def demo_stock() -> list[dict]:
    source = ROOT / "data" / "demo_stock.json"
    rows = json.loads(source.read_text(encoding="utf-8"))
    today = date.today()
    for item in rows:
        days = item.pop("days_to_expiry", None)
        item["expiry_date"] = (today + timedelta(days=days)).isoformat() if days is not None else None
    return rows


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def classify_intent(question: str) -> str:
    text = normalize(question)
    patterns = {
        "echeances": ("expiration", "expire", "perime", "echeance", "date limite", "alerte", "bientot"),
        "anti_gaspillage": ("gaspillage", "perte", "utiliser en priorite", "recette", "valoriser", "invendu"),
        "hygiene": ("hygiene", "temperature", "conserver", "conservation", "frigo", "stockage", "salubrite"),
        "achats": ("acheter", "achat", "commander", "reapprovisionner", "manque", "seuil bas"),
        "stock": ("stock", "quantite", "combien", "inventaire", "produit disponible"),
    }
    for intent, words in patterns.items():
        if any(word in text for word in words):
            return intent
    return "general"


def enrich_stock(items: list[dict]) -> list[dict]:
    enriched: list[dict] = []
    today = date.today()
    for original in items[:200]:
        item = dict(original)
        raw_date = item.get("expiry_date") or item.get("date_expiration") or item.get("date_limite")
        if isinstance(raw_date, str):
            try:
                remaining = (date.fromisoformat(raw_date[:10]) - today).days
                item["days_until_expiry"] = remaining
                item["expiry_alert_5_days"] = remaining <= 5
            except ValueError:
                item["expiry_date_note"] = "Format de date non reconnu"
        enriched.append(item)
    return enriched


@lru_cache(maxsize=1)
def get_model() -> ChatGroq:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY manquante")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
    return ChatGroq(model=model, api_key=api_key, max_retries=2, timeout=30)


def route_node(state: ChatState) -> dict[str, str]:
    return {"intent": classify_intent(state["question"])}


def respond_node(state: ChatState) -> dict[str, str]:
    stock_json = json.dumps(state.get("stock", []), ensure_ascii=False, indent=2)
    instructions = (
        f"{SYSTEM_PROMPT}\nType de demande : {state.get('intent', 'general')}. "
        f"Consigne ciblée : {INTENT_GUIDANCE.get(state.get('intent', 'general'), INTENT_GUIDANCE['general'])}\n"
        f"Date du jour : {date.today().isoformat()}.\n"
        f"Stock fourni (JSON) :\n{stock_json}"
    )
    messages: list[BaseMessage] = [SystemMessage(content=instructions)]
    messages.extend(state.get("history", [])[-8:])
    messages.append(HumanMessage(content=state["question"]))
    result = get_model().invoke(messages)
    answer = result.content
    if not isinstance(answer, str):
        answer = "".join(part.get("text", "") for part in answer if isinstance(part, dict))
    return {"answer": answer.strip() or "Je n’ai pas pu formuler une réponse. Pouvez-vous reformuler ?"}


@lru_cache(maxsize=1)
def get_chat_graph():
    graph = StateGraph(ChatState)
    graph.add_node("route_intent", route_node)
    graph.add_node("respond", respond_node)
    graph.add_edge(START, "route_intent")
    graph.add_edge("route_intent", "respond")
    graph.add_edge("respond", END)
    return graph.compile()


@app.get("/")
def home() -> FileResponse:
    return FileResponse(ROOT / "app" / "static" / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/demo-stock")
def get_demo_stock() -> list[dict]:
    return demo_stock()


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, str]:
    if not os.getenv("GROQ_API_KEY", "").strip():
        raise HTTPException(
            status_code=503,
            detail="Clé API manquante. Ajoutez GROQ_API_KEY dans le fichier .env du serveur.",
        )

    stock = request.stock
    if stock is None:
        stock = demo_stock() if os.getenv("DEMO_MODE", "true").lower() == "true" else []

    history: list[BaseMessage] = []
    for turn in request.history[-8:]:
        history.append(HumanMessage(content=turn.content) if turn.role == "user" else AIMessage(content=turn.content))
    try:
        result = get_chat_graph().invoke(
            {"question": request.message, "history": history, "stock": enrich_stock(stock)}
        )
        return {"reply": result["answer"], "intent": result["intent"]}
    except Exception as exc:
        # Ne renvoyer ni la clé ni les détails de la requête au navigateur.
        raise HTTPException(
            status_code=502,
            detail="Le service IA n’a pas pu répondre. Vérifiez la clé, le modèle configuré et votre connexion.",
        ) from exc
