

from django.urls import path
from .views import (
    RegisterView,
    MyProfileView,
    AdminUserListView,
    AdminUserDetailView,
    login_view
)

urlpatterns = [
    # Inscription
    path("register/", RegisterView.as_view(), name="register"),
   path("login/", login_view, name="login"),
    # Profil connecté
    path("me/", MyProfileView.as_view(), name="my-profile"),

    # Administration des utilisateurs
    path("admin/", AdminUserListView.as_view(), name="admin-user-list"),
    path(
        "admin/<uuid:id>/",
        AdminUserDetailView.as_view(),
        name="admin-user-detail",
    ),
]
