from __future__ import annotations

import json
import logging
import unicodedata
from datetime import date
from functools import lru_cache
from typing import Literal, TypedDict

from django.utils import timezone
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from chef.models import Produit
from .llm import get_llm
from .stock_context import snapshot

log = logging.getLogger(__name__)

# ---------- Prompts et constantes ----------

SYSTEM_PROMPT = """Tu es l'assistant IA d'un chef de restaurant en Tunisie.
Réponds dans la langue de la question (français par défaut ; arabe si le chef écrit en arabe).
Utilise UNIQUEMENT les données de stock fournies. Si une information manque, dis-le.
Ta réponse sera lue à voix haute : 5 phrases maximum, sans markdown, sans liste à puces, sans emoji.

Sécurité alimentaire :
- Un produit « expire » (date dépassée) ne se sert pas, ne se donne pas et ne se vend pas : il doit être écarté.
- Ne propose jamais de masquer un défaut par une recette ou une promotion.
- N'invente aucune durée ni température : utilise celles du stock ; sinon renvoie à l'étiquette et à la procédure du restaurant.
- Dons, promotions et plats du jour : uniquement pour les produits « urgent » ou « a_surveiller » encore sûrs.
- Ne prétends jamais avoir modifié le stock."""

GUIDE = {
    "stock": "Donne les quantités connues et signale les données absentes.",
    "echeances": "Classe d'abord les produits périmés, puis ceux dont l'échéance approche (alerte à 5 jours).",
    "achats": "Priorise les achats avec les quantités et seuils fournis.",
    "hygiene": "Rappelle séparation, étiquetage, rotation FEFO et procédures validées. Utilise les températures du stock.",
    "anti_gaspillage": "Propose des actions concrètes : don, promotion, plat du jour, uniquement pour les produits encore sûrs.",
    "general": "Réponds à la demande et propose une prochaine action concrète.",
}

PATTERNS = {
    "ajout": ("ajoute", "ajouter", "rajoute", "enregistre", "nouveau produit",
              "j'ai recu", "livraison", "اضف", "ضيف", "زيد"),
    "echeances": ("expiration", "expire", "perime", "echeance", "date limite", "alerte", "bientot", "urgent"),
    "anti_gaspillage": ("gaspillage", "perte", "priorite", "recette", "valoriser", "invendu", "don", "promotion"),
    "hygiene": ("hygiene", "temperature", "conserver", "conservation", "frigo", "stockage", "salubrite"),
    "achats": ("acheter", "achat", "commander", "reapprovisionner", "manque", "seuil"),
    "stock": ("stock", "quantite", "combien", "inventaire", "disponible"),
}

CAT_LABEL = {"FRUITS": "fruits", "LEGUMES": "légumes", "VIANDES": "viandes", "POISSONS": "poissons",
             "LAITIERS": "produits laitiers", "BOULANGERIE": "boulangerie", "AUTRE": "autre"}
UNITE_LABEL = {"KG": "kg", "L": "litre(s)", "PIECE": "pièce(s)"}

EXTRACT_PROMPT = """Tu extrais les informations d'un produit à ajouter au stock d'un restaurant, à partir de la demande du chef.
Date du jour : {today}. Catégories : FRUITS, LEGUMES, VIANDES, POISSONS, LAITIERS, BOULANGERIE, AUTRE. Unités : KG, L, PIECE.
N'invente rien : si le nom ou la quantité n'est pas donné, laisse le champ vide.
Renseigne la date d'expiration seulement si le chef la donne (convertis « dans 3 jours » en date AAAA-MM-JJ)."""


# ---------- Modèles ----------

class Action(BaseModel):
    produit: str
    type: Literal["Don", "Promotion", "Plat du jour", "Écarter"]
    quantite: float | None = None
    raison: str = ""


class Answer(BaseModel):
    reply: str = Field(description="Réponse courte, adaptée à la lecture à voix haute")
    actions: list[Action] = Field(default_factory=list)


