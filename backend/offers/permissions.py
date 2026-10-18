from rest_framework.permissions import BasePermission


class IsChef(BasePermission):
    message = "Seuls les comptes chef peuvent proposer des dons."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "CHEF"
        )


class IsAssociation(BasePermission):
    message = "Cette action est réservée aux comptes association."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "ASSOCIATION"
        )
