"""
HealthTech Solutions — URLs: Módulo Emergencias (M04)
Base: /api/v1/emergency/

Rutas generadas por DefaultRouter:
  GET/POST                        /api/v1/emergency/
  GET/PUT/PATCH/DELETE            /api/v1/emergency/{id}/

Acciones de máquina de estados:
  POST  /api/v1/emergency/{id}/atender/       ESPERA → EN_ATENCION
  POST  /api/v1/emergency/{id}/observacion/   EN_ATENCION → OBSERVACION
  POST  /api/v1/emergency/{id}/alta/          EN_ATENCION|OBSERVACION → ALTA/TRANSFERIDO/FALLECIDO
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.emergency.views import EmergenciaViewSet

router = DefaultRouter()
router.register('', EmergenciaViewSet, basename='emergencia')

urlpatterns = [
    path('', include(router.urls)),
]