class ProductDraft(BaseModel):
    nom: str | None = Field(None, description="Nom du produit, sans la quantité")
    categorie: Literal["FRUITS", "LEGUMES", "VIANDES", "POISSONS", "LAITIERS", "BOULANGERIE", "AUTRE"] = "AUTRE"
    quantite: float | None = None
    unite: Literal["KG", "L", "PIECE"] = "KG"
    date_expiration: str | None = Field(None, description="AAAA-MM-JJ, uniquement si donnée")
    prix_unitaire: float | None = None
    seuil_alerte: float | None = None


class State(TypedDict, total=False):
    user: object
    question: str
    history: list[BaseMessage]
    snap: dict
    intent: str
    reply: str
    actions: list[dict]
    proposition: dict | None


def _norm(text: str) -> str:
    d = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in d if not unicodedata.combining(c))


# ---------- Nœuds ----------

def load_stock(state: State) -> dict:
    return {"snap": snapshot(state["user"])}


def route(state: State) -> dict:
    text = _norm(state["question"]).replace("’", "'")
    for intent, words in PATTERNS.items():
        if any(w in text for w in words):
            return {"intent": intent}
    return {"intent": "general"}


def after_route(state: State) -> Literal["extract", "shortcut", "respond"]:
    if state["intent"] == "ajout":
        return "extract"          # ajouter à un stock vide est normal
    snap = state["snap"]
    if snap["total"] == 0:
        return "shortcut"
    if state["intent"] == "echeances" and not snap["alertes"]:
        return "shortcut"
    return "respond"


def shortcut(state: State) -> dict:
    snap = state["snap"]
    if snap["total"] == 0:
        return {"reply": "Votre inventaire est vide. Ajoutez vos produits pour que je puisse vous aider.", "actions": []}
    return {"reply": f"Aucune alerte pour le moment. Vos {snap['total']} produits sont dans les délais.", "actions": []}


def _fallback_reply(snap: dict) -> str:
    if not snap["alertes"]:
        return f"Aucune alerte. Vous avez {snap['total']} produits en stock."
    parts = []
    for a in snap["alertes"][:5]:
        j = a["jours_restants"]
        quand = "périmé" if j is not None and j < 0 else (f"expire dans {j} jours" if j is not None else "stock faible")
        parts.append(f"{a['nom']} : {quand}")
    return "Produits à traiter : " + ", ".join(parts) + ". Service IA indisponible, analyse simplifiée."


def respond(state: State) -> dict:
    intent = state["intent"]
    system = (
        f"{SYSTEM_PROMPT}\n\nType de demande : {intent}. Consigne : {GUIDE[intent]}\n"
        f"Stock (JSON compact) :\n{json.dumps(state['snap'], ensure_ascii=False, separators=(',', ':'))}"
    )
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    messages += state.get("history", [])[-6:]
    messages.append(HumanMessage(content=state["question"]))

    try:
        out: Answer = get_llm().with_structured_output(Answer).invoke(messages)
        return {"reply": out.reply.strip(), "actions": [a.model_dump() for a in out.actions]}
    except Exception:
        log.exception("Échec de l'appel LLM")
        return {"reply": _fallback_reply(state["snap"]), "actions": []}


def safety(state: State) -> dict:
    """Garde-fou déterministe : l'IA propose, les règles décident."""
    snap = state["snap"]
    expires = {a["nom"].lower(): a for a in snap["alertes"] if a["statut"] == "expire"}
    reply = state.get("reply", "")
    actions = [
        a for a in state.get("actions", [])
        if not (a["produit"].lower() in expires and a["type"] != "Écarter")
    ]

    for nom_l, a in expires.items():
        if not any(x["produit"].lower() == nom_l for x in actions):
            actions.append({"produit": a["nom"], "type": "Écarter", "quantite": a["quantite"],
                            "raison": "Date dépassée : ne pas servir, isoler et jeter selon la procédure."})
        if nom_l not in reply.lower():
            reply += f" Attention : {a['nom']} est périmé et doit être écarté."

    return {"reply": reply.strip(), "actions": actions}


