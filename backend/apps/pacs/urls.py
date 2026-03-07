"""
HealthTech Solutions — URLs: PACS Module
Genera:
  GET/POST   /api/v1/imaging/estudios/
  GET/PUT/PATCH/DELETE  /api/v1/imaging/estudios/{id}/
  POST       /api/v1/imaging/estudios/{id}/iniciar/
  POST       /api/v1/imaging/estudios/{id}/informe/
  POST       /api/v1/imaging/estudios/{id}/cancelar/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EstudioImagenViewSet

router = DefaultRouter()
router.register('estudios', EstudioImagenViewSet, basename='estudio')

urlpatterns = [
    path('', include(router.urls)),
]
