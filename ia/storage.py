import hashlib
import logging
from datetime import timedelta
from functools import lru_cache
from typing import Literal, TypedDict

from django.core.cache import cache
from django.utils import timezone
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from .llm import get_llm

log = logging.getLogger(__name__)

PROMPT = """Tu es un expert en hygiène alimentaire (HACCP) pour un restaurant en Tunisie.
Donne des consignes de stockage PRUDENTES pour le produit. En cas de doute, choisis la durée la plus courte.
Ces valeurs sont indicatives : l'étiquette du fournisseur prime. Consignes courtes, en français."""

FALLBACK = {  # (mode, tmin, tmax, jours)
    "FRUITS": ("REFRIGERE", 2, 8, 7), "LEGUMES": ("REFRIGERE", 4, 8, 7),
    "VIANDES": ("REFRIGERE", 0, 4, 2), "POISSONS": ("REFRIGERE", 0, 2, 1),
    "LAITIERS": ("REFRIGERE", 0, 4, 5), "BOULANGERIE": ("AMBIANT", 15, 25, 3),
    "AUTRE": ("AMBIANT", 10, 25, 30),
}
SENSIBLES = {"VIANDES", "POISSONS", "LAITIERS"}
MAX_JOURS_FRIGO = {"VIANDES": 4, "POISSONS": 3, "LAITIERS": 10}
MAX_TEMP_FRIGO = {"VIANDES": 4.0, "POISSONS": 2.0, "LAITIERS": 4.0}


class Reco(BaseModel):
    mode_stockage: Literal["AMBIANT", "REFRIGERE", "CONGELE"]
    temperature_min: float = Field(ge=-30, le=40)
    temperature_max: float = Field(ge=-30, le=40)
    duree_conservation_jours: int = Field(ge=0, le=365)
    consignes: list[str] = Field(default_factory=list)
    signes_deterioration: list[str] = Field(default_factory=list)
    a_eviter: list[str] = Field(default_factory=list)
    astuces_prolonger: list[str] = Field(default_factory=list)


class S(TypedDict, total=False):
    nom: str
    categorie: str
    etat: str
    draft: dict | None
    result: dict | None


def generate(state: S) -> dict:
    try:
        reco = get_llm().with_structured_output(Reco).invoke([
            SystemMessage(content=PROMPT),
            HumanMessage(content=f"Produit : {state['nom']}. Catégorie : {state['categorie']}. État : {state['etat']}."),
        ])
        return {"draft": reco.model_dump()}
    except Exception:
        log.exception("Échec recommandation IA")
        return {"draft": None}


def guardrails(state: S) -> dict:
    d, cat = state.get("draft"), state["categorie"]
    if d is None:
        return {"result": None}
    # Viande, poisson, laitiers : jamais à température ambiante
    if cat in SENSIBLES and d["mode_stockage"] == "AMBIANT":
        return {"result": None}
    if d["mode_stockage"] == "REFRIGERE" and cat in SENSIBLES:
        d["duree_conservation_jours"] = min(d["duree_conservation_jours"], MAX_JOURS_FRIGO[cat])
        d["temperature_max"] = min(d["temperature_max"], MAX_TEMP_FRIGO[cat])
    d["temperature_min"] = min(d["temperature_min"], d["temperature_max"])
    d["source"] = "ia"
    return {"result": d}


@lru_cache(maxsize=1)
def _graph():
    g = StateGraph(S)
    g.add_node("generate", generate)
    g.add_node("guardrails", guardrails)
    g.add_edge(START, "generate")
    g.add_edge("generate", "guardrails")
    g.add_edge("guardrails", END)
    return g.compile()


def _fallback(cat: str) -> dict:
    mode, tmin, tmax, jours = FALLBACK.get(cat, FALLBACK["AUTRE"])
    return {
        "mode_stockage": mode, "temperature_min": tmin, "temperature_max": tmax,
        "duree_conservation_jours": jours,
        "consignes": ["Conserver dans un contenant fermé.", "Respecter la chaîne du froid.",
                      "Vérifier l'aspect et l'odeur avant usage."],
        "signes_deterioration": ["Mauvaise odeur", "Texture ou couleur anormale"],
        "a_eviter": ["Rupture de la chaîne du froid"], "astuces_prolonger": [],
        "source": "regles",
    }


def _finaliser(d: dict) -> dict:
    j = d["duree_conservation_jours"]
    d["semaines"] = round(j / 7, 1)
    d["date_expiration_suggeree"] = (timezone.localdate() + timedelta(days=j)).isoformat()
    return d


def recommander_stockage(nom: str, categorie: str, etat: str = "frais") -> dict:
    key = "reco:" + hashlib.md5(f"{nom.strip().lower()}|{categorie}|{etat}".encode()).hexdigest()
    base = cache.get(key)
    if base is None:
        out = _graph().invoke({"nom": nom, "categorie": categorie, "etat": etat})
        base = out.get("result")
        if base:
            cache.set(key, base, 60 * 60 * 24)  # même produit : pas de nouvel appel IA
    return _finaliser(dict(base) if base else _fallback(categorie))