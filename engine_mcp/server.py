import logging
import os
import sys
from datetime import date

import requests
from mcp.server.fastmcp import FastMCP

# Un serveur MCP en stdio ne doit jamais écrire sur stdout : logs sur stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)

API = os.environ.get("SMARTFOOD_API", "http://localhost:8000/api").rstrip("/")


CATEGORIES = {"FRUITS", "LEGUMES", "VIANDES", "POISSONS", "LAITIERS", "BOULANGERIE", "AUTRE"}
UNITES = {"KG", "L", "PIECE"}

mcp = FastMCP("SmartFood Chef")
_auth = {"header": None}


def _login() -> None:
    r = requests.post(f"{API}/auth/login/",
                      json={"email": EMAIL, "username": EMAIL, "password": PASSWORD}, timeout=15)
    r.raise_for_status()
    d = r.json()
    tok = d.get("access_token") or d.get("access")
    if tok:
        _auth["header"] = f"Bearer {tok}"
    elif d.get("token"):
        _auth["header"] = f"Token {d['token']}"
    else:
        raise RuntimeError("Réponse de login inattendue")


def _call(method: str, path: str, **kwargs):
    if not _auth["header"]:
        _login()
    for essai in (1, 2):
        r = requests.request(method, f"{API}{path}", timeout=30,
                             headers={"Authorization": _auth["header"]}, **kwargs)
        if r.status_code == 401 and essai == 1:
            _login()  # token expiré : une seule nouvelle tentative
            continue
        break
    if r.status_code >= 400:
        raise RuntimeError(f"API {r.status_code} : {r.text[:300]}")
    return r.json() if r.content else None


def _resume(p: dict) -> dict:
    return {
        "id": p["id"], "nom": p["nom"], "categorie": p["categorie"],
        "quantite": p["quantite"], "unite": p["unite"],
        "date_expiration": p.get("date_expiration"), "seuil_alerte": p.get("seuil_alerte"),
        "mode_stockage": p.get("mode_stockage"),
        "temperature": (f"{p.get('temperature_min')} à {p.get('temperature_max')} °C"
                        if p.get("temperature_max") is not None else None),
        "consignes": [c for c in (p.get("consignes_stockage") or "").split("\n") if c],
    }


@mcp.tool()
def lister_produits(recherche: str = "") -> list[dict]:
    """Liste les produits du stock du chef (première page). `recherche` filtre sur le nom."""
    data = _call("GET", "/chef/produits/")
    rows = data["results"] if isinstance(data, dict) else data
    rows = [p for p in rows if recherche.lower() in p["nom"].lower()]
    return [_resume(p) for p in rows]


@mcp.tool()
def produits_en_alerte() -> dict:
    """Renvoie les produits expirés, proches de l'expiration (3 jours) et en stock faible."""
    d = _call("GET", "/chef/produits/alertes/")
    return {
        "total": d["total"],
        "expires": [_resume(p) for p in d["expires"]],
        "proche_expiration": [_resume(p) for p in d["proche_expiration"]],
        "stock_faible": [_resume(p) for p in d["stock_faible"]],
    }


@mcp.tool()
def recommander_stockage(nom: str, categorie: str, etat: str = "frais") -> dict:
    """Donne température, durée de conservation (jours/semaines) et consignes pour un produit.
    categorie : FRUITS, LEGUMES, VIANDES, POISSONS, LAITIERS, BOULANGERIE ou AUTRE.
    etat : frais, cuit, ouvert ou congele."""
    if categorie not in CATEGORIES:
        raise ValueError(f"Catégorie invalide. Valeurs : {sorted(CATEGORIES)}")
    return _call("POST", "/chef/produits/recommandation-stockage/",
                 json={"nom": nom, "categorie": categorie, "etat": etat})


@mcp.tool()
def ajouter_produit(
    nom: str,
    categorie: str,
    quantite: float,
    unite: str = "KG",
    date_expiration: str | None = None,
    prix_unitaire: float = 0,
    seuil_alerte: float = 5,
    description: str = "",
) -> dict:
    """Ajoute un produit au stock du chef. À n'appeler qu'après confirmation explicite de l'utilisateur.
    categorie : FRUITS, LEGUMES, VIANDES, POISSONS, LAITIERS, BOULANGERIE ou AUTRE. unite : KG, L ou PIECE.
    date_expiration : AAAA-MM-JJ (optionnelle : sinon elle est calculée d'après la recommandation de stockage).
    Un produit déjà périmé est refusé."""
    if categorie not in CATEGORIES:
        raise ValueError(f"Catégorie invalide. Valeurs : {sorted(CATEGORIES)}")
    if unite not in UNITES:
        raise ValueError(f"Unité invalide. Valeurs : {sorted(UNITES)}")
    if quantite <= 0:
        raise ValueError("La quantité doit être positive.")
    if date_expiration and date.fromisoformat(date_expiration) < date.today():
        raise ValueError("Produit déjà périmé : ne pas l'ajouter au stock, il doit être écarté.")

    cree = _call("POST", "/chef/produits/", json={
        "nom": nom.strip(), "categorie": categorie, "quantite": quantite, "unite": unite,
        "date_expiration": date_expiration, "prix_unitaire": prix_unitaire,
        "seuil_alerte": seuil_alerte, "description": description or "Ajouté via MCP",
    })
    return {"ajoute": True, "produit": _resume(cree)}


if __name__ == "__main__":
    mcp.run()  # transport stdio