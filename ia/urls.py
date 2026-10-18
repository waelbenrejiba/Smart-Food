# service_ia/urls.py
from django.urls import path
from .views import ChatView, VoiceView

urlpatterns = [
    path("chat/", ChatView.as_view()),
    path("voice/", VoiceView.as_view()),
]