def _ask(text: str) -> dict:
    return {"reply": text, "actions": [], "proposition": None}


def extract(state: State) -> dict:
    today = timezone.localdate()
    messages: list[BaseMessage] = [SystemMessage(content=EXTRACT_PROMPT.format(today=today.isoformat()))]
    messages += state.get("history", [])[-4:]
    messages.append(HumanMessage(content=state["question"]))

    try:
        d: ProductDraft = get_llm().with_structured_output(ProductDraft).invoke(messages)
    except Exception:
        log.exception("Échec extraction produit")
        return _ask("Je n'ai pas pu analyser la demande. Pouvez-vous la reformuler ?")

    nom = (d.nom or "").strip()
    if not nom:
        return _ask("Quel produit voulez-vous ajouter ?")
    if not d.quantite or d.quantite <= 0:
        return _ask(f"Quelle quantité de {nom} voulez-vous ajouter ?")

    date_exp = None
    if d.date_expiration:
        try:
            date_exp = date.fromisoformat(d.date_expiration[:10])
        except ValueError:
            date_exp = None
    if date_exp and date_exp < today:
        return _ask(f"La date limite de {nom} est déjà dépassée. "
                    "Je n'ajoute pas un produit périmé au stock : il doit être écarté.")

    existant = Produit.objects.filter(chef=state["user"], nom__iexact=nom, actif=True).first()
    prop = {
        "nom": nom,
        "categorie": d.categorie,
        "quantite": round(d.quantite, 2),
        "unite": d.unite,
        "date_expiration": date_exp.isoformat() if date_exp else None,
        "prix_unitaire": d.prix_unitaire or 0,
        "seuil_alerte": d.seuil_alerte if d.seuil_alerte is not None else 5,
        "existant": bool(existant),
    }

    reply = f"Je vais ajouter {d.quantite:g} {UNITE_LABEL[d.unite]} de {nom}, catégorie {CAT_LABEL[d.categorie]}. "
    reply += (f"Date limite : {date_exp.isoformat()}. " if date_exp
              else "La date limite sera calculée selon la recommandation de stockage. ")
    if existant:
        reply += (f"Attention, {nom} existe déjà ({existant.quantite:g} "
                  f"{UNITE_LABEL.get(existant.unite, existant.unite)}) : une nouvelle entrée sera créée. ")
    reply += "Confirmez-vous ?"
    return {"reply": reply, "actions": [], "proposition": prop}


# ---------- Graphe ----------

@lru_cache(maxsize=1)
def get_graph():
    g = StateGraph(State)
    g.add_node("load_stock", load_stock)
    g.add_node("route", route)
    g.add_node("extract", extract)
    g.add_node("shortcut", shortcut)
    g.add_node("respond", respond)
    g.add_node("safety", safety)

    g.add_edge(START, "load_stock")
    g.add_edge("load_stock", "route")
    g.add_conditional_edges("route", after_route,
                            {"extract": "extract", "shortcut": "shortcut", "respond": "respond"})
    g.add_edge("extract", END)
    g.add_edge("shortcut", "safety")
    g.add_edge("respond", "safety")
    g.add_edge("safety", END)
    return g.compile()


def run_chat(user, message: str, history: list[dict]) -> dict:
    msgs: list[BaseMessage] = []
    for h in history[-6:]:
        cls = HumanMessage if h["role"] == "user" else AIMessage
        msgs.append(cls(content=h["content"]))
    out = get_graph().invoke({"user": user, "question": message, "history": msgs})
    return {
        "reply": out["reply"],
        "actions": out.get("actions", []),
        "intent": out["intent"],
        "proposition": out.get("proposition"),
    }