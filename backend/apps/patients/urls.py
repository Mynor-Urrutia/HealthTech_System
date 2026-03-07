"""
HealthTech Solutions — URLs: Módulo Pacientes (M02)
Base: /api/v1/patients/

Rutas generadas por DefaultRouter:
  GET/POST   /api/v1/patients/
  GET/PUT/PATCH/DELETE  /api/v1/patients/{id}/

Rutas de sub-recursos (actions):
  GET/POST   /api/v1/patients/{id}/alergias/
  GET/POST   /api/v1/patients/{id}/contactos/
  GET/POST   /api/v1/patients/{id}/historial/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.patients.views import PacienteViewSet

router = DefaultRouter()
router.register('', PacienteViewSet, basename='paciente')

urlpatterns = [
    path('', include(router.urls)),
]
