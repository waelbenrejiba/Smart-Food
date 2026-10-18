
@mcp.tool()
def lister_propositions_don() -> list[dict]:
    """Liste les propositions de don accessibles à l'utilisateur connecté."""
    data = _call("GET", "/donations/propositions/")
    rows = data["results"] if isinstance(data, dict) else data
    return rows


@mcp.tool()
def accepter_proposition_don(proposition_id: int) -> dict:
    """Accepte une proposition de don.
    À appeler uniquement après confirmation explicite de l'utilisateur.
    L'utilisateur connecté doit être une association autorisée."""
    if proposition_id <= 0:
        raise ValueError("Identifiant de proposition invalide.")

    return _call(
        "POST",
        f"/donations/propositions/{proposition_id}/accepter/",
        json={},
    )
