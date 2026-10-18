
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import PropositionDonViewSet

router = DefaultRouter()
router.register(
    "propositions",
    PropositionDonViewSet,
    basename="proposition-don",
)

urlpatterns = [
    path("", include(router.urls)),
]
