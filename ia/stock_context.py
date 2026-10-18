from django.utils import timezone

from chef.models import Produit


def _statut(p: Produit, jours):
    if jours is not None:
        if jours < 0:
            return "expire"
        if jours <= 2:
            return "urgent"
        if jours <= 5:
            return "a_surveiller"
    if p.stock_faible:
        return "stock_faible"
    return "ok"


def snapshot(user) -> dict:
    """Résumé compact du stock du chef, calculé en Python (peu de tokens)."""
    today = timezone.localdate()
    alertes, ok_noms, total = [], [], 0

    for p in Produit.objects.filter(chef=user, actif=True):
        total += 1
        jours = (p.date_expiration - today).days if p.date_expiration else None
        statut = _statut(p, jours)
        if statut == "ok":
            ok_noms.append(p.nom)
            continue
        alertes.append({
            "nom": p.nom,
            "quantite": float(p.quantite),
            "unite": p.unite,
            "jours_restants": jours,
            "statut": statut,
            "seuil": float(p.seuil_alerte),
            "mode": p.mode_stockage,
            "temp": (
                f"{p.temperature_min}-{p.temperature_max}°C"
                if p.temperature_max is not None else None
            ),
            "consignes": (p.consignes_stockage or "").split("\n")[:2],
        })

    ordre = {"expire": 0, "urgent": 1, "a_surveiller": 2, "stock_faible": 3}
    alertes.sort(key=lambda a: (ordre[a["statut"]], a["jours_restants"] if a["jours_restants"] is not None else 999))

    return {
        "date": today.isoformat(),
        "total": total,
        "alertes": alertes[:40],
        "nb_ok": len(ok_noms),
        "noms_ok": ok_noms[:30],
    }